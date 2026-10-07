# APES Lab Attendance System

> Hệ thống điểm danh cho sinh viên APES Lab - Học viện Công nghệ Bưu chính Viễn thông

## 📚 Tài liệu

- [FUNCTIONAL_SPECIFICATION.md](./FUNCTIONAL_SPECIFICATION.md) - Đặc tả chức năng chi tiết
- [SETUP_APPS.md](./SETUP_APPS.md) - **Hướng dẫn cài Desktop & Mobile App**
- [PREPARATION_CHECKLIST.md](./PREPARATION_CHECKLIST.md) - Checklist chuẩn bị môi trường

## 🏗️ Cấu trúc project

```
Attendance_Check/
├── apps/
│   ├── web-admin/              # Next.js 14 - Web quản lý (Trưởng Lab / CN Lab)
│   ├── desktop/                # Electron - App cá nhân cho mỗi SV ★ THIẾT BỊ CHÍNH
│   │   ├── src/main/           # main process: MAC/IP, session Registry, auto-update
│   │   ├── src/preload/        # contextBridge an toàn
│   │   └── src/renderer/       # React UI + TailwindCSS
│   └── mobile/                 # Expo (React Native) - App Android  ★ THIẾT BỊ PHỤ
│       └── src/
│           ├── screens/        # ScanScreen, HomeScreen, ProfileScreen
│           ├── context/        # AuthContext (auto-login)
│           ├── network.ts      # lấy IP Wi-Fi + Android ID
│           └── storage.ts      # SecureStore (Keystore)
├── packages/
│   └── shared-types/           # Logic dùng chung (build CJS + ESM)
├── supabase/
│   ├── migrations/
│   │   ├── 20261003_init_schema.sql
│   │   ├── 20261004_schedule.sql
│   │   ├── 20261005_attendance_config.sql
│   │   ├── 20261006_device_linking.sql   # kiosk + QR token + chống 2 lần/ngày
│   │   └── 20261007_personal_app.sql     # hostname, disk_serial, mobile_linked_at, reset RPC
│   ├── functions/
│   │   ├── _shared/            # cors, supabase client, time helpers
│   │   ├── verify-mssv/            # Xác thực MSSV + bind MAC + fingerprint
│   │   ├── generate-link-qr/       # Sinh QR liên kết Mobile (60s)
│   │   ├── claim-mobile-binding/   # Mobile đổi QR → session (đánh dấu mobile_linked_at)
│   │   └── check-attendance/       # Ghi nhận điểm danh
│   └── seed_members.sql
├── scripts/
│   └── inspect-kiosk.mjs       # Debug desktop app qua Chrome DevTools Protocol
├── tests/
│   └── shared-logic.test.ts    # Test subnet / cửa sổ điểm danh / QR
└── package.json                # npm workspaces
```

## 🔄 Luồng hoạt động

```
LẦN ĐẦU                              HÀNG NGÀY
─────────────────────────────         ─────────────────────────────
1. Tải .exe từ web-admin              1. Mở Desktop app
2. Nhập MSSV → bind MAC (Registry)    2. Auto vào Home (nhờ session)
3. Sinh QR 60s (1 lần duy nhất)       3. Nhấn "ĐIỂM DANH HÔM NAY"
4. Mobile quét QR                      4. Server kiểm IP ∈ Wi-Fi lab
5. Mobile lưu Android ID vĩnh viễn    5. Ghi attendance + beep ✓
                                       6. Ở lại Home (KHÔNG reset về nhập MSSV)
```

> **Phiên bản 0.2.0:** Desktop app là **app cá nhân** (1 SV = 1 laptop + 1 mobile).
> Phiên đăng nhập lưu trong **Windows Registry** (`HKCU\Software\APES-Lab\Kiosk`).
> Mobile sau khi liên kết sẽ **không bao giờ** hiện QR lại.

---

## 🚀 Setup nhanh

### 1. Cài đặt

```bash
npm install
npm run build --workspace=packages/shared-types   # bắt buộc cho Desktop
```

### 2. Database

