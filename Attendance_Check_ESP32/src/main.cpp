#include <Arduino.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <AsyncJson.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

const char* kWifiSsid = "I2";
const char* kWifiPassword = "abcd1232";

const bool kUseStaticIp = false;
const IPAddress kLocalIp(192, 168, 1, 100);
const IPAddress kGateway(192, 168, 1, 1);
const IPAddress kSubnet(255, 255, 255, 0);
const IPAddress kDns1(8, 8, 8, 8);
const IPAddress kDns2(1, 1, 1, 1);

const char* kMdnsHost = "apes";
const char* kGasUrl = "https://script.google.com/macros/s/AKfycbyX7lEcvmdzxBzqMD2C5oqrxrNK6IE-5UQiRNzvtIL5z7SPW8v7_cHvOTO4Fl8mG26vrA/exec";

static const uint8_t kQueueLength = 10;
static const uint16_t kMssvMaxLen = 32;
static const uint16_t kRequestIdLen = 16;
static const uint8_t kStatusCacheSize = 12;
static const uint32_t kWorkerTimeoutMs = 30000;

struct CheckinJob {
  char requestId[kRequestIdLen];
  char mssv[kMssvMaxLen];
};

struct CheckinResult {
  bool valid;
  bool done;
  bool success;
  bool alreadyCheckedIn;
  uint16_t httpStatus;
  char requestId[kRequestIdLen];
  char mssv[kMssvMaxLen];
  char code[32];
  char status[32];
  char message[160];
};

QueueHandle_t checkinQueue = nullptr;
SemaphoreHandle_t statusMutex = nullptr;
CheckinResult statusCache[kStatusCacheSize];
uint8_t statusCacheIndex = 0;
AsyncWebServer server(80);

void connectWifi() {
  WiFi.mode(WIFI_STA);
  if (kUseStaticIp) {
    if (!WiFi.config(kLocalIp, kGateway, kSubnet, kDns1, kDns2)) {
      Serial.println("Static IP config failed");
    }
  }

  WiFi.begin(kWifiSsid, kWifiPassword);
  Serial.print("WiFi connecting");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
    if (millis() - start > 20000) {
      break;
    }
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi connected: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi connection failed");
  }
}

void startMdns() {
  if (MDNS.begin(kMdnsHost)) {
    Serial.print("mDNS started: http://");
    Serial.print(kMdnsHost);
    Serial.println(".local");
  } else {
    Serial.println("mDNS start failed");
  }
}

String extractRedirectUrl(const String& html) {
  const String marker = "https://script.googleusercontent.com/";
  const int start = html.indexOf(marker);
  if (start < 0) {
    return "";
  }

  int end = html.indexOf('"', start);
  if (end < 0) {
    end = html.indexOf('\'', start);
  }
  if (end < 0) {
    end = html.length();
  }

  String url = html.substring(start, end);
  url.replace("&amp;", "&");
  return url;
}

void setCString(char* dest, size_t size, const char* value) {
  if (!dest || size == 0) return;
  strncpy(dest, value ? value : "", size - 1);
  dest[size - 1] = '\0';
}

String makeRequestId() {
  char buf[9];
  uint32_t value = esp_random();
  snprintf(buf, sizeof(buf), "%08lX", static_cast<unsigned long>(value));
  return String(buf);
}

void initStatusCache() {
  statusMutex = xSemaphoreCreateMutex();
  if (!statusMutex) return;

  xSemaphoreTake(statusMutex, portMAX_DELAY);
  for (uint8_t i = 0; i < kStatusCacheSize; ++i) {
    memset(&statusCache[i], 0, sizeof(CheckinResult));
    statusCache[i].valid = false;
  }
  xSemaphoreGive(statusMutex);
}

void cacheResult(const CheckinResult& result) {
  if (!statusMutex) return;
  xSemaphoreTake(statusMutex, portMAX_DELAY);
  statusCache[statusCacheIndex] = result;
  statusCache[statusCacheIndex].valid = true;
  statusCacheIndex = (statusCacheIndex + 1) % kStatusCacheSize;
  xSemaphoreGive(statusMutex);
}

bool getCachedResult(const char* requestId, CheckinResult* out) {
  if (!statusMutex || !requestId || !out) return false;
  bool found = false;
  xSemaphoreTake(statusMutex, portMAX_DELAY);
  for (uint8_t i = 0; i < kStatusCacheSize; ++i) {
    if (!statusCache[i].valid) continue;
    if (strncmp(statusCache[i].requestId, requestId, kRequestIdLen) == 0) {
      *out = statusCache[i];
      found = true;
      break;
    }
  }
  xSemaphoreGive(statusMutex);
  return found;
}

