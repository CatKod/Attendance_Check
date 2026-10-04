-- =============================================
-- APES Lab Attendance System - Schedule & Holidays
-- =============================================
-- File: supabase/migrations/20261004_schedule.sql

-- =============================================
-- 1. BẢNG LAB_SCHEDULES
-- =============================================
-- Lưu khung giờ "lên lab" theo từng thứ trong tuần
-- day_of_week: 0=CN, 1=T2, ..., 6=T7 (kiểu ISO)
CREATE TABLE IF NOT EXISTS public.lab_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_time_range CHECK (end_time > start_time)
);

CREATE INDEX idx_lab_schedules_day ON public.lab_schedules(day_of_week);
CREATE INDEX idx_lab_schedules_active ON public.lab_schedules(is_active);

-- =============================================
-- 2. BẢNG LAB_HOLIDAYS
-- =============================================
-- Ngày nghỉ đặc biệt (lễ, Tết, bảo trì, ...)
CREATE TABLE IF NOT EXISTS public.lab_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE, -- áp dụng hàng năm
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lab_holidays_date ON public.lab_holidays(holiday_date);

-- =============================================
-- 3. RLS
-- =============================================
ALTER TABLE public.lab_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_holidays ENABLE ROW LEVEL SECURITY;

-- Tất cả user đăng nhập đều xem được lịch + ngày nghỉ
CREATE POLICY "Authenticated can view schedules"
ON public.lab_schedules FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can view holidays"
ON public.lab_holidays FOR SELECT
TO authenticated
USING (true);

-- Chỉ lab_manager mới được thêm/sửa/xóa
CREATE POLICY "Lab manager can manage schedules"
ON public.lab_schedules FOR ALL
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

CREATE POLICY "Lab manager can manage holidays"
ON public.lab_holidays FOR ALL
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

-- =============================================
-- 4. TRIGGER updated_at cho schedules
-- =============================================
CREATE TRIGGER set_lab_schedules_updated_at
  BEFORE UPDATE ON public.lab_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================
-- 5. SEED DATA mặc định (T2-T7, 8h-17h)
-- =============================================
INSERT INTO public.lab_schedules (day_of_week, start_time, end_time, note) VALUES
  (1, '08:00:00', '17:00:00', 'Thứ 2'),
  (2, '08:00:00', '17:00:00', 'Thứ 3'),
  (3, '08:00:00', '17:00:00', 'Thứ 4'),
  (4, '08:00:00', '17:00:00', 'Thứ 5'),
  (5, '08:00:00', '17:00:00', 'Thứ 6'),
  (6, '08:00:00', '12:00:00', 'Thứ 7 (nửa ngày)')
ON CONFLICT DO NOTHING;

-- =============================================
-- Verify
-- =============================================
SELECT 'lab_schedules' as table_name, count(*) as rows FROM public.lab_schedules
UNION ALL
SELECT 'lab_holidays', count(*) FROM public.lab_holidays;