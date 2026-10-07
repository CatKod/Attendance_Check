# 🚀 Hướng dẫn cài đặt Desktop & Mobile App

Tài liệu này hướng dẫn dựng **Desktop App cá nhân (Electron)** và **Mobile App (Expo)**
theo `FUNCTIONAL_SPECIFICATION.md`.

> **Phiên bản 0.2.0**: Desktop app đã chuyển từ **kiosk công cộng** sang
> **app cá nhân cố định theo sinh viên**. Mỗi SV cài app trên laptop
> của mình, app ghi nhớ MSSV + MAC và tự động đăng nhập các lần sau.

---

## 1. Kiến trúc luồng

```
┌─────────────────────────────┐        ┌──────────────────────┐
│  DESKTOP APP CÁ NHÂN        │        │  MOBILE APP          │
│  (Electron, .exe)            │        │  (Expo, Android)     │
│  Cài trên laptop từng SV     │        │                      │
│                               │        │                      │
│  Lần đầu:                    │        │  3. Quét QR          │
│   1. Nhập MSSV ──────────────┼───────►│  4. Lưu Android ID   │
│   2. Lưu MAC vào Registry   │  QR    │  5. Bind vĩnh viễn   │
│                               │        │                      │
│  Lần sau:                    │        │                      │
│   Tự động nhận diện qua MAC  │        │                      │
│   (không cần nhập lại)       │        │                      │
│                               │        │                      │
│  Mọi lần:                    │        │                      │
│   - Điểm danh                │        │                      │
│   - Auto-update từ GitHub    │        │                      │
└──────────────┬────────────────┘        └──────────┬───────────┘
               │                                  │
               └──────────────┬──────────────────┘
                              ▼
              ┌────────────────────────────┐
              │  Supabase                  │
              │  • verify-mssv (bind MAC)  │
              │  • generate-link-qr        │
              │  • claim-mobile-binding    │
              │  • check-attendance        │
              │  • reset_device_binding    │
              └────────────────────────────┘
```

**Nguyên tắc mới:**
- Desktop là **app cá nhân** (1 SV = 1 laptop + 1 mobile).
- Sau đăng nhập lần đầu, app **ghi nhớ phiên trong Windows Registry** (`HKCU\Software\APES-Lab\Kiosk`).
- Lần mở sau: tự động vào app nếu MAC của máy khớp với session.
- Khi mobile đã liên kết, **không hiện QR nữa** (chỉ hiện 1 lần duy nhất).
- App **tự động cập nhật** khi có phiên bản mới trên GitHub Releases.

---

## 2. Yêu cầu hệ thống

| Công cụ | Phiên bản | Ghi chú |
|---|---|---|
| Node.js | ≥ 20 | Kiểm tra: `node -v` |
| npm | ≥ 10 | |
| Java | 17 hoặc 21 | Chỉ cần khi build APK |
| Android SDK | — | Đặt `ANDROID_HOME` |
| Deno | 2.x | Chỉ cần khi deploy Edge Functions |
| Supabase CLI | 2.x | `npm i -g supabase` |

> **Lưu ý:** Desktop dùng **Electron** (không cần Rust như Tauri).

---

## 3. Cài đặt lần đầu

```bash
# 1. Cài dependencies cho toàn bộ workspace
npm install

# 2. Build gói dùng chung (bắt buộc — Desktop main process cần CommonJS)
npm run build --workspace=packages/shared-types
```

### 3.1. Cấu hình biến môi trường

```bash
# Desktop
copy apps\desktop\.env.example apps\desktop\.env

# Mobile
copy apps\mobile\.env.example apps\mobile\.env
```

Điền vào cả hai file (lấy từ Supabase Dashboard → Settings → API):

```env
# Desktop .env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
FUNCTIONS_URL=https://<project-ref>.supabase.co/functions/v1
LAB_NAME=APES Lab
KIOSK_PIN=1234

# Mobile .env
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
EXPO_PUBLIC_FUNCTIONS_URL=https://<project-ref>.supabase.co/functions/v1
EXPO_PUBLIC_LAB_NAME=APES Lab
```

> ⚠️ **Không bao giờ** đặt `SUPABASE_SERVICE_ROLE_KEY` vào file `.env` của app.
> Key này chỉ dùng ở server / Edge Functions.

