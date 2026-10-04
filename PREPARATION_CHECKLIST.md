# 📋 CHECKLIST CHUẨN BỊ MÔI TRƯỜNG PHÁT TRIỂN

> **Dự án:** APES Lab Attendance System
> **Ngày tạo:** 03/10/2026
> **Mục đích:** Hướng dẫn các bước cần chuẩn bị trước khi bắt đầu code

---

## ✅ BƯỚC 1: Tạo tài khoản Supabase

### 1.1. Đăng ký Supabase
- [ ] Truy cập [supabase.com](https://supabase.com) → **Start your project**
- [ ] Đăng ký bằng GitHub (khuyến nghị) hoặc email
- [ ] **Tạo organization** mới (ví dụ: `APES Lab`)
- [ ] **Tạo project mới** với các thông tin:
  - **Name:** `apes-attendance` (hoặc tuỳ ý)
  - **Database Password:** Lưu vào **password manager** (1Password/Bitwarden), **KHÔNG dùng mật khẩu cá nhân** — đây là password root DB
  - **Region:** Singapore (`ap-southeast-1`) — gần Việt Nam nhất
  - **Plan:** Free (đủ dùng cho giai đoạn dev)

### 1.2. Lưu thông tin kết nối
Sau khi tạo project, vào **Project Settings → API**, copy và lưu lại:

| Thông tin | Mục đích | Lưu ở đâu |
|---|---|---|
| `Project URL` | URL gốc của project | File `.env` (sẽ tạo sau) |
| `anon public key` | Key cho client (web/app) | File `.env` |
| `service_role key` ⚠️ | Key cho server (admin), **TUYỆT ĐỐI KHÔNG lộ ra client** | File `.env` backend |
| `Project ID` | Dùng cho CLI | Ghi nhớ |

> ⚠️ **Cảnh báo:** `service_role` key bypass RLS — chỉ dùng trong Edge Functions / Backend, không bao giờ đưa vào Mobile/Desktop/Web client.

---

## ✅ BƯỚC 2: Cài đặt công cụ phát triển trên máy

### 2.1. Công cụ chung (bắt buộc)
- [ ] **Node.js 20+ LTS** — [nodejs.org](https://nodejs.org/)
  ```powershell
  node --version   # Kiểm tra ≥ v20
  npm --version
  ```
- [ ] **Git** — [git-scm.com](https://git-scm.com/) (đã có sẵn trên máy bạn)
- [ ] **Visual Studio Code** (đã có)
- [ ] **Cursor** (đang dùng) — IDE chính

### 2.2. Công cụ cho Desktop App
- [ ] **Rust** (nếu dùng Tauri) — [rustup.rs](https://rustup.rs/)
- [ ] **Visual Studio Build Tools** (Windows) — Cần thiết để compile Rust/Tauri
  - Tải tại [visualstudio.microsoft.com](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
  - Chọn workload: **"Desktop development with C++"**
- [ ] **WebView2 Runtime** — Thường có sẵn trên Windows 10/11

### 2.3. Công cụ cho Mobile App
- [ ] **Java JDK 17** (cho Android build) — [Adoptium](https://adoptium.net/)
- [ ] **Android Studio** — [developer.android.com](https://developer.android.com/studio)
  - Mở Android Studio → SDK Manager → cài:
    - Android SDK 34
    - Android SDK Build-Tools 34.0.0
    - Android SDK Platform-Tools
    - Android Emulator (tuỳ chọn)
- [ ] **Expo CLI** (nếu dùng React Native):
  ```powershell
  npm install -g expo-cli eas-cli
  ```

### 2.4. Công cụ cho Web Admin
- [ ] **Vercel CLI** (để deploy):
  ```powershell
  npm install -g vercel
  ```

### 2.5. Supabase CLI
```powershell
# Cài đặt Supabase CLI qua Scoop (Windows)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Hoặc dùng npm
npm install -g supabase
```

---

## ✅ BƯỚC 3: Khởi tạo Database Schema

### 3.1. Khởi tạo Supabase project local (khuyến nghị)
```powershell
# Trong thư mục project
cd D:\GitHub\Attendance_Check
npx supabase init          # Tạo folder supabase/
npx supabase login         # Đăng nhập Supabase
npx supabase link --project-ref <YOUR_PROJECT_ID>
```

### 3.2. Cấu trúc folder Supabase sẽ được tạo:
```
supabase/
├── migrations/             # File SQL thay đổi schema
│   └── 20261003_init.sql  # File đầu tiên
├── functions/              # Edge Functions (Deno)
├── seed.sql                # Dữ liệu mẫu
└── config.toml
```

### 3.3. Tạo Migration đầu tiên
Tôi sẽ chuẩn bị file `20261003_init_schema.sql` gồm:

- [ ] **Bảng `users`** (extend từ `auth.users`)
- [ ] **Bảng `groups`** (nhóm nghiên cứu)
- [ ] **Bảng `locations`** (cơ sở: HN, TP.HCM…)
- [ ] **Bảng `wifi_networks`** (Wi-Fi hợp lệ theo cơ sở)
- [ ] **Bảng `device_bindings`** (liên kết thiết bị của SV)
- [ ] **Bảng `sessions`** (buổi họp)
- [ ] **Bảng `attendance`** (bản ghi điểm danh)
- [ ] **Bảng `audit_logs`** (nhật ký)
- [ ] **Bảng `lab_settings`** (cấu hình chung)
- [ ] **RLS Policies** cho tất cả các bảng
- [ ] **Triggers & Functions**: tự động tạo `users` row khi có `auth.users` mới
- [ ] **Seed data**: import từ file `Danh sách thành viên APES Lab.csv`

### 3.4. Apply migration lên Supabase
```powershell
npx supabase db push
# Hoặc copy SQL vào Dashboard → SQL Editor → Run
```

---

## ✅ BƯỚC 4: Cấu hình Authentication

### 4.1. Trong Supabase Dashboard → Authentication → Providers
- [ ] **Email** — Bật mặc định
- [ ] **Tắt email confirmation** (tùy chọn, cho phép SV đăng ký nhanh)

### 4.2. Cấu hình JWT
- [ ] Vào **Authentication → Sign In / Up → JWT Settings**
- [ ] Thêm claim `role` và `group_id` vào app_metadata khi user được tạo (sẽ làm sau qua SQL trigger)

---

## ✅ BƯỚC 5: Cấu hình Storage (nếu cần upload ảnh)

- [ ] Tạo bucket `avatars` (private)
- [ ] Tạo bucket `attendance-evidence` (private)
- [ ] Cấu hình RLS cho storage

> 📌 *Theo yêu cầu hiện tại, chưa cần upload ảnh → có thể bỏ qua bước này*

---

## ✅ BƯỚC 6: Chuẩn bị dữ liệu mẫu

### 6.1. Import danh sách thành viên
File `Danh sách thành viên APES Lab.csv` của bạn có:
- 22 sinh viên
- 6 nhóm: Sạc pin, BESS, WPT động, WPT tĩnh, Plasma, BMS
- 1 Trưởng Lab: Nguyễn Trọng Quyết (MSSV 20232276)
- 6 Trưởng nhóm

### 6.2. Cấu trúc file CSV cần chuẩn hoá
```csv
stt,khoa,mssv,full_name,group_name,role
1,K68,20232447,Lê Huy Đức Anh,Sạc pin,group_leader
2,K69,202413026,Ngô Bình Nam,Sạc pin,student
...
12,K68,20232276,Nguyễn Trọng Quyết,Trưởng Lab,lab_leader
```

### 6.3. Tạo tài khoản cho sinh viên
- [ ] **Trưởng Lab & Chủ nghiệm:** Tạo thủ công qua Dashboard (chỉ 2 tài khoản)
- [ ] **Sinh viên & Trưởng nhóm:** Tạo hàng loạt qua SQL script (khi tôi viết script sẽ hướng dẫn)

---

## ✅ BƯỚC 7: Khởi tạo cấu trúc thư mục project

Đề xuất cấu trúc monorepo:

```
Attendance_Check/
├── apps/
│   ├── web-admin/          # Next.js 14 (Web quản lý)
│   ├── desktop/           # Tauri/Electron (App Windows)
│   └── mobile/            # React Native/Flutter (App Android)
├── packages/
│   ├── shared-types/      # TypeScript types dùng chung
│   ├── supabase-client/   # Supabase client config
│   └── ui-components/     # Components dùng chung
├── supabase/
│   ├── migrations/
│   ├── functions/
│   └── seed.sql
├── docs/
│   └── FUNCTIONAL_SPECIFICATION.md
├── .gitignore
├── package.json           # Root workspace
└── README.md
```

---

## ✅ BƯỚC 8: Cấu hình Git & GitHub

- [ ] Tạo file `.gitignore` ở root (loại trừ `node_modules`, `.env`, `dist`, `build`)
- [ ] Tạo file `.env.example` (template, không chứa giá trị thật)
- [ ] Commit & push lên GitHub

---

## ✅ BƯỚC 9: Setup tài khoản Deploy (khi sẵn sàng)

| Nền tảng | Cần thiết cho | Link |
|---|---|---|
| **Vercel** | Deploy Web Admin | [vercel.com](https://vercel.com) — đăng nhập bằng GitHub |
| **Google Play Console** | Publish Mobile App | [play.google.com/console](https://play.google.com/console) — cần **$25 phí 1 lần** |
| **Supabase** | Đã có ở Bước 1 | — |

> 💡 **Tip:** Vercel Free tier rất thoáng — phù hợp Web Admin. Google Play cần $25/lifetime.

---

## 🎯 THỨ TỰ ƯU TIÊN LÀM TRƯỚC

```
TUẦN 0 (ngay bây giờ):
  ✅ Bước 1: Tạo Supabase project
  ✅ Bước 2: Cài Node.js, Supabase CLI
  ✅ Bước 3: Tôi viết schema SQL → Bạn apply lên DB

TUẦN 1:
  ✅ Bước 4: Cấu hình Auth
  ✅ Bước 6: Import dữ liệu mẫu
  🔨 Bắt đầu code Web Admin (CRUD members, groups, locations, wifi)

TUẦN 2:
  🔨 Desktop App (xác thực MSSV + MAC binding)
  🔨 Mobile App (quét QR liên kết)
```

---

## ❓ BẠN CẦN TÔI HỖ TRỢ BƯỚC NÀO?

Tôi có thể giúp bạn:

1. **🟢 Bước 3:** Viết file migration SQL đầy đủ (schema + RLS + seed data) → bạn chỉ cần copy vào Supabase Dashboard chạy
2. **🟢 Bước 6:** Viết script SQL import từ file CSV của bạn vào bảng `users`
3. **🟢 Bước 7:** Khởi tạo cấu trúc monorepo với Turborepo / npm workspaces
4. **🟢 Bước 4:** Hướng dẫn cấu hình chi tiết trong Supabase Dashboard

> **Khuyến nghị:** Làm theo thứ tự ưu tiên ở trên. Khi bạn đã có **Bước 1 + 2** xong → báo lại cho tôi, tôi sẽ viết **Bước 3 (SQL schema)** ngay.

---

> 💬 **Lưu ý quan trọng:** Nếu bạn chưa quen với Supabase, có thể dùng **Supabase Cloud** (free) thay vì tự host — đỡ phải cài Docker, Postgres local.