1. Vào [Supabase Dashboard](https://supabase.com/dashboard) → chọn project
2. **SQL Editor** → chạy lần lượt các file trong `supabase/migrations/`
3. Chạy `supabase/seed_members.sql`

### 3. Cấu hình environment

```bash
copy apps\web-admin\.env.example apps\web-admin\.env.local
copy apps\desktop\.env.example   apps\desktop\.env
copy apps\mobile\.env.example    apps\mobile\.env
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Deploy Edge Functions

```bash
npm i -g supabase
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy verify-mssv
supabase functions deploy generate-link-qr
supabase functions deploy claim-mobile-binding
supabase functions deploy check-attendance
```

### 5. Cấu hình dữ liệu bắt buộc

> ⚠️ **Điểm danh sẽ bị từ chối nếu thiếu 2 thứ sau:**

1. **Wi-Fi lab** → Web Admin → Quản lý Wi-Fi (SSID + subnet, `is_active`)
2. **Lịch hôm nay** → Web Admin → Lịch Lab (`allow_checkin` + khung giờ)

### 6. Chạy app

```bash
npm run dev:web        # Web Admin  → http://localhost:3000
npm run dev:desktop    # Desktop Kiosk
npm run dev:mobile     # Mobile App (Expo)
```

Chi tiết cách đóng gói `.exe` và `.apk`: xem [SETUP_APPS.md](./SETUP_APPS.md)

---

## 🔐 Tài khoản mặc định

| Vai trò | MSSV | Email | Password |
|---------|------|-------|----------|
| CN Lab | 20232276 | 20232276@apes.edu.vn | 20232276 |
| Trưởng nhóm Sạc pin | 20232447 | 20232447@apes.edu.vn | 20232447 |
| Trưởng nhóm BESS | 20232016 | 20232016@apes.edu.vn | 20232016 |
| Trưởng nhóm WPT động | 20232066 | 20232066@apes.edu.vn | 20232066 |
| Trưởng nhóm BMS | 20231936 | 20231936@apes.edu.vn | 20231936 |

> ⚠️ **Quan trọng:** Tất cả mật khẩu mặc định = MSSV. Đổi ngay sau lần đăng nhập đầu!

> 🔒 **Sinh viên KHÔNG đăng nhập bằng mật khẩu.** Họ nhập MSSV trên kiosk
> và quét QR để liên kết điện thoại.

---

## 🧪 Kiểm thử

```bash
npm test                  # 20 test logic dùng chung
npm run typecheck         # cả 3 app
npm run check:functions   # Edge Functions (deno check + lint)
```

Kiểm tra kiosk đang chạy:

```bash
$env:KIOSK_FORCE_PROD = "1"
npx electron apps/desktop/dist/main/main.js --remote-debugging-port=9222
node scripts/inspect-kiosk.mjs --screenshot kiosk.png
```

---

## 📦 Tech Stack

| Thành phần | Công nghệ |
|------------|-----------|
| Backend | Supabase (PostgreSQL + Auth + RLS + Edge Functions) |
| Web Admin | Next.js 14 + TypeScript + TailwindCSS |
| Desktop Kiosk | Electron 33 + React + Vite + qrcode |
| Mobile | Expo SDK 52 (React Native) + expo-camera/network/secure-store |
| Shared | TypeScript (build CJS + ESM) |
| Kiểm thử | `node:test` + Deno check/lint |

---

## 🛣️ Roadmap

- [x] Database schema + RLS
- [x] Web Admin: Login + Dashboard
- [x] Web Admin: CRUD Members, Groups, Wi-Fi, Locations
- [x] Web Admin: Lịch Lab (khung giờ, cửa sổ điểm danh, ngày nghỉ)
- [x] Shared package: logic subnet / cửa sổ điểm danh / QR
- [x] Database: kiosk_devices, device_link_tokens, chống 2 lần/ngày
- [x] Edge Functions: verify-mssv, generate-link-qr, claim-mobile-binding, check-attendance
- [x] Desktop App: nhập MSSV + MAC binding + QR liên kết + điểm danh + kiosk mode
- [x] Mobile App: quét QR + liên kết + điểm danh Wi-Fi + hồ sơ
- [x] **Desktop v0.2.0: App cá nhân, lưu session Registry, auto-update từ GitHub**
- [x] **Web Admin: Quản lý & reset device bindings**
- [ ] Desktop: chống VM/MAC spoofing nâng cao (BSSID check)
- [ ] Web Admin: báo cáo & thống kê (F-RPT-01..09)
- [ ] Build `.exe` + `.apk`, đăng Google Play / GitHub Releases

---

## 📝 License

Internal use only - APES Lab, PTIT
