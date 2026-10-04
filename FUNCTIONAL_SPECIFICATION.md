# APES Lab - Hệ thống Điểm danh

> **Tên dự án:** APES Lab Attendance System
> **Phiên bản tài liệu:** 1.1
> **Ngày cập nhật:** 03/10/2026
> **Mục đích:** Điểm danh & quản lý sinh viên trong APES Lab (Học viện Công nghệ Bưu chính Viễn thông)

---

## 1. Tổng quan dự án

### 1.1. Bối cảnh
APES Lab là phòng thí nghiệm với nhiều nhóm nghiên cứu (Sạc pin, BESS, WPT động, WPT tĩnh, Plasma, BMS…). Hiện tại việc điểm danh sinh viên tham gia các buổi họp/nghiên cứu tại lab vẫn thủ công, chưa có hệ thống số hóa tập trung, gây khó khăn trong việc:
- Theo dõi sự tham gia thực tế của từng sinh viên
- Thống kê tỷ lệ chuyên cần theo nhóm/cá nhân
- Quản lý lịch hoạt động, lịch họp giữa các nhóm
- Xuất báo cáo phục vụ đánh giá cuối kỳ

### 1.2. Mục tiêu
Xây dựng một hệ thống điểm danh số hóa, **đa nền tảng**, tập trung dữ liệu trên **Supabase**, gồm:
- **Desktop App (.exe – Windows)** – **THIẾT BỊ CHÍNH** đặt tại lab. Đây là điểm xác thực ban đầu cho mỗi sinh viên.
- **Mobile App (Android – Google Play)** – **PHỤ**, chỉ dùng sau khi sinh viên đã được xác thực trên Desktop.
- **Web App quản lý** dành cho **Trưởng Lab** và **Chủ nghiệm Lab** để cấu hình & giám sát.

### 1.3. Triết lý thiết kế (quan trọng)

> **Desktop là "cổng xác thực vật lý"**, **Mobile là "thiết bị điểm danh tiện lợi"** đã được Desktop "bảo chứng".

- **Bước 1 – Xác thực lần đầu (Desktop):** Sinh viên phải nhập **MSSV** trên **Desktop App** tại lab. Hệ thống xác nhận MSSV hợp lệ với lab, lưu **địa chỉ MAC của máy Desktop** vào cơ sở dữ liệu gắn với tài khoản sinh viên.
- **Bước 2 – Mobile khởi động (lần đầu trên điện thoại):** Mobile App **không thể tự đăng nhập**. Sinh viên phải quét **mã QR sinh viên** (do Desktop tạo ngay sau khi xác thực ở Bước 1) bằng Mobile App để liên kết tài khoản.
- **Bước 3 – Điểm danh hằng ngày:**
  - **Tại lab:** dùng Desktop App (nhập MSSV + check IP Wi-Fi lab) **hoặc** Mobile App (đã liên kết ở Bước 2 + cùng Wi-Fi lab).
  - **Ở xa:** không điểm danh được, vì bắt buộc cùng Wi-Fi lab.

### 1.4. Đối tượng sử dụng

| Vai trò | Nền tảng | Quyền hạn |
|---|---|---|
| **Sinh viên** (Student) | Windows Desktop (chính) + Android Mobile (phụ) | Xác thực ban đầu trên Desktop, điểm danh trên cả 2 (chỉ khi cùng Wi-Fi lab), xem lịch sử cá nhân |
| **Trưởng nhóm** (Group Leader) | Windows Desktop + Web | Như sinh viên + xem điểm danh của nhóm mình, tạo buổi họp nhóm |
| **Trưởng Lab** (Lab Leader) | Web | Cấu hình Wi-Fi lab, quản lý nhóm/buổi họp, xem báo cáo, duyệt điểm danh |
| **Chủ nghiệm Lab** (Lab Manager) | Web | Toàn quyền quản trị hệ thống |

---

## 2. Kiến trúc hệ thống

### 2.1. Sơ đồ tổng quan

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE (Backend)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │PostgreSQL│ │   Auth   │ │ Storage  │ │   Realtime   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌─────────────────────────┐     │
│  │   RLS    │ │ Edge Fn  │ │  Row Level Security     │     │
│  └──────────┘ └──────────┘ └─────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
        ▲                  ▲                    ▲
        │                  │                    │
        │                  │                    │
┌───────┴──────┐  ┌────────┴────────┐  ┌────────┴────────┐
│  Mobile App  │  │  Desktop App    │  │   Web Admin     │
│  (Android)   │  │  (Windows .exe) │  │   (Browser)     │
│  - PHỤ      │  │  - CHÍNH ★     │  │  - Next.js /    │
│  - Phải qr.  │  │  - Xác thực SV │  │    React +      │
│    QR từ    │  │  - Lưu MAC    │  │    TailwindCSS  │
│    Desktop   │  │  - Cấu hình    │  │  - Quản trị     │
│    mới đăng │  │    Wi-Fi lab   │  │    Wi-Fi lab    │
│    nhập được │  │  - Kiosk mode │  │                  │
└──────────────┘  └────────────────┘  └─────────────────┘
   Sinh viên      Sinh viên / kiosk    Trưởng Lab / CN Lab
                  (ĐĂNG KÝ ĐẦU TIÊN)