void buildResponseJson(const CheckinResult& result, String& out) {
  JsonDocument doc;
  doc["ok"] = result.success || result.alreadyCheckedIn;
  doc["code"] = result.code;
  doc["status"] = result.status;
  doc["message"] = result.message;
  JsonObject data = doc["data"].to<JsonObject>();
  data["requestId"] = result.requestId;
  data["mssv"] = result.mssv;
  data["httpStatus"] = result.httpStatus;
  data["transport"] = "esp32_async";
  serializeJson(doc, out);
}

void sendCurrentResult(AsyncWebServerRequest* request, const CheckinResult& result) {
  String body;
  buildResponseJson(result, body);
  request->send(result.httpStatus, "application/json", body);
}

bool parseGasResponse(const String& body, CheckinResult* out) {
  if (!out) return false;

  out->success = false;
  out->alreadyCheckedIn = false;
  out->httpStatus = 502;
  setCString(out->code, sizeof(out->code), "CHECKIN_FAILED");
  setCString(out->status, sizeof(out->status), "error");
  setCString(out->message, sizeof(out->message), body.c_str());

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, body);
  if (!err) {
    bool okValue = false;
    if (doc["ok"].is<bool>()) {
      okValue = doc["ok"].as<bool>();
    } else {
      String okText = doc["ok"] | "";
      okText.toLowerCase();
      okValue = okText == "true";
    }

    String code = doc["code"] | "";
    code.toUpperCase();
    String status = doc["status"] | "";
    status.toLowerCase();
    String message = doc["message"] | "";
    JsonObject data = doc["data"].as<JsonObject>();

    if (code == "ALREADY_CHECKED_IN" || status == "already_checked_in") {
      out->success = true;
      out->alreadyCheckedIn = true;
      out->httpStatus = 200;
      setCString(out->code, sizeof(out->code), "ALREADY_CHECKED_IN");
      setCString(out->status, sizeof(out->status), "already_checked_in");
      setCString(out->message, sizeof(out->message), message.length() > 0 ? message.c_str() : "Đã check-in rồi.");
      return true;
    }

    if (code == "CHECKIN_OK" || status == "success" || okValue) {
      out->success = true;
      out->alreadyCheckedIn = false;
      out->httpStatus = 200;
      setCString(out->code, sizeof(out->code), "CHECKIN_OK");
      setCString(out->status, sizeof(out->status), "success");
      setCString(out->message, sizeof(out->message), message.length() > 0 ? message.c_str() : "Check-in thành công");
      return true;
    }

    if (code == "OUTSIDE_SESSION" || status == "error") {
      out->success = false;
      out->alreadyCheckedIn = false;
      out->httpStatus = 400;
      setCString(out->code, sizeof(out->code), code.length() > 0 ? code.c_str() : "CHECKIN_FAILED");
      setCString(out->status, sizeof(out->status), "error");
      setCString(out->message, sizeof(out->message), message.length() > 0 ? message.c_str() : "Check-in thất bại");
      return true;
    }

    if (code.length() > 0) {
      out->success = false;
      out->alreadyCheckedIn = false;
      out->httpStatus = 400;
      setCString(out->code, sizeof(out->code), code.c_str());
      setCString(out->status, sizeof(out->status), status.length() > 0 ? status.c_str() : "error");
      setCString(out->message, sizeof(out->message), message.length() > 0 ? message.c_str() : "Check-in thất bại");
      return true;
    }
  }

  String lower = body;
  lower.toLowerCase();
  if (lower.indexOf("already_checked_in") >= 0 ||
      lower.indexOf("already checked in") >= 0 ||
      lower.indexOf("da check-in roi") >= 0 ||
      lower.indexOf("da check in roi") >= 0 ||
      lower.indexOf("đã check-in rồi") >= 0) {
    out->success = true;
    out->alreadyCheckedIn = true;
    out->httpStatus = 200;
    setCString(out->code, sizeof(out->code), "ALREADY_CHECKED_IN");
    setCString(out->status, sizeof(out->status), "already_checked_in");
    setCString(out->message, sizeof(out->message), "Đã check-in rồi.");
    return true;
  }

  if (lower.indexOf("check-in thành công") >= 0 ||
      lower.indexOf("check-in thanh cong") >= 0 ||
      lower.indexOf("\"ok\":true") >= 0) {
    out->success = true;
    out->alreadyCheckedIn = false;
    out->httpStatus = 200;
    setCString(out->code, sizeof(out->code), "CHECKIN_OK");
    setCString(out->status, sizeof(out->status), "success");
    setCString(out->message, sizeof(out->message), "Check-in thành công");
    return true;
  }

  if (lower.indexOf("outside of check-in window") >= 0 ||
      lower.indexOf("out of check-in window") >= 0) {
    out->success = false;
    out->alreadyCheckedIn = false;
    out->httpStatus = 400;
    setCString(out->code, sizeof(out->code), "OUTSIDE_SESSION");
    setCString(out->status, sizeof(out->status), "error");
    setCString(out->message, sizeof(out->message), "Outside of check-in window.");
    return true;
  }

  return false;
}

