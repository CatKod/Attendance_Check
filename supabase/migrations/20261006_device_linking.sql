-- =============================================
-- APES Lab Attendance System - Kiosk & Device Linking
-- =============================================
-- File: supabase/migrations/20261006_device_linking.sql
-- Chạy sau 20261003_init_schema.sql + 20261004_schedule.sql + 20261005_attendance_config.sql
--
-- Bổ sung cho Desktop App (Electron kiosk) và Mobile App (Expo):
--   1. kiosk_devices       — đăng ký máy kiosk tại lab (F-DEV-01)
--   2. device_bindings.note — lưu model thiết bị
--   3. device_link_tokens  — QR liên kết Mobile, TTL 60s, dùng 1 lần (F-DESK-AUTH-05)
--   4. Chống điểm danh 2 lần/ngày ở mức DB
--   5. RLS cho các bảng mới
--   6. RPC: match_wifi_by_ip / get_checkin_windows / vietnam_today
-- =============================================

-- =============================================
-- 1. KIOSK_DEVICES — máy Desktop cố định tại lab
-- =============================================
CREATE TABLE IF NOT EXISTS public.kiosk_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  -- MAC của card mạng đang dùng để kết nối Wi-Fi lab (định danh vật lý máy)
  mac_address MACADDR NOT NULL UNIQUE,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kiosk_devices_active
  ON public.kiosk_devices(is_active);

DROP TRIGGER IF EXISTS set_kiosk_devices_updated_at ON public.kiosk_devices;
CREATE TRIGGER set_kiosk_devices_updated_at
  BEFORE UPDATE ON public.kiosk_devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================
-- 2. BỔ SUNG CỘT THIẾU
-- =============================================
-- device_bindings.note: lưu model thiết bị để Trưởng Lab dễ nhận biết khi reset
ALTER TABLE public.device_bindings
  ADD COLUMN IF NOT EXISTS note TEXT;

-- users: lưu lần đăng nhập gần nhất (tiện báo cáo)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_ip INET;


-- =============================================
-- 3. DEVICE_LINK_TOKENS — QR liên kết Mobile
-- =============================================
-- Desktop sinh token sau khi xác thực MSSV thành công, hiển thị QR 60 giây.
-- Mobile quét → gửi token + device_id → Edge Function đổi token lấy session.
-- Token chỉ dùng được 1 lần (used_at) và tự hết hạn sau 60 giây.
CREATE TABLE IF NOT EXISTS public.device_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Token dạng hex ngẫu nhiên 32 bytes, là thứ nhúng vào QR
  token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- MAC của kiosk đã sinh QR (để audit + hiển thị trên mobile)
  kiosk_mac MACADDR,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '60 seconds'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_link_tokens_user
  ON public.device_link_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_link_tokens_expires
  ON public.device_link_tokens(expires_at);


-- =============================================
-- 4. CHỐNG ĐIỂM DANH 2 LẦN TRONG 1 NGÀY
-- =============================================
-- Mốc ngày theo giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7).
-- Chỉ áp dụng cho desktop/mobile_wifi; manual_admin được linh hoạt hơn.
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_one_per_day
  ON public.attendance (user_id, ((check_in_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date))
  WHERE method IN ('desktop', 'mobile_wifi');


-- =============================================
-- 5. RLS
-- =============================================
ALTER TABLE public.kiosk_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_link_tokens ENABLE ROW LEVEL SECURITY;

-- kiosk_devices: mọi user đăng nhập đều xem được (để Desktop biết mình là kiosk nào)
CREATE POLICY "Authenticated can view kiosks"
ON public.kiosk_devices FOR SELECT
TO authenticated
USING (true);

-- Chỉ lab_manager được quản lý danh sách kiosk
CREATE POLICY "Lab manager can manage kiosks"
ON public.kiosk_devices FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'lab_manager'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'lab_manager'
  )
);

-- device_link_tokens: KHÔNG cho user đọc trực tiếp.
-- Chỉ Edge Function (service role) dùng. Policy này chỉ để chặn client.
CREATE POLICY "No direct access to link tokens"
ON public.device_link_tokens FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);


-- =============================================
-- 6. RPC: kiểm tra IP có thuộc subnet Wi-Fi lab không
-- =============================================
-- Edge Function gọi hàm này thay vì tự so sánh CIDR ở JS.
CREATE OR REPLACE FUNCTION public.match_wifi_by_ip(check_ip INET)
RETURNS TABLE (
  wifi_id UUID,
  location_id UUID,
  ssid TEXT,
  subnet CIDR
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.id, w.location_id, w.ssid, w.subnet
  FROM public.wifi_networks w
  WHERE w.is_active = TRUE
    AND check_ip <<= w.subnet
  ORDER BY w.is_primary DESC NULLS LAST
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.match_wifi_by_ip(INET) IS
  'Tìm wifi_network đang active có chứa IP này. Dùng bởi check-attendance.';


-- =============================================
-- 7. RPC: lấy các cửa sổ điểm danh hợp lệ của một thứ trong tuần
-- =============================================
CREATE OR REPLACE FUNCTION public.get_checkin_windows(for_day_of_week INTEGER)
RETURNS TABLE (
  schedule_id UUID,
  checkin_start TIME,
  checkin_end TIME
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.checkin_start_time, s.checkin_end_time
  FROM public.lab_schedules s
  WHERE s.day_of_week = for_day_of_week
    AND s.is_active = TRUE
    AND s.allow_checkin = TRUE
    AND s.checkin_start_time IS NOT NULL
    AND s.checkin_end_time IS NOT NULL
  ORDER BY s.checkin_start_time;
$$;

COMMENT ON FUNCTION public.get_checkin_windows(INTEGER) IS
  'Danh sách cửa sổ điểm danh được phép của một thứ trong tuần (0=CN..6=T7).';


-- =============================================
-- 8. RPC: ngày hôm nay theo giờ Việt Nam
-- =============================================
CREATE OR REPLACE FUNCTION public.vietnam_today()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
  SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
$$;


-- =============================================
-- 9. Dọn token hết hạn (gọi định kỳ bằng cron hoặc gọi mỗi lần sinh QR)
-- =============================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_link_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed INTEGER;
BEGIN
  DELETE FROM public.device_link_tokens
  WHERE expires_at < now() - INTERVAL '10 minutes'
     OR (used_at IS NOT NULL AND used_at < now() - INTERVAL '1 hour');
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;


-- =============================================
-- Verify
-- =============================================
SELECT 'kiosk_devices' AS table_name, count(*)::text AS rows FROM public.kiosk_devices
UNION ALL
SELECT 'device_link_tokens', count(*)::text FROM public.device_link_tokens
UNION ALL
SELECT 'attendance (hôm nay)', count(*)::text
FROM public.attendance
WHERE (check_in_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = public.vietnam_today();

SELECT public.vietnam_today() AS hom_nay, public.get_checkin_windows(EXTRACT(ISODOW FROM now()) - 1)::int AS windows;