```

### 2.2. Tech Stack đề xuất

| Thành phần | Công nghệ | Lý do |
|---|---|---|
| **Backend / DB** | Supabase (PostgreSQL) | Yêu cầu đề bài, có sẵn Auth, RLS, Realtime, Storage |
| **Mobile App** | React Native (Expo) hoặc Flutter | Dễ build APK/AAB → đăng Google Play |
| **Desktop App** | Electron hoặc Tauri (đóng gói `.exe`) | Dễ đọc MAC address qua Node.js API / Rust |
| **Web Admin** | Next.js 14 (App Router) + TypeScript | SEO tốt, deploy Vercel miễn phí |
| **UI Library** | TailwindCSS + shadcn/ui | Giao diện hiện đại, dễ customize |
| **State Mgmt** | Zustand / TanStack Query | Nhẹ, phù hợp React ecosystem |
| **QR Code** | `qrcode` + `html5-qrcode` / `react-native-qrcode-scanner` | Generate trên Desktop, scan trên Mobile |
| **Đọc MAC Address** | `node-macaddress` (Desktop) hoặc PowerShell `Get-NetAdapter` | Định danh máy Desktop tại lab |
| **Lấy IP hiện tại** | Native: `os.networkInterfaces()` (Desktop), `react-native-network-info` (Mobile) | Xác thực đang cùng Wi-Fi lab |

---

## 3. Phân quyền người dùng (RBAC)

### 3.1. Cấu trúc phân quyền

```
Chủ nghiệm Lab (admin)
    ├── Toàn quyền CRUD trên tất cả dữ liệu
    ├── Quản lý tài khoản, phân quyền
    ├── Cấu hình Wi-Fi lab, danh sách IP/subnet hợp lệ
    └── Cài đặt hệ thống

Trưởng Lab (lab_leader)
    ├── Xem toàn bộ báo cáo, thống kê
    ├── Cấu hình Wi-Fi lab (đề xuất) / hoặc chỉ xem
    ├── Duyệt điểm danh bất thường
    ├── Tạo/sửa lịch họp toàn lab
    └── Reset liên kết thiết bị cho sinh viên (khi SV mất máy)

Trưởng nhóm (group_leader)
    ├── Như quyền sinh viên
    ├── Xem & quản lý điểm danh thành viên trong nhóm mình
    ├── Tạo buổi họp nhóm
    └── Không thể xem dữ liệu nhóm khác

Sinh viên (student)
    ├── Xác thực ban đầu trên Desktop (nhập MSSV)
    ├── Liên kết Mobile qua quét QR từ Desktop
    ├── Điểm danh trên Desktop HOẶC Mobile (đều phải cùng Wi-Fi lab)
    ├── Xem lịch sử điểm danh cá nhân
    └── KHÔNG được đăng xuất sau khi đăng nhập