---

## 4. Deploy Edge Functions

Bốn function sau phải được deploy lên Supabase:

| Function | Mục đích | verify_jwt |
|---|---|---|
| `verify-mssv` | Xác thực MSSV + bind MAC | `false` |
| `generate-link-qr` | Sinh QR liên kết Mobile (TTL 60s) | `false` |
| `claim-mobile-binding` | Mobile đổi QR lấy session | `false` |
| `check-attendance` | Ghi nhận điểm danh | `false` |

```bash
supabase login
supabase link --project-ref <project-ref>

supabase functions deploy verify-mssv
supabase functions deploy generate-link-qr
supabase functions deploy claim-mobile-binding
supabase functions deploy check-attendance
```

Kiểm tra trước khi deploy:

```bash
npm run check:functions   # deno check + deno lint
```

> **Vì sao `verify_jwt = false`?**
> Kiosk và Mobile gọi API *trước khi* có Supabase session (người dùng chưa
> đăng nhập). Bảo mật thực hiện bằng:
> - `device_bindings` — ràng buộc thiết bị vật lý
> - Kiểm tra IP ∈ subnet Wi-Fi lab (server-side, không tin client)
> - Kiểm tra cửa sổ điểm danh theo lịch
> - Token QR 60 giây, dùng 1 lần

---

## 5. Database

Migration đã nằm trong `supabase/migrations/20261006_device_linking.sql`:

```bash
supabase db push
```

Tạo thêm (nếu chưa có):

| Bảng | Mục đích |
|---|---|
| `kiosk_devices` | Đăng ký máy kiosk tại lab |
| `device_link_tokens` | Token QR 60 giây, dùng 1 lần |
| `device_bindings.note` | Model thiết bị |

RPC được tạo:

| Hàm | Mục đích |
|---|---|
| `match_wifi_by_ip(INET)` | Kiểm tra IP ∈ subnet lab |
| `get_checkin_windows(INT)` | Cửa sổ điểm danh của một thứ |
| `vietnam_today()` | Ngày hiện tại theo giờ VN |
| `cleanup_expired_link_tokens()` | Dọn token rác |

### ⚠️ Dữ liệu bắt buộc phải có

Nếu chưa cấu hình, **điểm danh sẽ luôn bị từ chối**:

1. **Ít nhất một `wifi_networks` đang `is_active = true`**
   → Web Admin → Quản lý Wi-Fi. Ví dụ: SSID `APES-Lab-HN`, subnet `192.168.1.0/24`.

2. **Lịch `lab_schedules` cho hôm nay** với `allow_checkin = true`
   và `checkin_start_time` / `checkin_end_time` khác NULL.
   → Web Admin → Lịch Lab.

> Quy ước `day_of_week`: **0 = Chủ nhật, 1 = Thứ 2, … 6 = Thứ 7**
> (khớp với `Date.getDay()` trong JavaScript).

---

## 6. Chạy Desktop App

```bash
# Chế độ dev (Vite hot reload)
npm run dev:desktop

# Chạy bản build (file tĩnh, không cần Vite)
cd apps\desktop
$env:KIOSK_FORCE_PROD = "1"   # PowerShell
npx electron .
```

### Đóng gói file .exe

```bash
npm run dist:desktop
```

Kết quả: `apps/desktop/release/APES-Lab-Kiosk-Setup-0.2.0.exe`

### Phân phối cho sinh viên

1. Sau khi build, upload file `.exe` lên GitHub Releases
   (cùng tag version, vd: `v0.2.0`).
2. Sinh viên tải từ trang **Dashboard → Cài đặt → Tải ứng dụng**.
4. Sau khi cài, SV mở app → nhập MSSV → bind MAC vĩnh viễn.

### Tính năng phiên bản 0.2.0

| Tính năng | Trạng thái |
|---|---|
| Auto-login qua MAC (lưu trong Registry) | ✅ |
| Tự động đăng nhập các lần sau | ✅ |
| Nút "Đăng xuất" rõ ràng | ✅ |
| Sau điểm danh → ở lại Home | ✅ |
| Mobile đã liên kết → ẩn QR vĩnh viễn | ✅ |
| Thu thập hostname, OS, disk serial | ✅ |
| Auto-update từ GitHub Releases | ✅ |
| Đồng hồ + ngày realtime | ✅ |

