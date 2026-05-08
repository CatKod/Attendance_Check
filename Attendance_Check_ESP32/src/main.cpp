#include <Arduino.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <AsyncJson.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

const char* kWifiSsid = "ICEA_T3";
const char* kWifiPassword = "02438683518";

const bool kUseStaticIp = true;
const IPAddress kLocalIp(192, 168, 1, 100);
const IPAddress kGateway(192, 168, 1, 1);
const IPAddress kSubnet(255, 255, 255, 0);
const IPAddress kDns1(1, 1, 1, 1);
const IPAddress kDns2(8, 8, 8, 8);

const char* kMdnsHost = "apes";
const char* kGasUrl = "https://script.google.com/macros/s/AKfycbyX7lEcvmdzxBzqMD2C5oqrxrNK6IE-5UQiRNzvtIL5z7SPW8v7_cHvOTO4Fl8mG26vrA/exec";

static const uint8_t kQueueLength = 10;
static const uint16_t kMssvMaxLen = 32;

struct CheckinJob {
  char mssv[kMssvMaxLen];
};

QueueHandle_t checkinQueue = nullptr;
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

void setupServer() {
  server.on("/", HTTP_GET, [](AsyncWebServerRequest* request) {
    request->send(200, "text/plain", "OK");
  });

  auto* handler = new AsyncCallbackJsonWebHandler(
      "/api/checkin",
      [](AsyncWebServerRequest* request, JsonVariant& json) {
        if (!json.is<JsonObject>()) {
          request->send(400, "application/json",
                        "{\"status\":\"error\",\"message\":\"Invalid JSON\"}");
          return;
        }

        JsonObject obj = json.as<JsonObject>();
        const char* mssv = obj["mssv"] | "";
        if (strlen(mssv) == 0) {
          request->send(400, "application/json",
                        "{\"status\":\"error\",\"message\":\"Missing mssv\"}");
          return;
        }

        if (!checkinQueue) {
          request->send(503, "application/json",
                        "{\"status\":\"error\",\"message\":\"Queue unavailable\"}");
          return;
        }

        CheckinJob job;
        memset(job.mssv, 0, sizeof(job.mssv));
        strncpy(job.mssv, mssv, sizeof(job.mssv) - 1);

        if (xQueueSend(checkinQueue, &job, 0) != pdTRUE) {
          request->send(503, "application/json",
                        "{\"status\":\"error\",\"message\":\"Queue full\"}");
          return;
        }

        request->send(200, "application/json", "{\"status\":\"queued\"}");
      });

  handler->setMethod(HTTP_POST);
  server.addHandler(handler);

  server.onNotFound([](AsyncWebServerRequest* request) {
    request->send(404, "application/json",
                  "{\"status\":\"error\",\"message\":\"Not found\"}");
  });

  server.begin();
  Serial.println("Web server started");
}

bool sendToGas(const char* mssv) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, skipping send");
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient https;
  if (!https.begin(client, kGasUrl)) {
    Serial.println("HTTPS begin failed");
    return false;
  }

  https.addHeader("Content-Type", "application/json");
  JsonDocument doc;
  doc["mssv"] = mssv;
  String payload;
  serializeJson(doc, payload);

  int statusCode = https.POST(payload);
  if (statusCode > 0) {
    Serial.printf("GAS status: %d\n", statusCode);
    String response = https.getString();
    Serial.println(response);
  } else {
    Serial.printf("GAS error: %s\n", https.errorToString(statusCode).c_str());
  }

  https.end();
  return statusCode > 0 && statusCode < 400;
}

void webServerTask(void* pvParameters) {
  setupServer();
  for (;;) {
    vTaskDelay(pdMS_TO_TICKS(1000));
  }
}

void workerTask(void* pvParameters) {
  CheckinJob job;
  for (;;) {
    if (xQueueReceive(checkinQueue, &job, portMAX_DELAY) == pdTRUE) {
      sendToGas(job.mssv);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);

  checkinQueue = xQueueCreate(kQueueLength, sizeof(CheckinJob));
  if (!checkinQueue) {
    Serial.println("Queue creation failed");
  }

  connectWifi();
  if (WiFi.status() == WL_CONNECTED) {
    startMdns();
  }

  xTaskCreatePinnedToCore(webServerTask, "WebServerTask", 8192, nullptr, 1,
                          nullptr, 0);
  xTaskCreatePinnedToCore(workerTask, "WorkerTask", 8192, nullptr, 1, nullptr,
                          1);
}

void loop() {
  delay(1000);
}