```

### 3.2. Quy tắc đăng nhập & thiết bị (quan trọng)

- **Desktop App tại lab:** Mỗi máy Desktop là **một kiosk cố định**, có địa chỉ MAC duy nhất. Sinh viên không đăng nhập Desktop bằng tài khoản – thay vào đó nhập **MSSV** để xác nhận danh tính. Hệ thống tự liên kết MSSV với MAC của máy Desktop.
- **Mobile App:** Sau khi Desktop xác nhận, Desktop sinh ra **mã QR liên kết** (chứa user_id + signed token, TTL 60s). Sinh viên dùng Mobile quét mã này để đăng nhập Mobile lần đầu.
- **Sau khi đăng nhập:** Cả Desktop và Mobile **không có nút đăng xuất**. Nếu cần đăng xuất (mất máy, bị hack…), chỉ có Trưởng Lab mới reset được qua Web Admin.
- **Chống gian lận:**
  - Mỗi tài khoản sinh viên chỉ liên kết được **1 Mobile + 1 Desktop (theo MAC)**.
  - Nếu sinh viên gỡ app rồi cài lại → vẫn lấy lại được session (lưu local) nhưng **không thể liên kết MAC mới** mà không có sự cho phép của Trưởng Lab.
  - Khi Desktop nhận MSSV của sinh viên, MAC đã lưu **phải khớp** với MAC máy hiện tại → nếu không khớp, từ chối (đề phòng SV điểm danh từ máy khác).

---

## 4. Chức năng chi tiết

### 4.1. 💻 Desktop App (Windows .exe – THIẾT BỊ CHÍNH tại lab)

> Đây là máy tính đặt cố định tại lab. Chạy ở chế độ kiosk. Đây là nơi sinh viên xác thực lần đầu và điểm danh hằng ngày.

#### 4.1.1. Xác thực ban đầu (MSSV – quan trọng nhất)

- **F-DESK-AUTH-01:** Lần đầu mở Desktop App, hiển thị màn hình "**Nhập MSSV để xác thực**".
- **F-DESK-AUTH-02:** Sinh viên nhập MSSV → hệ thống kiểm tra:
  - MSSV có tồn tại trong bảng `users` không
  - Sinh viên có thuộc lab không
  - Sinh viên đã liên kết MAC nào chưa
- **F-DESK-AUTH-03:** Sau khi xác nhận hợp lệ, hệ thống **tự động lưu MAC address** của máy Desktop hiện tại vào `users.desktop_mac` (hoặc bảng `device_bindings`).
- **F-DESK-AUTH-04:** Nếu sinh viên đã liên kết MAC trước đó:
  - MAC khớp → cho vào thẳng (không cần nhập lại).
  - MAC không khớp → **từ chối**, hiển thị "Bạn đã liên kết với một máy khác. Liên hệ Trưởng Lab để reset."
- **F-DESK-AUTH-05:** Ngay sau khi xác thực thành công, Desktop sinh ra **QR Code liên kết Mobile** (TTL 60s). Sinh viên dùng Mobile quét để đăng nhập Mobile lần đầu.
- **F-DESK-AUTH-06:** Desktop KHÔNG có tài khoản đăng nhập riêng – chỉ có 1 chế độ kiosk duy nhất. Chỉ Trưởng Lab mới thoát được kiosk bằng **mã PIN** (F-DESK-08).

#### 4.1.2. Điểm danh hằng ngày

- **F-DESK-ATT-01:** Sau khi xác thực, Desktop hiển thị nút lớn "**Điểm danh hôm nay**".
- **F-DESK-ATT-02:** Khi sinh viên nhấn, hệ thống tự động:
  - Lấy IP hiện tại của máy Desktop (đang kết nối Wi-Fi lab).
  - So sánh IP với danh sách **Wi-Fi/subnet hợp lệ** đã cấu hình trên Web Admin.
  - Nếu IP thuộc subnet lab → ghi nhận điểm danh `method = 'desktop'`.
  - Nếu IP không thuộc subnet lab → từ chối, hiển thị "Không phát hiện kết nối Wi-Fi lab".
- **F-DESK-ATT-03:** Hiển thị trạng thái điểm danh hôm nay (✓ đã điểm danh lúc HH:mm / ✗ chưa).
- **F-DESK-ATT-04:** Sau khi điểm danh thành công: tiếng beep + hiển thị tên SV + thời gian.
- **F-DESK-ATT-05:** Không cho phép điểm danh 2 lần trong cùng 1 ngày (theo session/buổi họp).

#### 4.1.3. Giao diện kiosk

- **F-DESK-KIOSK-01:** Chạy ở chế độ **kiosk** (fullscreen, không thoát được bằng Alt+F4).
- **F-DESK-KIOSK-02:** Hiển thị thời gian thực, ngày giờ, lịch họp hôm nay (nếu có).
- **F-DESK-KIOSK-03:** Khởi động cùng Windows (auto-start).
- **F-DESK-KIOSK-04:** Chế độ nền (screensaver) khi không có ai tương tác 30 giây.
- **F-DESK-KIOSK-05:** Tự động quay về màn hình nhập MSSV sau khi điểm danh xong 5 giây.
- **F-DESK-KIOSK-06:** Chỉ Trưởng Lab mới thoát được chế độ kiosk (nhập mã PIN).
- **F-DESK-KIOSK-07:** Hiển thị QR Code liên kết Mobile trong 60 giây sau khi SV xác thực.

#### 4.1.4. Cấu hình Desktop (chỉ Trưởng Lab qua PIN)

- **F-DESK-CFG-01:** Cấu hình URL Supabase, API key.
- **F-DESK-CFG-02:** Đổi mã PIN thoát kiosk.
- **F-DESK-CFG-03:** Xem MAC address hiện tại của máy.
- **F-DESK-CFG-04:** Test kết nối tới Supabase.

---

### 4.2. 📱 Mobile App (Android – THIẾT BỊ PHỤ)

> Mobile chỉ là phương tiện điểm danh tiện lợi, **không thể tự đăng nhập** nếu chưa được Desktop xác thực.

#### 4.2.1. Xác thực (chỉ 1 lần duy nhất)

- **F-MOB-AUTH-01:** Lần đầu mở Mobile App → hiển thị màn hình "**Quét QR từ Desktop App tại lab để đăng nhập**".
- **F-MOB-AUTH-02:** Mobile dùng camera quét QR Code liên kết do Desktop sinh ra (sau khi SV nhập MSSV).
- **F-MOB-AUTH-03:** QR chứa: `user_id`, `signed_token`, `desktop_mac`. Mobile gửi token + device_id (Android ID) lên server để xác nhận.
- **F-MOB-AUTH-04:** Sau khi xác thực thành công:
  - Lưu `user_id` + `auth_token` vào **secure storage** (Keychain/Keystore).
  - Lưu `device_id` của Mobile vào bảng `device_bindings`.
  - **KHÔNG có nút đăng xuất** – một khi đã liên kết, dùng mãi mãi cho đến khi Trưởng Lab reset.
- **F-MOB-AUTH-05:** Nếu sinh viên gỡ app rồi cài lại:
  - App phát hiện còn secure storage → tự động đăng nhập lại.
  - Nếu secure storage bị xoá (do factory reset…) → app yêu cầu quét QR từ Desktop lại, **nhưng Trưởng Lab phải duyệt** (vì user đã có device binding cũ).
- **F-MOB-AUTH-06:** Từ lần thứ 2 trở đi: tự động vào màn hình chính (auto-login).
- **F-MOB-AUTH-07:** **Không có chức năng đăng xuất** trên Mobile.

#### 4.2.2. Điểm danh (phải cùng Wi-Fi lab)

- **F-MOB-ATT-01:** Màn hình chính hiển thị nút lớn "**Điểm danh**".
- **F-MOB-ATT-02:** Khi nhấn, app tự động:
  - Lấy **địa chỉ IP hiện tại** của điện thoại (qua Wi-Fi).
  - Gửi IP + user_id + device_id lên server.
  - Server kiểm tra IP có thuộc **subnet Wi-Fi lab** đã cấu hình không.
  - Nếu khớp → ghi nhận điểm danh `method = 'mobile_wifi'`.
  - Nếu không khớp → từ chối, hiển thị "Vui lòng kết nối Wi-Fi lab để điểm danh".
- **F-MOB-ATT-03:** Hiển thị trạng thái điểm danh hôm nay.
- **F-MOB-ATT-04:** App lưu lại IP của lần điểm danh gần nhất, hiển thị lên UI để sinh viên tự kiểm tra.
- **F-MOB-ATT-05:** Không cho phép điểm danh 2 lần trong cùng 1 ngày.
- **F-MOB-ATT-06:** Không cho phép điểm danh nếu IP đến từ **cellular/4G** (chỉ chấp nhận Wi-Fi).

#### 4.2.3. Xem thông tin cá nhân

- **F-MOB-PROF-01:** Xem thông tin cá nhân (Họ tên, MSSV, Nhóm, Khóa) – **chỉ đọc, không sửa**.
- **F-MOB-PROF-02:** Xem tổng quan chuyên cần (số buổi có mặt/vắng, tỷ lệ %).
- **F-MOB-PROF-03:** Xem trạng thái thiết bị liên kết (Desktop MAC + Mobile device ID + ngày liên kết).
- **F-MOB-PROF-04:** Xem thông báo "Đã điểm danh bằng thiết bị nào, lúc nào" trong ngày.

> 📌 **Lưu ý:** Theo yêu cầu, **đã bỏ phần Cập nhật số điện thoại, avatar** trên Mobile App.

#### 4.2.4. Lịch sử & báo cáo

- **F-MOB-HIS-01:** Xem lịch sử điểm danh theo tháng/quý.
- **F-MOB-HIS-02:** Lọc theo trạng thái (Có mặt / Vắng / Đi trễ / Có phép).
- **F-MOB-HIS-03:** Xuất lịch sử điểm danh cá nhân ra file PDF/Excel.
- **F-MOB-HIS-04:** Hiển thị thiết bị đã dùng để điểm danh mỗi buổi (Desktop hay Mobile).

#### 4.2.5. Lịch & thông báo 🚧 *(Đang phát triển)*

> Tính năng này tạm thời **chưa phát triển** do chưa có dữ liệu lịch họp thực tế. Sẽ được bổ sung sau khi Web Admin có dữ liệu buổi họp.

- **F-MOB-CAL-01:** *[Đang phát triển]* Xem lịch họp/hoạt động sắp tới.
- **F-MOB-CAL-02:** *[Đang phát triển]* Đăng ký tham gia buổi họp.
- **F-MOB-NOTI-01:** *[Đang phát triển]* Nhận thông báo đẩy khi có lịch họp mới.
- **F-MOB-NOTI-02:** *[Đang phát triển]* Nhắc nhở trước giờ họp 15 phút.

---

### 4.3. 🌐 Web Admin (Trưởng Lab & Chủ nghiệm Lab)

#### 4.3.1. Dashboard
- **F-DASH-01:** Tổng quan số liệu: Tổng SV / Có mặt hôm nay / Vắng / Đi trễ.
- **F-DASH-02:** Biểu đồ tỷ lệ chuyên cần theo nhóm (bar chart).
- **F-DASH-03:** Biểu đồ xu hướng điểm danh 7 ngày/30 ngày (line chart).
- **F-DASH-04:** Danh sách buổi họp sắp tới.
- **F-DASH-05:** Hoạt động gần đây (audit log).
- **F-DASH-06:** Thống kê số sinh viên đang online trên Wi-Fi lab (realtime).

#### 4.3.2. Quản lý Wi-Fi lab (Dashboard cấu hình – MỚI)

> Module này thay thế "Cấu hình GPS" cũ. Cho phép quản trị viên thêm các cơ sở (nhiều lab/chi nhánh) với các trường Wi-Fi tương ứng.

- **F-WIFI-01:** Danh sách các **cơ sở** (locations): Hà Nội, TP.HCM, Cơ sở 2…
- **F-WIFI-02:** Thêm/sửa/xoá cơ sở (tên, địa chỉ, ghi chú).
- **F-WIFI-03:** Với mỗi cơ sở, quản lý danh sách **Wi-Fi hợp lệ**:
  - SSID (tên Wi-Fi)
  - Subnet hoặc dải IP cho phép (ví dụ: `192.168.1.0/24`, `10.0.0.0/16`)
  - Gateway mặc định (optional, để kiểm tra thêm)
  - BSSID/MAC của router (optional, tăng độ chính xác)
- **F-WIFI-04:** Đánh dấu Wi-Fi nào đang là **Wi-Fi chính** của lab.
- **F-WIFI-05:** Bật/tắt một Wi-Fi (không xoá để giữ lịch sử).
- **F-WIFI-06:** Test kết nối: paste một IP vào form để kiểm tra có thuộc subnet không.
- **F-WIFI-07:** Lịch sử các lần IP không hợp lệ (audit log).

#### 4.3.3. Quản lý thiết bị & xác thực (MỚI)

- **F-DEV-01:** Danh sách **Desktop kiosk**: địa chỉ MAC, vị trí, trạng thái online/offline, ngày active gần nhất.
- **F-DEV-02:** Danh sách **Mobile device** của từng sinh viên: Android ID, ngày liên kết, ngày dùng gần nhất.
- **F-DEV-03:** **Reset liên kết Mobile** cho sinh viên (khi SV mất máy, gỡ app, đổi điện thoại). Sau khi reset, SV phải quét QR lại.
- **F-DEV-04:** **Reset liên kết Desktop** cho sinh viên (khi đổi máy kiosk). Sau khi reset, SV phải nhập MSSV lại trên Desktop mới.
- **F-DEV-05:** Xem chi tiết: SV nào đang liên kết với thiết bị nào.
- **F-DEV-06:** Phát hiện xung đột: nếu 1 SV có >1 Desktop MAC → cảnh báo.

#### 4.3.4. Quản lý thành viên
- **F-MEM-01:** Danh sách thành viên (bảng, filter, search, phân trang).
- **F-MEM-02:** Thêm thành viên mới (nhập tay hoặc import CSV).
- **F-MEM-03:** Sửa thông tin thành viên (Họ tên, MSSV, Khóa, Nhóm, Vai trò).
- **F-MEM-04:** Xoá thành viên (soft delete).
- **F-MEM-05:** Import hàng loạt từ CSV.
- **F-MEM-06:** Xuất danh sách ra CSV/Excel.
- **F-MEM-07:** Reset toàn bộ liên kết thiết bị của một SV.
- **F-MEM-08:** Phân quyền (gán role).
- **F-MEM-09:** Chuyển nhóm.

#### 4.3.5. Quản lý nhóm
- **F-GRP-01:** Danh sách các nhóm nghiên cứu.
- **F-GRP-02:** Tạo/sửa/xoá nhóm.
- **F-GRP-03:** Gán trưởng nhóm.
- **F-GRP-04:** Xem thành viên trong từng nhóm.
- **F-GRP-05:** Thống kê tỷ lệ chuyên cần theo nhóm.

#### 4.3.6. Quản lý buổi họp / hoạt động
- **F-SES-01:** Tạo buổi họp mới (tiêu đề, thời gian, địa điểm, nhóm).
- **F-SES-02:** Sửa/xoá buổi họp.
- **F-SES-03:** Xem danh sách buổi họp (calendar view + list view).
- **F-SES-04:** Lọc buổi họp theo nhóm / theo thời gian.
- **F-SES-05:** Tạo buổi họp định kỳ (recurring).
- **F-SES-06:** Đóng/mở điểm danh cho buổi họp.

#### 4.3.7. Quản lý điểm danh
- **F-ADM-01:** Xem danh sách điểm danh theo buổi họp.
- **F-ADM-02:** Xem chi tiết: ai có mặt, vắng, đi trễ, có phép.
- **F-ADM-03:** Duyệt điểm danh bất thường.
- **F-ADM-04:** Sửa trạng thái điểm danh thủ công.
- **F-ADM-05:** Lọc theo **phương thức điểm danh** (desktop / mobile_wifi).
- **F-ADM-06:** Import điểm danh từ Excel.
- **F-ADM-07:** Tìm kiếm điểm danh theo tên/MSSV/nhóm/ngày.
- **F-ADM-08:** Realtime cập nhật khi có người điểm danh mới.

#### 4.3.8. Báo cáo & thống kê
- **F-RPT-01:** Báo cáo tổng hợp chuyên cần theo cá nhân.
- **F-RPT-02:** Báo cáo chuyên cần theo nhóm.
- **F-RPT-03:** Báo cáo chuyên cần theo buổi họp.
- **F-RPT-04:** Báo cáo theo khoảng thời gian (tuần/tháng/quý/năm).
- **F-RPT-05:** Top 10 sinh viên chuyên cần nhất / kém nhất.
- **F-RPT-06:** Biểu đồ heatmap điểm danh.
- **F-RPT-07:** Xuất báo cáo PDF/Excel.
- **F-RPT-08:** Báo cáo theo **phương thức điểm danh** (bao nhiêu % dùng Desktop, bao nhiêu % dùng Mobile).
- **F-RPT-09:** Báo cáo theo cơ sở (location).

#### 4.3.9. Cài đặt hệ thống (chỉ Chủ nghiệm)
- **F-SET-01:** Cấu hình thông tin lab (tên, logo, địa chỉ).
- **F-SET-02:** Cấu hình thời gian cho phép đi trễ.
- **F-SET-03:** Cấu hình giờ điểm danh tự động hằng ngày.
- **F-SET-04:** Backup/restore dữ liệu.
- **F-SET-05:** Xem audit log (nhật ký hoạt động).
- **F-SET-06:** Quản lý mã PIN thoát kiosk của Desktop.

---

## 5. Cơ sở dữ liệu (Supabase – PostgreSQL)

### 5.1. Sơ đồ quan hệ chính

```
locations (id, name, address, is_active, ...)
    │
    └── location_id ──► wifi_networks (id, location_id, ssid, subnet, gateway, bssid, is_active, ...)

