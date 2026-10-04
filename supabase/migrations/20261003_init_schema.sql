-- =============================================
-- APES Lab Attendance System - Database Schema
-- =============================================
-- File: supabase/migrations/20261003_init_schema.sql
-- Chạy file này trong Supabase Dashboard → SQL Editor

-- =============================================
-- 1. BẢNG USERS (extend từ auth.users)
-- =============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mssv TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  khoa TEXT NOT NULL,
  group_id UUID,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'group_leader', 'lab_leader', 'lab_manager')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_users_mssv ON public.users(mssv);
CREATE INDEX idx_users_group_id ON public.users(group_id);
CREATE INDEX idx_users_role ON public.users(role);

-- =============================================
-- 2. BẢNG GROUPS
-- =============================================
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  leader_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_groups_leader_id ON public.groups(leader_id);

-- Add foreign key từ users.group_id → groups.id (sau khi groups tồn tại)
ALTER TABLE public.users
  ADD CONSTRAINT fk_users_group
  FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;

ALTER TABLE public.groups
  ADD CONSTRAINT fk_groups_leader
  FOREIGN KEY (leader_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- =============================================
-- 3. BẢNG LOCATIONS (cơ sở)
-- =============================================
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 4. BẢNG WIFI_NETWORKS
-- =============================================
CREATE TABLE IF NOT EXISTS public.wifi_networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  ssid TEXT NOT NULL,
  subnet CIDR NOT NULL,
  gateway INET,
  bssid MACADDR,
  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wifi_location_id ON public.wifi_networks(location_id);
CREATE INDEX idx_wifi_active ON public.wifi_networks(is_active);

-- =============================================
-- 5. BẢNG DEVICE_BINDINGS
-- =============================================
CREATE TABLE IF NOT EXISTS public.device_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('desktop', 'mobile')),
  device_identifier TEXT NOT NULL,
  bound_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'reset', 'revoked')),
  reset_by UUID REFERENCES public.users(id),
  reset_at TIMESTAMPTZ,
  reset_reason TEXT,
  UNIQUE(user_id, kind)
);

CREATE INDEX idx_device_bindings_user_id ON public.device_bindings(user_id);
CREATE INDEX idx_device_bindings_identifier ON public.device_bindings(device_identifier);
CREATE INDEX idx_device_bindings_status ON public.device_bindings(status);

-- =============================================
-- 6. BẢNG SESSIONS (buổi họp)
-- =============================================
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  location_id UUID REFERENCES public.locations(id),
  group_id UUID REFERENCES public.groups(id),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sessions_start_time ON public.sessions(start_time);
CREATE INDEX idx_sessions_status ON public.sessions(status);
CREATE INDEX idx_sessions_group_id ON public.sessions(group_id);

-- =============================================
-- 7. BẢNG ATTENDANCE
-- =============================================
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id),
  check_in_time TIMESTAMPTZ DEFAULT now(),
  method TEXT NOT NULL CHECK (method IN ('desktop', 'mobile_wifi', 'manual_admin')),
  ip_address INET,
  subnet_matched UUID REFERENCES public.wifi_networks(id),
  location_id UUID REFERENCES public.locations(id),
  status TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  note TEXT,
  approved_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  -- 1 user chỉ có 1 bản ghi điểm danh cho 1 session
  UNIQUE(user_id, session_id)
);

CREATE INDEX idx_attendance_user_id ON public.attendance(user_id);
CREATE INDEX idx_attendance_session_id ON public.attendance(session_id);
CREATE INDEX idx_attendance_check_in_time ON public.attendance(check_in_time);
CREATE INDEX idx_attendance_method ON public.attendance(method);

-- =============================================
-- 8. BẢNG AUDIT_LOGS
-- =============================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  payload JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity, entity_id);

-- =============================================
-- 9. BẢNG LAB_SETTINGS
-- =============================================
CREATE TABLE IF NOT EXISTS public.lab_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_name TEXT DEFAULT 'APES Lab',
  late_threshold_minutes INTEGER DEFAULT 15,
  kiosk_pin_hash TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert row mặc định
INSERT INTO public.lab_settings (lab_name) VALUES ('APES Lab') ON CONFLICT DO NOTHING;

-- =============================================
-- 10. ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS cho tất cả các bảng
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wifi_networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_settings ENABLE ROW LEVEL SECURITY;

-- ===== USERS =====
CREATE POLICY "Users can view own profile"
ON public.users FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Lab leaders can view all users"
ON public.users FOR SELECT
USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('lab_leader', 'lab_manager')
    )
  );