---

## 7. Chạy Mobile App

```bash
# Expo Go trên điện thoại
npm run dev:mobile

# Chạy trên máy Android có emulator
npm run android
```

### Tính năng đã có

| Mã | Tính năng | Trạng thái |
|---|---|---|
| F-MOB-AUTH-01 | Màn hình quét QR khi chưa liên kết | ✅ |
| F-MOB-AUTH-03 | Gửi token + Android ID | ✅ |
| F-MOB-AUTH-04 | Lưu vào SecureStore (Keystore) | ✅ |
| F-MOB-AUTH-06 | Tự động vào màn hình chính từ lần 2 | ✅ |
| F-MOB-AUTH-07 | **Không có** nút đăng xuất | ✅ |
| F-MOB-ATT-02 | Gửi IP, server kiểm tra subnet | ✅ |
| F-MOB-ATT-06 | Từ chối khi dùng 4G/5G | ✅ |
| F-MOB-PROF-01 | Xem hồ sơ (chỉ đọc) | ✅ |
| F-MOB-PROF-03 | Trạng thái thiết bị liên kết | ✅ |
| F-MOB-HIS-04 | Lịch sử + thiết bị đã dùng | ✅ |

### Build APK

```bash
cd apps\mobile
npx expo prebuild --platform android
cd android
gradlew.bat assembleRelease
```

Kết quả: `android/app/build/outputs/apk/release/app-release.apk`

---

## 7b. Auto-update Desktop từ GitHub Releases

App tự động kiểm tra bản cập nhật mỗi khi khởi động (sau 5s).
Khi có phiên bản mới, dialog sẽ hiện để hỏi SV có muốn cập nhật ngay không.

### Quy trình phát hành bản mới

```bash
# 1. Tăng version trong apps/desktop/package.json
#    "version": "0.2.0" → "0.3.0"

# 2. Build file .exe
npm run dist:desktop

# 3. Tạo GitHub Release với tag = version (KHÔNG có prefix 'v')
#    Ví dụ: tag = "0.3.0"
#    Upload file: APES-Lab-Kiosk-Setup-0.3.0.exe
#    Publish release (KHÔNG phải draft)
```

### Cấu hình trong `apps/desktop/package.json`

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "apes-lab",
      "repo": "attendance-check"
    }
  }
}
```

Lưu ý: Khi build bằng `electron-builder`, nó sẽ tự động tạo file `latest.yml` chứa metadata. File này cần upload cùng với `.exe` lên GitHub Release.

---

## 7c. Reset binding từ Web-Admin

Khi SV bị mất/mượn laptop khác, Trưởng Lab có thể reset binding:

1. Đăng nhập web-admin
2. Vào **Thành viên**
3. Bấm biểu tượng máy tính bên cạnh SV cần reset
4. Trong modal **Thiết bị**, bấm **Reset** trên binding cần reset
5. Nhập lý do (sẽ lưu vào audit log)
6. SV mở app trên máy mới → nhập lại MSSV → bind thành công

RPC `reset_device_binding(binding_id, reason)` được gọi qua Server Action `resetDeviceBinding`. Chỉ role `lab_leader` / `lab_manager` mới có quyền.

---

## 8. Kiểm thử

```bash
npm test              # 20 test cho logic subnet / cửa sổ điểm danh / QR
npm run typecheck     # web-admin + desktop + mobile
npm run check:functions  # typecheck + lint Edge Functions
```

### Kiểm tra kiosk đang chạy

```bash
# Khởi động kiosk với remote debugging
$env:KIOSK_FORCE_PROD = "1"
npx electron apps/desktop/dist/main/main.js --remote-debugging-port=9222