users (id, mssv, full_name, email, khoa, group_id, role, ...)
    │
    ├── group_id ──► groups (id, name, leader_id, description, ...)
    │
    └── id ──► device_bindings (id, user_id, kind ['desktop'|'mobile'],
                                   device_identifier,    -- desktop: MAC, mobile: Android ID
                                   bound_at, last_seen_at, status ['active'|'reset'],
                                   reset_by, reset_at)
    
sessions (id, title, start_time, end_time, location_id, group_id, status, ...)
    │
    ├── location_id ──► locations
    └── group_id ──► groups

attendance (id, user_id, session_id, check_in_time,
            method ['desktop'|'mobile_wifi'|'manual_admin'],
            ip_address, subnet_matched, location_id,
            status ['present'|'absent'|'late'|'excused'],
            note, approved_by, ...)
    │
    ├── user_id ──► users
    ├── session_id ──► sessions
    └── location_id ──► locations

audit_logs (id, actor_id, action, entity, entity_id, payload, ip_address, created_at)
```

### 5.2. Các bảng chi tiết

| Bảng | Mô tả | Trường chính |
|---|---|---|
| `users` | Mở rộng từ `auth.users` | `mssv`, `full_name`, `khoa`, `group_id`, `role` |
| `groups` | Nhóm nghiên cứu | `name`, `leader_id`, `description` |
| `locations` | Các cơ sở của lab (Hà Nội, TP.HCM…) | `name`, `address`, `is_active` |
| `wifi_networks` | Wi-Fi hợp lệ cho mỗi cơ sở | `location_id`, `ssid`, `subnet`, `gateway`, `is_active` |
| `device_bindings` | Liên kết thiết bị của SV | `user_id`, `kind`, `device_identifier` (MAC hoặc Android ID), `status` |
| `sessions` | Buổi họp / hoạt động | `title`, `start_time`, `end_time`, `location_id`, `group_id` |
| `attendance` | Bản ghi điểm danh | `user_id`, `session_id`, `check_in_time`, `method`, `ip_address`, `subnet_matched`, `location_id`, `status` |
| `audit_logs` | Nhật ký thao tác | `actor_id`, `action`, `entity`, `payload`, `ip_address` |
| `lab_settings` | Cấu hình chung (single row) | `lab_name`, `late_threshold`, `kiosk_pin_hash` |

### 5.3. Ví dụ schema quan trọng

```sql
-- Bảng cơ sở
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                     -- "Cơ sở Hà Nội", "Cơ sở TP.HCM"
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bảng Wi-Fi lab
CREATE TABLE wifi_networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  ssid TEXT NOT NULL,                     -- Tên Wi-Fi: "APES-Lab-HN"
  subnet CIDR NOT NULL,                   -- '192.168.1.0/24'
  gateway INET,                           -- '192.168.1.1' (optional)
  bssid MACADDR,                          -- MAC router (optional, tăng chính xác)
  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bảng liên kết thiết bị
