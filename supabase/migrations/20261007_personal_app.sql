-- =============================================
-- APES Lab - Migrations cho Personal Desktop App
-- =============================================
-- File: supabase/migrations/20261007_personal_app.sql
-- Chạy sau 20261006_device_linking.sql
--
-- Thay đổi:
--   1. device_bindings.mobile_linked_at — đánh dấu mobile đã liên kết vĩnh viễn
--   2. device_bindings.hostname         — tên máy (phòng trường hợp SV đổi máy)
--   3. device_bindings.os_info          — thông tin OS (chống spoof)
--   4. device_bindings.disk_serial      — serial ổ cứng (chống clone máy ảo)
--   5. RPC: get_member_devices()         — lấy danh sách binding để hiển thị
--   6. RPC: reset_device_binding()      — reset binding từ web-admin
-- =============================================

-- =============================================
-- 1. BỔ SUNG CỘT THIẾU
-- =============================================

-- Mobile đã liên kết vĩnh viễn — Desktop dùng để biết có cần hiện QR nữa không
ALTER TABLE public.device_bindings
  ADD COLUMN IF NOT EXISTS mobile_linked_at TIMESTAMPTZ;

-- Thông tin máy: hostname, OS, disk serial
-- Giúp admin biết SV đang dùng máy nào, dễ nhận biết khi reset
ALTER TABLE public.device_bindings
  ADD COLUMN IF NOT EXISTS hostname TEXT,
  ADD COLUMN IF NOT EXISTS os_info TEXT,
  ADD COLUMN IF NOT EXISTS disk_serial TEXT;

-- Index tìm theo MAC address (phục vụ reset binding)
CREATE INDEX IF NOT EXISTS idx_device_bindings_identifier
  ON public.device_bindings(kind, device_identifier);