CREATE POLICY "Lab leaders can manage users"
ON public.users FOR ALL
USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('lab_leader', 'lab_manager')
    )
  );

-- ===== GROUPS =====
CREATE POLICY "Everyone can view groups"
ON public.groups FOR SELECT
USING (true);

CREATE POLICY "Lab leaders can manage groups"
ON public.groups FOR ALL
USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('lab_leader', 'lab_manager')
    )
  );

-- ===== LOCATIONS & WIFI =====
CREATE POLICY "Lab leaders can view locations"
ON public.locations FOR SELECT
USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('lab_leader', 'lab_manager', 'group_leader')
    )
  );

CREATE POLICY "Lab leaders can manage locations"
ON public.locations FOR ALL
USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('lab_leader', 'lab_manager')
    )
  );

CREATE POLICY "Lab leaders can view wifi"
ON public.wifi_networks FOR SELECT
USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('lab_leader', 'lab_manager', 'group_leader')
    )
  );

CREATE POLICY "Lab leaders can manage wifi"
ON public.wifi_networks FOR ALL
USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('lab_leader', 'lab_manager')
    )
  );

-- ===== DEVICE BINDINGS =====
CREATE POLICY "Users can view own device bindings"
ON public.device_bindings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Lab leaders can view all device bindings"
ON public.device_bindings FOR SELECT
USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('lab_leader', 'lab_manager')
    )
  );

CREATE POLICY "Lab leaders can manage device bindings"
ON public.device_bindings FOR ALL
USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('lab_leader', 'lab_manager')
    )
  );

-- ===== SESSIONS =====
CREATE POLICY "Everyone can view sessions"
ON public.sessions FOR SELECT
USING (true);

CREATE POLICY "Lab leaders and group leaders can manage sessions"
ON public.sessions FOR ALL
USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('lab_leader', 'lab_manager', 'group_leader')
    )
  );

-- ===== ATTENDANCE =====
CREATE POLICY "Users can view own attendance"
ON public.attendance FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Group leaders can view group attendance"
ON public.attendance FOR SELECT
USING (
    EXISTS (
      SELECT 1 FROM public.users u1
      JOIN public.users u2 ON u2.id = attendance.user_id
      WHERE u1.id = auth.uid()
        AND u1.role = 'group_leader'
        AND u1.group_id = u2.group_id
    )
  );

CREATE POLICY "Lab leaders can view all attendance"
ON public.attendance FOR SELECT
USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('lab_leader', 'lab_manager')
    )
  );

CREATE POLICY "Lab leaders can manage attendance"
ON public.attendance FOR ALL
USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('lab_leader', 'lab_manager')
    )
  );

-- ===== AUDIT LOGS =====
CREATE POLICY "Lab leaders can view audit logs"
ON public.audit_logs FOR SELECT
USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('lab_leader', 'lab_manager')
    )
  );

-- ===== LAB SETTINGS =====
CREATE POLICY "Lab leaders can view settings"
ON public.lab_settings FOR SELECT
USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('lab_leader', 'lab_manager', 'group_leader')
    )
  );

CREATE POLICY "Lab manager can manage settings"
ON public.lab_settings FOR ALL
USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'lab_manager'
    )
  );

-- =============================================
-- 11. TRIGGERS
-- =============================================

-- Trigger: tự động tạo row trong public.users khi có auth.users mới
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, mssv, full_name, email, khoa, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'mssv', 'TBD'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Unknown'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'khoa', 'K68'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: cập nhật updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================
-- 12. SEED DATA - Nhóm nghiên cứu
-- =============================================
INSERT INTO public.groups (name, description) VALUES
  ('Sạc pin', 'Nhóm nghiên cứu về công nghệ sạc pin'),
  ('BESS', 'Battery Energy Storage System'),
  ('WPT động', 'Wireless Power Transfer động'),
  ('WPT tĩnh', 'Wireless Power Transfer tĩnh'),
  ('Plasma', 'Nhóm nghiên cứu Plasma'),
  ('BMS', 'Battery Management System')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- 13. SEED DATA - Locations mặc định
-- =============================================
INSERT INTO public.locations (name, address) VALUES
  ('Cơ sở Hà Nội', 'Học viện Công nghệ Bưu chính Viễn thông')
ON CONFLICT DO NOTHING;

-- =============================================
-- KẾT THÚC MIGRATION
-- =============================================

-- Verify
SELECT 'Tables created:' as info;
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN (
  'users', 'groups', 'locations', 'wifi_networks',
  'device_bindings', 'sessions', 'attendance', 'audit_logs', 'lab_settings'
)
ORDER BY table_name;