CREATE TABLE device_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('desktop', 'mobile')),
  device_identifier TEXT NOT NULL,        -- Desktop: MAC, Mobile: Android ID
  bound_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'reset', 'revoked')),
  reset_by UUID REFERENCES users(id),
  reset_at TIMESTAMPTZ,
  reset_reason TEXT,
  UNIQUE(user_id, kind)                   -- Mỗi SV chỉ có 1 desktop + 1 mobile
);

-- Bảng điểm danh
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  session_id UUID REFERENCES sessions(id),
  check_in_time TIMESTAMPTZ DEFAULT now(),
  method TEXT NOT NULL CHECK (method IN ('desktop', 'mobile_wifi', 'manual_admin')),
  ip_address INET,
  subnet_matched UUID REFERENCES wifi_networks(id),
  location_id UUID REFERENCES locations(id),
  status TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  note TEXT,
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 5.4. Edge Function xác thực Wi-Fi (mẫu)

```typescript
// supabase/functions/check-attendance/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { user_id, ip_address, method, device_id } = await req.json();
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, ...);

  // 1. Kiểm tra user tồn tại
  // 2. Kiểm tra device binding còn active và khớp
  // 3. Tìm wifi_network có subnet chứa ip_address và is_active
  const { data: matchedWifi } = await supabase
    .from("wifi_networks")
    .select("id, location_id")
    .eq("is_active", true)
    .contains("subnet", ip_address)        // PostgreSQL: inet 'ip' << subnet
    .maybeSingle();

  if (!matchedWifi) {
    return new Response(
      JSON.stringify({ error: "IP không thuộc Wi-Fi lab hợp lệ" }),
      { status: 403 }
    );
  }

  // 4. Insert điểm danh
  // ...
  return new Response(JSON.stringify({ success: true, location_id: matchedWifi.location_id }));
});
```