bool postToGas(const String& url, const String& payload, String* outBody, int* outStatus) {
  WiFiClientSecure client;
  client.setInsecure();
  client.setHandshakeTimeout(20);

  HTTPClient https;
  https.setTimeout(15000);
  https.setReuse(false);
  https.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);

  if (!https.begin(client, url)) {
    if (outBody) *outBody = "HTTPS begin failed";
    if (outStatus) *outStatus = -1;
    return false;
  }

  https.addHeader("Content-Type", "application/json");
  https.addHeader("Accept", "application/json,text/plain,*/*");

  int statusCode = https.POST(payload);
  String body = https.getString();
  https.end();

  if (outBody) *outBody = body;
  if (outStatus) *outStatus = statusCode;
  return true;
}

bool getFromGas(const String& url, String* outBody, int* outStatus) {
  WiFiClientSecure client;
  client.setInsecure();
  client.setHandshakeTimeout(20);

  HTTPClient https;
  https.setTimeout(15000);
  https.setReuse(false);
  https.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);

  if (!https.begin(client, url)) {
    if (outBody) *outBody = "HTTPS begin failed";
    if (outStatus) *outStatus = -1;
    return false;
  }

  https.addHeader("Accept", "application/json,text/plain,*/*");

  int statusCode = https.GET();
  String body = https.getString();
  https.end();

  if (outBody) *outBody = body;
  if (outStatus) *outStatus = statusCode;
  return true;
}



void processCheckin(const CheckinJob& job) {
  CheckinResult result;
  memset(&result, 0, sizeof(result));
  result.valid = true;
  result.done = false;
  result.success = false;
  result.alreadyCheckedIn = false;
  result.httpStatus = 500;
  setCString(result.requestId, sizeof(result.requestId), job.requestId);
  setCString(result.mssv, sizeof(result.mssv), job.mssv);
  setCString(result.code, sizeof(result.code), "CHECKIN_FAILED");
  setCString(result.status, sizeof(result.status), "error");
  setCString(result.message, sizeof(result.message), "Processing");

  JsonDocument doc;
  doc["mssv"] = job.mssv;
  String payload;
  serializeJson(doc, payload);

  String currentUrl = kGasUrl;
  String response;
  int statusCode = -1;
  bool requestOk = false;

  for (uint8_t attempt = 0; attempt < 3; ++attempt) {
    requestOk = postToGas(currentUrl, payload, &response, &statusCode);
    Serial.printf("GAS status: %d\n", statusCode);
    if (response.length() > 0) Serial.println(response);

    if (!requestOk) {
      setCString(result.message, sizeof(result.message), "Request failed");
      break;
    }

    if (statusCode == 302 || statusCode == 301 || statusCode == 303) {
      String redirectUrl = extractRedirectUrl(response);
      if (redirectUrl.length() == 0) {
        setCString(result.message, sizeof(result.message), "Redirect URL missing");
        break;
      }
      Serial.print("Following redirect to: ");
      Serial.println(redirectUrl);
      bool getOk = getFromGas(redirectUrl, &response, &statusCode);
      Serial.printf("GAS redirected status: %d\n", statusCode);
      if (response.length() > 0) Serial.println(response);
      if (!getOk) {
        setCString(result.message, sizeof(result.message), "Redirect fetch failed");
        break;
      }
    } else if (statusCode == 405) {
      String redirectUrl = extractRedirectUrl(response);
      if (redirectUrl.length() > 0) {
        bool getOk = getFromGas(redirectUrl, &response, &statusCode);
        Serial.printf("GAS retry status: %d\n", statusCode);
        if (response.length() > 0) Serial.println(response);
        if (!getOk) {
          setCString(result.message, sizeof(result.message), "Redirect fetch failed");
          break;
        }
      }
    }

    if (statusCode >= 200 && statusCode < 300) {
      if (!parseGasResponse(response, &result)) {
        setCString(result.message, sizeof(result.message), "Unrecognized GAS response");
        result.httpStatus = 502;
      }
      break;
    }

    if (statusCode < 0) {
      setCString(result.message, sizeof(result.message), "Connection error");
      break;
    }

    if (!parseGasResponse(response, &result)) {
      setCString(result.message, sizeof(result.message), "Check-in thất bại");
      result.httpStatus = 502;
    }
    break;
  }

  if (result.httpStatus == 500 && result.message[0] == '\0') {
    setCString(result.message, sizeof(result.message), "Check-in thất bại");
  }
  result.done = true;
  cacheResult(result);

  String responseBody;
  buildResponseJson(result, responseBody);
  Serial.println(responseBody);

  if (result.alreadyCheckedIn) {
    Serial.printf("Check-in result: already_checked_in | %s\n", result.message);
  } else {
    Serial.printf("Check-in result: %s | %s\n", result.success ? "success" : "fail", result.message);
  }
}

