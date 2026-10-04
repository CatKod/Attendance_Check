-- =============================================
-- APES Lab Attendance System - Cấu hình điểm danh
-- =============================================
-- File: supabase/migrations/20261005_attendance_config.sql
-- Chạy trong Supabase Dashboard → SQL Editor (sau 20261004_schedule.sql)
--
-- 1. lab_settings  : số lần điểm danh bắt buộc trong 1 tuần
-- 2. lab_schedules : cửa sổ điểm danh riêng + cờ cho phép điểm danh
--
-- Cửa sổ điểm danh luôn nằm TRONG khoảng mở/đóng cửa của ca đó.
-- =============================================

-- =============================================
-- 1. LAB_SETTINGS — số lần điểm danh mỗi tuần
-- =============================================
ALTER TABLE public.lab_settings
  ADD COLUMN IF NOT EXISTS required_checkins_per_week INTEGER NOT NULL DEFAULT 3;

-- Cho phép tắt hoàn toàn (0) nhưng không vượt quá 7 lần/tuần
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_required_checkins_per_week'
  ) THEN
    ALTER TABLE public.lab_settings
      ADD CONSTRAINT chk_required_checkins_per_week
      CHECK (required_checkins_per_week BETWEEN 0 AND 7);
  END IF;
END $$;

-- Đảm bảo trigger updated_at tồn tại (idempotent)
DROP TRIGGER IF EXISTS set_lab_settings_updated_at ON public.lab_settings;
CREATE TRIGGER set_lab_settings_updated_at
  BEFORE UPDATE ON public.lab_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================
-- 2. LAB_SCHEDULES — cửa sổ điểm danh
-- =============================================
-- allow_checkin       : ca này có được phép điểm danh hay không
-- checkin_start_time  : bắt đầu được điểm danh
-- checkin_end_time    : kết thúc được điểm danh
-- NULL ở cả 2 cửa sổ = ca này không dùng để điểm danh
ALTER TABLE public.lab_schedules
  ADD COLUMN IF NOT EXISTS allow_checkin BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS checkin_start_time TIME,
  ADD COLUMN IF NOT EXISTS checkin_end_time TIME;

-- Ràng buộc: hoặc không có cửa sổ, hoặc cửa sổ hợp lệ và nằm trong giờ mở cửa
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_checkin_window'
  ) THEN
    ALTER TABLE public.lab_schedules
      ADD CONSTRAINT chk_checkin_window CHECK (
        (checkin_start_time IS NULL AND checkin_end_time IS NULL)
        OR (
          checkin_start_time IS NOT NULL
          AND checkin_end_time IS NOT NULL
          AND checkin_end_time > checkin_start_time
          AND checkin_start_time >= start_time
          AND checkin_end_time <= end_time
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lab_schedules_checkin
  ON public.lab_schedules(allow_checkin);

-- Trigger updated_at (idempotent — migration trước dùng CREATE không có DROP)
DROP TRIGGER IF EXISTS set_lab_schedules_updated_at ON public.lab_schedules;
CREATE TRIGGER set_lab_schedules_updated_at
  BEFORE UPDATE ON public.lab_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================
-- 3. SEED — mở điểm danh 15 phút đầu cho các ca sẵn có
-- =============================================
-- Idempotent: chỉ áp dụng cho ca chưa có cửa sổ điểm danh nào.
-- Lần chạy migration sau sẽ không ghi đè lựa chọn của Trưởng Lab.
UPDATE public.lab_schedules
SET allow_checkin = TRUE,
    checkin_start_time = start_time,
    checkin_end_time = start_time + INTERVAL '15 minutes',
    updated_at = now()
WHERE checkin_start_time IS NULL
  AND checkin_end_time IS NULL
  AND (start_time + INTERVAL '15 minutes') <= end_time;


-- =============================================
-- Verify
-- =============================================
SELECT 'required_checkins_per_week' AS setting,
       required_checkins_per_week::text AS value
FROM public.lab_settings
LIMIT 1;

SELECT 'ca được phép điểm danh' AS metric,
       count(*) FILTER (WHERE allow_checkin)::text AS value
FROM public.lab_schedules
UNION ALL
SELECT 'tổng số ca', count(*)::text FROM public.lab_schedules
UNION ALL
SELECT 'cửa sổ điểm danh/tuần', count(*) FILTER (WHERE allow_checkin)::text
FROM public.lab_schedules;