### 5.5. Chính sách RLS (ví dụ)

```sql
-- Sinh viên chỉ xem được điểm danh của chính mình
CREATE POLICY "Students can view own attendance"
ON attendance FOR SELECT
USING (auth.uid() = user_id);

-- Trưởng nhóm xem được điểm danh của thành viên trong nhóm mình
CREATE POLICY "Group leaders can view group attendance"
ON attendance FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = attendance.user_id
      AND u.group_id = (SELECT group_id FROM users WHERE id = auth.uid())
      AND (SELECT role FROM users WHERE id = auth.uid()) = 'group_leader'
  )
);

-- Trưởng Lab & Chủ nghiệm: full quyền
CREATE POLICY "Lab leaders can manage all attendance"
ON attendance FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
      AND role IN ('lab_leader', 'lab_manager')
  )
);

-- Device binding: SV chỉ xem được của mình, Trưởng Lab/Manager xem được tất cả
CREATE POLICY "Users view own device bindings"
ON device_bindings FOR SELECT
USING (auth.uid() = user_id);
```

---

## 6. Luồng hoạt động chính (User Flow)

### 6.1. Luồng xác thực ban đầu & liên kết thiết bị (MỚI)

```
LẦN ĐẦU TIÊN – Desktop là nơi xác thực
1. Sinh viên đến lab, đứng trước Desktop kiosk
2. Desktop hiển thị: "Nhập MSSV để bắt đầu"
3. Sinh viên nhập MSSV → Enter
4. Desktop app:
   a. Đọc MAC address của card mạng đang kết nối Wi-Fi lab
   b. Gọi Edge Function verify-mssv(mssv)
   c. Kiểm tra MSSV có trong bảng users không
   d. Kiểm tra users đã có device_bindings kind='desktop' chưa
      - Chưa có → INSERT binding với MAC hiện tại
      - Có rồi + MAC khớp → cho vào
      - Có rồi + MAC không khớp → TỪ CHỐI
5. Desktop sinh ra QR Code liên kết (chứa user_id + signed token, TTL 60s)
6. Sinh viên dùng Mobile App quét QR này
7. Mobile gửi token + Android ID lên server
8. Server INSERT device_bindings kind='mobile'
9. Cả Desktop và Mobile đều sẵn sàng điểm danh
```