-- =============================================
-- 2. RPC: lấy danh sách thiết bị đã liên kết của 1 user
-- =============================================
-- Dùng cho web-admin hiển thị "Máy của SV X" + nút reset
CREATE OR REPLACE FUNCTION public.get_member_devices(p_user_id UUID)
RETURNS TABLE (
  binding_id UUID,
  kind TEXT,
  device_identifier TEXT,
  status TEXT,
  bound_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  mobile_linked_at TIMESTAMPTZ,
  hostname TEXT,
  os_info TEXT,
  disk_serial TEXT,
  note TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id, kind, device_identifier::text, status, bound_at, last_seen_at,
    mobile_linked_at, hostname, os_info, disk_serial, note
  FROM public.device_bindings
  WHERE user_id = p_user_id
  ORDER BY kind, bound_at DESC;
$$;

COMMENT ON FUNCTION public.get_member_devices(UUID) IS
  'Danh sách thiết bị đã liên kết của một user, dùng cho web-admin.';


-- =============================================
-- 3. RPC: reset 1 binding (chỉ lab_manager)
-- =============================================
-- Sau khi reset, SV có thể đăng nhập lại trên máy mới
CREATE OR REPLACE FUNCTION public.reset_device_binding(
  p_binding_id UUID,
  p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_caller_role TEXT;
  v_binding_kind TEXT;
  v_user_id UUID;
BEGIN
  -- Xác thực caller
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Chưa đăng nhập';
  END IF;

  SELECT role INTO v_caller_role FROM public.users WHERE id = v_actor;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('lab_leader', 'lab_manager') THEN
    RAISE EXCEPTION 'Không có quyền reset binding';
  END IF;

  -- Lấy thông tin binding
  SELECT kind, user_id INTO v_binding_kind, v_user_id
  FROM public.device_bindings
  WHERE id = p_binding_id;

  IF v_binding_kind IS NULL THEN
    RAISE EXCEPTION 'Binding không tồn tại';
  END IF;

  -- Soft reset: set status = 'reset', giữ lại lịch sử audit
  UPDATE public.device_bindings
  SET
    status = 'reset',
    reset_at = now(),
    reset_by = v_actor,
    reset_reason = p_reason
  WHERE id = p_binding_id;

  -- Audit log
  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, payload)
  VALUES (
    v_actor,
    'reset_device_binding',
    'device_binding',
    p_binding_id,
    jsonb_build_object(
      'kind', v_binding_kind,
      'user_id', v_user_id,
      'reason', p_reason
    )
  );

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.reset_device_binding(UUID, TEXT) IS
  'Reset 1 device binding. Chỉ lab_leader/lab_manager. Lưu audit log.';


-- =============================================
-- 4. RPC: thống kê số binding active theo loại
-- =============================================
-- Dùng cho dashboard tổng quan
CREATE OR REPLACE FUNCTION public.count_active_bindings()
RETURNS TABLE (
  kind TEXT,
  active_count BIGINT,
  reset_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    kind::text,
    COUNT(*) FILTER (WHERE status = 'active') AS active_count,
    COUNT(*) FILTER (WHERE status = 'reset') AS reset_count
  FROM public.device_bindings
  GROUP BY kind;
$$;


-- =============================================
-- 5. Cập nhật verify-mssv flow: tự lưu hostname, OS info
-- =============================================
-- Edge Function verify-mssv sẽ gửi thêm hostname/os_info/disk_serial
-- vào body, trigger lưu vào device_bindings
-- (Phần này chỉ là comment, code update nằm trong Edge Function)


-- =============================================
-- 6. View: danh sách SV kèm trạng thái binding
-- =============================================
-- Web-admin dùng view này để hiển thị "SV X đã bind máy chưa?"
CREATE OR REPLACE VIEW public.v_member_bindings AS
SELECT
  u.id AS user_id,
  u.mssv,
  u.full_name,
  u.role,
  u.khoa,
  u.group_id,
  g.name AS group_name,
  -- Desktop
  (SELECT device_identifier::text FROM public.device_bindings
   WHERE user_id = u.id AND kind = 'desktop' AND status = 'active'
   ORDER BY bound_at DESC LIMIT 1) AS desktop_mac,
  (SELECT bound_at FROM public.device_bindings
   WHERE user_id = u.id AND kind = 'desktop' AND status = 'active'
   ORDER BY bound_at DESC LIMIT 1) AS desktop_bound_at,
  (SELECT hostname FROM public.device_bindings
   WHERE user_id = u.id AND kind = 'desktop' AND status = 'active'
   ORDER BY bound_at DESC LIMIT 1) AS desktop_hostname,
  -- Mobile
  (SELECT device_identifier::text FROM public.device_bindings
   WHERE user_id = u.id AND kind = 'mobile' AND status = 'active'
   ORDER BY bound_at DESC LIMIT 1) AS mobile_id,
  (SELECT bound_at FROM public.device_bindings
   WHERE user_id = u.id AND kind = 'mobile' AND status = 'active'
   ORDER BY bound_at DESC LIMIT 1) AS mobile_bound_at,
  -- Trạng thái tổng hợp
  EXISTS (
    SELECT 1 FROM public.device_bindings
    WHERE user_id = u.id AND kind = 'desktop' AND status = 'active'
  ) AS has_desktop,
  EXISTS (
    SELECT 1 FROM public.device_bindings
    WHERE user_id = u.id AND kind = 'mobile' AND status = 'active'
  ) AS has_mobile
FROM public.users u
LEFT JOIN public.groups g ON g.id = u.group_id;

COMMENT ON VIEW public.v_member_bindings IS
  'Danh sách user kèm thông tin thiết bị đã liên kết. Dùng cho web-admin.';


-- =============================================
-- 7. Grant quyền cho các role
-- =============================================
GRANT EXECUTE ON FUNCTION public.get_member_devices(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_active_bindings() TO authenticated;
GRANT SELECT ON public.v_member_bindings TO authenticated;


-- =============================================
-- Verify
-- =============================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'device_bindings'
ORDER BY ordinal_position;

SELECT 'migration_20261007 done' AS status;
