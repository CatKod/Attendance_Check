-- =============================================
-- APES Lab Attendance System - Fix duplicate device bindings
-- =============================================
-- File: supabase/migrations/20261008_unique_device_binding.sql
-- Chạy sau 20261007_personal_app.sql
--
-- Vấn đề (Bug B):
--   Trước đây bảng device_bindings chỉ UNIQUE theo (user_id, kind).
--   → Một MAC có thể bị insert nhiều lần cho nhiều user khác nhau.
--   → Sinh viên A nhập MSSV → bind máy với MAC X.
--   → Sinh viên B nhập MSSV khác trên cùng máy → cũng bind thành công với MAC X.
--   → DB có 2 row cùng MAC, 2 user khác nhau → vi phạm "1 máy = 1 MSSV".
--
-- Fix:
--   1. Báo cáo các binding trùng MAC để Trưởng Lab biết mà xử lý.
--   2. Thêm UNIQUE constraint (kind, device_identifier) cho binding đang active.
--      Chỉ áp dụng cho status='active' để giữ lịch sử các binding đã reset/revoked.
-- =============================================

-- 1. Báo cáo các MAC bị bind cho nhiều user (cần Trưởng Lab reset thủ công)
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT count(*) INTO dup_count
  FROM (
    SELECT kind, device_identifier
    FROM public.device_bindings
    WHERE status = 'active'
    GROUP BY kind, device_identifier
    HAVING count(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE NOTICE 'CẢNH BÁO: Có % MAC bị bind cho nhiều user đang active.', dup_count;
    RAISE NOTICE 'Danh sách:';
    RETURN QUERY
      SELECT
        b.kind,
        b.device_identifier AS mac,
        count(*) AS so_user,
        string_agg(u.mssv, ', ') AS cac_mssv
      FROM public.device_bindings b
      JOIN public.users u ON u.id = b.user_id
      WHERE b.status = 'active'
      GROUP BY b.kind, b.device_identifier
      HAVING count(*) > 1;
  END IF;
END $$;

-- 2. Thêm UNIQUE constraint một phần (partial index) cho binding active
--    Lưu ý: phải dọn duplicate trước, nếu không CREATE sẽ fail.
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_bindings_active_unique
  ON public.device_bindings (kind, device_identifier)
  WHERE status = 'active';

-- 3. Comment giải thích
COMMENT ON INDEX idx_device_bindings_active_unique IS
  'Đảm bảo mỗi MAC chỉ được bind cho 1 user (trong tập các binding đang active). ' ||
  'Binding reset/revoked vẫn giữ để audit.';