### 6.2. Luồng điểm danh trên Desktop (hằng ngày)

```
1. Sinh viên đến lab, Desktop đang ở màn hình nhập MSSV
2. Sinh viên nhập MSSV
3. Desktop verify MAC khớp với binding → cho vào màn hình chính
4. Sinh viên nhấn nút "Điểm danh"
5. Desktop lấy IP hiện tại → gửi lên server
6. Server check IP ∈ wifi_networks.is_active
7. Nếu OK → INSERT attendance (method='desktop', ip_address, subnet_matched, location_id)
8. Desktop hiển thị "✓ [Tên SV] - Đã điểm danh lúc HH:mm" + tiếng beep
9. Sau 5 giây → tự quay về màn hình nhập MSSV
```

### 6.3. Luồng điểm danh trên Mobile (hằng ngày)

```
1. Sinh viên đến lab, mở Mobile App
2. App auto-login (không cần nhập gì)
3. App hiển thị nút "Điểm danh"
4. Sinh viên nhấn nút
5. App lấy IP hiện tại của Wi-Fi (KHÔNG lấy IP cellular)
6. App gửi: user_id + ip_address + device_id
8. Server check IP ∈ wifi_networks.is_active
9. Nếu OK → INSERT attendance (method='mobile_wifi')
10. App hiển thị "Điểm danh thành công lúc HH:mm"
11. Nếu IP không khớp → "Vui lòng kết nối Wi-Fi lab"
```

### 6.4. Luồng Reset thiết bị (Trưởng Lab)

```
1. Sinh viên báo mất máy / cần reset
2. Trưởng Lab vào Web Admin → "Quản lý thiết bị"
3. Tìm sinh viên → nhấn "Reset Mobile" hoặc "Reset Desktop"
4. Nhập lý do → UPDATE device_bindings SET status='reset', reset_by, reset_at
5. Sinh viên phải quét QR lại (mobile) hoặc nhập MSSV lại trên Desktop mới (desktop)
```

### 6.5. Luồng cấu hình Wi-Fi (Chủ nghiệm / Trưởng Lab)

```
1. Vào Web Admin → "Quản lý Wi-Fi lab"
2. Thêm cơ sở: "Cơ sở Hà Nội"
3. Thêm Wi-Fi cho cơ sở:
   - SSID: "APES-Lab-HN"
   - Subnet: "192.168.1.0/24"
   - Gateway: "192.168.1.1"
   - Đánh dấu là Wi-Fi chính
4. Lưu → áp dụng cho mọi lần điểm danh từ thời điểm này
```

---

## 7. Bảo mật & vận hành

### 7.1. Bảo mật
- ✅ Sử dụng Supabase JWT, refresh token.
- ✅ RLS bắt buộc trên mọi bảng.
- ✅ **MAC address binding**: mỗi sinh viên chỉ liên kết được 1 Desktop, 1 Mobile. Không thể tự đổi thiết bị.
- ✅ **Wi-Fi subnet validation** ở server-side (không chỉ client), chống fake IP.
- ✅ QR token liên kết Mobile có TTL 60s và chữ ký số (HMAC).
- ✅ Mã PIN thoát kiosk được hash bcrypt, chỉ Trưởng Lab biết.
- ✅ HTTPS bắt buộc cho toàn bộ traffic.
- ✅ Rate limit trên Edge Functions.

### 7.2. Phát hiện gian lận
- Nếu cùng 1 user gửi 2 IP khác nhau trong cùng 1 phút → cảnh báo.
- Nếu device binding `last_seen_at` cách hiện tại > 30 ngày → đánh dấu "không hoạt động".
- Nếu IP không khớp subnet lab → log vào `audit_logs` để Trưởng Lab review.

### 7.3. Backup
- Supabase tự động backup hằng ngày (Point-in-Time Recovery).
- Xuất backup định kỳ ra Google Drive (Cron job).

### 7.4. Monitoring
- Supabase Dashboard: theo dõi query, lỗi.
- Sentry (tuỳ chọn): theo dõi lỗi runtime trên web/app.
- Google Analytics: thống kê người dùng web.

---

## 8. Roadmap phát triển (cập nhật)