void workerTask(void* pvParameters) {
  CheckinJob job;
  for (;;) {
    if (xQueueReceive(checkinQueue, &job, portMAX_DELAY) == pdTRUE) {
      processCheckin(job);
    }
  }
}

void setupServer() {
  server.on("/", HTTP_GET, [](AsyncWebServerRequest* request) {
    request->send(200, "text/plain", "OK");
  });

  server.on("/api/status", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (!request->hasParam("requestId")) {
      request->send(400, "application/json", "{\"ok\":false,\"code\":\"MISSING_REQUEST_ID\",\"status\":\"error\",\"message\":\"Missing requestId\"}");
      return;
    }

    String requestId = request->getParam("requestId")->value();
    CheckinResult cached;
    if (!getCachedResult(requestId.c_str(), &cached)) {
      request->send(404, "application/json", "{\"ok\":false,\"code\":\"NOT_FOUND\",\"status\":\"pending\",\"message\":\"Result not ready\"}");
      return;
    }

    sendCurrentResult(request, cached);
  });

  auto* handler = new AsyncCallbackJsonWebHandler(
      "/api/checkin",
      [](AsyncWebServerRequest* request, JsonVariant& json) {
        if (!json.is<JsonObject>()) {
          request->send(400, "application/json", "{\"ok\":false,\"code\":\"INVALID_JSON\",\"status\":\"error\",\"message\":\"Invalid JSON\"}");
          return;
        }

        JsonObject obj = json.as<JsonObject>();
        const char* mssv = obj["mssv"] | "";
        if (strlen(mssv) == 0) {
          request->send(400, "application/json", "{\"ok\":false,\"code\":\"MISSING_MSSV\",\"status\":\"error\",\"message\":\"Missing mssv\"}");
          return;
        }

        if (!checkinQueue) {
          request->send(503, "application/json", "{\"ok\":false,\"code\":\"QUEUE_UNAVAILABLE\",\"status\":\"error\",\"message\":\"Queue unavailable\"}");
          return;
        }

        CheckinJob job;
        memset(&job, 0, sizeof(job));
        setCString(job.requestId, sizeof(job.requestId), makeRequestId().c_str());
        setCString(job.mssv, sizeof(job.mssv), mssv);

        if (xQueueSend(checkinQueue, &job, 0) != pdTRUE) {
          request->send(503, "application/json", "{\"ok\":false,\"code\":\"QUEUE_FULL\",\"status\":\"error\",\"message\":\"Queue full\"}");
          return;
        }

        JsonDocument responseDoc;
        responseDoc["ok"] = true;
        responseDoc["code"] = "ACCEPTED";
        responseDoc["status"] = "pending";
        responseDoc["message"] = "Check-in đang được xử lý";
        JsonObject data = responseDoc["data"].to<JsonObject>();
        data["requestId"] = job.requestId;
        data["mssv"] = job.mssv;
        String body;
        serializeJson(responseDoc, body);
        request->send(202, "application/json", body);
      });

  handler->setMethod(HTTP_POST);
  server.addHandler(handler);

  server.onNotFound([](AsyncWebServerRequest* request) {
    request->send(404, "application/json", "{\"status\":\"error\",\"message\":\"Not found\"}");
  });

  server.begin();
  Serial.println("Web server started");
}

void setup() {
  Serial.begin(115200);
  delay(200);

  checkinQueue = xQueueCreate(kQueueLength, sizeof(CheckinJob));
  if (!checkinQueue) {
    Serial.println("Queue creation failed");
  }

  initStatusCache();
  connectWifi();
  if (WiFi.status() == WL_CONNECTED) {
    startMdns();
  }

  setupServer();
  xTaskCreatePinnedToCore(workerTask, "WorkerTask", 8192, nullptr, 1, nullptr, 1);
}

void loop() {
  delay(1000);
}