# Xem UI + thông tin mạng
node scripts/inspect-kiosk.mjs --screenshot kiosk.png
```

Script sẽ in ra IP, MAC thật của máy và ảnh chụp giao diện.

---

## 9. Luồng kiểm thử thực tế

### Desktop

1. Mở app lần đầu → nhập `20232276` → Enter
2. Nếu mobile chưa liên kết: hiện **QR đếm ngược 60 giây**
   - Bấm **Để sau, điểm danh trước** nếu chưa cần liên kết Mobile
   - Bấm **Tạo mã mới** để làm mới QR
3. Sau khi mobile liên kết thành công → app tự chuyển sang Home
4. Nhấn **ĐIỂM DANH HÔM NAY**
5. Xem kết quả ✓ / ✗, **ở lại Home** sau 5 giây (KHÔNG reset về nhập MSSV)
6. Bấm nút **Đăng xuất** (icon ở góc phải header) → xoá session, về màn nhập MSSV
7. Tắt app, mở lại → tự động vào Home (nhờ session trong Registry)

### Mobile

1. Cài app, mở lần đầu → màn hình quét QR
2. Quét QR trên Desktop
3. Hiện thông tin sinh viên để đối chiếu → **Bắt đầu**
4. Khi mở cửa sổ điểm danh, nhấn **ĐIỂM DANH**

### Kiểm tra chống gian lận

| Tình huống | Kết quả mong đợi |
|---|---|
| MSSV không tồn tại | "MSSV không tồn tại trong hệ thống" |
| Đổi máy kiosk, nhập lại MSSV | "Bạn đã được liên kết với một máy khác" |
| Quét QR quá 60 giây | "Mã QR đã hết hạn" |
| Quét lại cùng một QR | "Mã QR đã được sử dụng" |
| Mobile đổi sang máy khác | "Tài khoản này đã được liên kết với điện thoại khác" |
| Điểm danh ngoài Wi-Fi lab | "Không phát hiện kết nối Wi-Fi lab" |
| Điểm danh ngoài khung giờ | "Ngoài giờ điểm danh" + giờ hợp lệ |
| Điểm danh 2 lần trong ngày | "Bạn đã điểm danh hôm nay rồi" |
| Mobile dùng 4G | "Bạn đang dùng dữ liệu di động" |

---

## 10. Cấu trúc thư mục

```
Attendance_Check/
├── apps/
│   ├── web-admin/          # Next.js 14 — quản trị (đã hoàn thành)
│   ├── desktop/            # Electron — kiosk tại lab
│   │   ├── src/main/       # main process: MAC/IP, IPC, kiosk mode
│   │   ├── src/preload/    # contextBridge an toàn
│   │   └── src/renderer/   # React UI (Tailwind)
│   └── mobile/             # Expo — app điện thoại
│       └── src/
│           ├── screens/    # ScanScreen, HomeScreen, ProfileScreen
│           ├── context/    # AuthContext (auto-login)
│           └── network.ts  # lấy IP + Android ID
├── packages/
│   └── shared-types/       # logic dùng chung (CJS + ESM)
├── supabase/
│   ├── migrations/         # schema
│   └── functions/          # Edge Functions (Deno)
├── scripts/
│   └── inspect-kiosk.mjs   # debug kiosk qua CDP
└── tests/
    └── shared-logic.test.ts
```

---

## 11. Xử lý sự cố

### `SyntaxError: Unexpected token 'export'` khi chạy Desktop

Gói `@apes/shared-types` chưa được build:

```bash
npm run build --workspace=packages/shared-types
```

### `ERR_CONNECTION_REFUSED http://localhost:5173`

Đang chạy chế độ dev mà Vite chưa khởi động. Hoặc chạy bản build:

```bash
$env:KIOSK_FORCE_PROD = "1"
npx electron apps/desktop/dist/main/main.js
```

### `electron.exe` không chạy (máy Windows)

Windows Defender thường chặn file Electron vừa giải nén. Nếu vậy:

```powershell
# Giải nén thủ công bằng PowerShell (tránh lỗi antivirus)
Expand-Archive node_modules\electron\dist\..\..\.electron-zip.zip `
  -DestinationPath node_modules\electron\dist -Force
```

Hoặc thêm thư mục `node_modules\electron` vào Exclusion của Windows Defender.

### Điểm danh luôn báo "Không phát hiện kết nối Wi-Fi lab"

Kiểm tra `wifi_networks` đã có bản ghi `is_active = true` và
subnet chứa IP của máy. Xem `scripts/inspect-kiosk.mjs` để biết IP thật.

### Mobile báo hết hạn QR dù vừa quét

Đồng hồ máy tính và điện thoại lệch nhau. Token dùng thời gian server
nên **giờ trên server** mới là chuẩn — kiểm tra timezone của project.