| Giai đoạn | Thời gian | Nội dung | Trạng thái |
|---|---|---|---|
| **Phase 1 – Foundation** | Tuần 1-2 | Database schema + Auth + CRUD members/groups/locations (Web Admin) | ✅ Hoàn thành |
| **Phase 2** | Tuần 3-4 | Cấu hình Wi-Fi lab (Web Admin) + đọc MAC + liên kết thiết bị | ✅ Hoàn thành |
| **Phase 3 – Desktop MVP** | Tuần 5-6 | Desktop App: nhập MSSV, xác thực MAC, sinh QR liên kết, điểm danh Wi-Fi | ✅ Hoàn thành |
| **Phase 4 – Mobile** | Tuần 7-8 | Mobile App: quét QR liên kết, điểm danh qua Wi-Fi | ✅ Hoàn thành |
| **Phase 5** | Tuần 9 | Dashboard realtime, báo cáo, thống kê | 🔜 Kế tiếp |
| **Phase 6** | Tuần 10 | Đóng gói APK → đăng Google Play, build .exe | ⏳ Chưa làm |
| **Phase 7** | Tuần 11 | Beta test, sửa lỗi, tối ưu UX | ⏳ Chưa làm |
| **Phase 8** | Sau go-live | Tính năng nâng cao (AI, gamification, lịch họp…) | ⏳ Chưa làm |

### 8.1 Ghi chú Phase 3 & 4 (đã triển khai)

**Desktop App — `apps/desktop` (Electron 33):**
- Đọc MAC + IP từ card mạng đang dùng (ưu tiên Wi-Fi qua `pickPrimaryIPv4`).
- Xác thực MSSV qua Edge Function `verify-mssv`; lưu MAC vào `device_bindings`.
- Sinh QR liên kết Mobile 60 giây (`generate-link-qr`), tự làm mới khi hết hạn.
- Điểm danh qua `check-attendance` với `method = 'desktop'`.
- Kiosk mode: fullscreen khi đóng gói, ẩn menu, chặn Alt+F4, thoát bằng PIN.
- Luồng màn hình: nhập MSSV → QR → điểm danh → kết quả → tự về sau 5s.
- Tiếng beep bằng Web Audio API sau khi điểm danh thành công.

**Mobile App — `apps/mobile` (Expo SDK 52):**
- Màn hình quét QR (`expo-camera`) là màn hình **duy nhất** cho lần đầu.
- Đổi QR lấy session qua `claim-mobile-binding`, lưu vào `expo-secure-store`.
- Tự động đăng nhập từ lần thứ 2 nhờ session đã lưu.
- Điểm danh qua Wi-Fi: lấy IP (`expo-network`), **từ chối cellular**.
- Xem hồ sơ (chỉ đọc), tỷ lệ chuyên cần, trạng thái thiết bị, lịch sử điểm danh.
- **Không có nút đăng xuất** (F-MOB-AUTH-07).

**Database & Edge Functions (đã áp dụng):**
- Bảng mới: `kiosk_devices`, `device_link_tokens`; cột mới: `device_bindings.note`.
- Unique index chặn điểm danh 2 lần/ngày (theo giờ Việt Nam).
- RPC: `match_wifi_by_ip`, `get_checkin_windows`, `vietnam_today`, `cleanup_expired_link_tokens`.
- 4 Edge Function: `verify-mssv`, `generate-link-qr`, `claim-mobile-binding`, `check-attendance`.

**Còn lại cho Phase 5:**
- Web Admin: trang Quản lý thiết bị (F-DEV-01..06) — reset binding, phát hiện xung đột.
- Dashboard realtime + báo cáo/thống kê (F-RPT-01..09).
- Desktop: màn hình nền sau 30s, auto-start cùng Windows.

---

## 9. Tính năng mở rộng (tương lai)

- 📊 **AI/ML:** Phát hiện bất thường trong điểm danh (IP giả, MAC spoof).
- 🎮 **Gamification:** Điểm thưởng chuyên cần, bảng xếp hạng nhóm.
- 📅 **Tích hợp Google Calendar** cho lịch họp.
- 💬 **Chat nội bộ** theo nhóm.
- 🌙 **Dark mode** cho cả web & app.
- 🔐 **2FA cho Trưởng Lab / Chủ nghiệm** khi reset thiết bị.

---

## 10. Phụ lục

### 10.1. Glossary (Thuật ngữ)

| Thuật ngữ | Ý nghĩa |
|---|---|
| APES Lab | Tên phòng thí nghiệm |
| BESS | Battery Energy Storage System |
| WPT | Wireless Power Transfer |
| BMS | Battery Management System |
| MVP | Minimum Viable Product |
| RLS | Row Level Security |
| RBAC | Role-Based Access Control |
| QR | Quick Response (mã QR) |
| MAC | Media Access Control (địa chỉ vật lý của card mạng) |
| SSID | Service Set Identifier (tên Wi-Fi) |
| Subnet | Dải địa chỉ IP (ví dụ: 192.168.1.0/24) |
| Kiosk | Máy tính đặt cố định tại một vị trí |
| Device Binding | Liên kết tài khoản sinh viên với một thiết bị vật lý |
| TTL | Time-To-Live (thời gian sống của token) |

### 10.2. Tài liệu tham khảo
- [Supabase Docs](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Expo / React Native](https://docs.expo.dev/)
- [Tauri Documentation](https://tauri.app/v1/guides/)
- [TailwindCSS](https://tailwindcss.com/docs)
- [PostgreSQL Network Address Types](https://www.postgresql.org/docs/current/datatype-net-types.html)

---

> 📌 **Ghi chú:** Tài liệu này sẽ được cập nhật liên tục trong quá trình phát triển. Mọi thay đổi về chức năng cần được thảo luận và thống nhất trước khi cập nhật.