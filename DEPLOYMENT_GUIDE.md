# Attendance Tracking App (Internal) - Deployment Guide

This guide covers Google Sheets + Apps Script (backend), ESP32-WROOM gateway, and Flutter mobile client.

## 1) Google Sheets + Apps Script (DB + Logic)

1. Create a Google Sheet with two tabs:
   - Members: id, mssv, full_name, khoa, group_name, is_active
   - Attendance: id, mssv, checkin_time, date, session, week_number, year
2. Open Extensions -> Apps Script.
3. Paste the content from apps_script/Code.gs into the script editor.
4. Set project timezone to Asia/Ho_Chi_Minh:
   - Project Settings -> Time zone.
5. Deploy as a Web App:
   - Deploy -> New deployment -> Web app
   - Execute as: Me
   - Who has access: Anyone with the link (or domain-restricted)
6. Copy the Web App URL (ends with /exec). You will paste this into the ESP32 code.

## 2) ESP32-WROOM (Local Gateway)

1. Open Attendance_Check_ESP32/arduino/attendance_gateway/attendance_gateway.ino in Arduino IDE.
2. Install required libraries:
   - ESPAsyncWebServer
   - AsyncTCP
   - ArduinoJson
3. Update settings in the sketch:
   - kWifiSsid / kWifiPassword
   - kGasUrl with the Apps Script URL
   - kUseStaticIp and IP settings if you want a fixed IP (recommended)
4. Upload the sketch to ESP32.
5. Open Serial Monitor (115200 baud) to confirm:
   - IP address is assigned
   - mDNS is started at http://lab-attendance.local

If mDNS is not reliable on phones, use the static IP in the Flutter app.

## 3) Flutter Mobile Client

1. Update kEsp32BaseUrl in attendance_check_app/lib/main.dart:
   - Example: http://192.168.1.100 or http://lab-attendance.local
2. Install dependencies:
   - flutter pub get
3. Run the app:
   - flutter run

## Notes

- The Flutter app uses a 1.5 second timeout. If no response or Wi-Fi is wrong, it will show a red error.
- ESP32 replies immediately (HTTP 200) after enqueuing, then sends to Apps Script in the background.
- Apps Script blocks duplicate check-ins in the same session and day.
