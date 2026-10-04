-- =============================================
-- SEED DATA - Import thành viên từ CSV
-- =============================================
-- File: supabase/seed_members.sql
-- Chạy SAU khi đã chạy 20261003_init_schema.sql
--
-- LƯU Ý: Script này chỉ tạo row trong public.users
--        Bạn cần tạo tài khoản Supabase Auth (auth.users) trước
--        Hoặc dùng cách 2 bên dưới

-- =============================================
-- CÁCH 1: Tạo tài khoản Auth + Users tự động
-- =============================================
-- Lưu ý: Mật khẩu mặc định cho tất cả SV = MSSV (sẽ đổi sau)
-- Chạy đoạn này trong Supabase Dashboard → SQL Editor

DO $$
DECLARE
  v_user_id UUID;
  v_group_id UUID;
BEGIN
  -- ============================
  -- TRƯỞNG LAB
  -- ============================
  -- Nguyễn Trọng Quyết - Trưởng Lab
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    '20232276@apes.edu.vn',
    crypt('20232276', gen_salt('bf')),
    now(),
    jsonb_build_object(
      'mssv', '20232276',
      'full_name', 'Nguyễn Trọng Quyết',
      'khoa', 'K68',
      'role', 'lab_leader'
    ),
    now(),
    now()
  )
  RETURNING id INTO v_user_id;

  UPDATE public.users
  SET role = 'lab_leader'
  WHERE id = v_user_id;

  -- ============================
  -- NHÓM SẠC PIN
  -- ============================
  SELECT id INTO v_group_id FROM public.groups WHERE name = 'Sạc pin';

  -- Trưởng nhóm: Lê Huy Đức Anh
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '20232447@apes.edu.vn', crypt('20232447', gen_salt('bf')), now(),
    jsonb_build_object('mssv', '20232447', 'full_name', 'Lê Huy Đức Anh', 'khoa', 'K68', 'role', 'group_leader'),
    now(), now())
  RETURNING id INTO v_user_id;

  UPDATE public.users SET group_id = v_group_id, role = 'group_leader' WHERE id = v_user_id;
  UPDATE public.groups SET leader_id = v_user_id WHERE id = v_group_id;

  -- Ngô Bình Nam
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '202413026@apes.edu.vn', crypt('202413026', gen_salt('bf')), now(),
    jsonb_build_object('mssv', '202413026', 'full_name', 'Ngô Bình Nam', 'khoa', 'K69', 'role', 'student'),
    now(), now())
  RETURNING id INTO v_user_id;
  UPDATE public.users SET group_id = v_group_id WHERE id = v_user_id;

  -- Phạm Khắc Tiến
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '202412801@apes.edu.vn', crypt('202412801', gen_salt('bf')), now(),
    jsonb_build_object('mssv', '202412801', 'full_name', 'Phạm Khắc Tiến', 'khoa', 'K69', 'role', 'student'),
    now(), now())
  RETURNING id INTO v_user_id;
  UPDATE public.users SET group_id = v_group_id WHERE id = v_user_id;

  -- ============================
  -- NHÓM BESS
  -- ============================
  SELECT id INTO v_group_id FROM public.groups WHERE name = 'BESS';

  -- Trần Minh Đức - Trưởng nhóm
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '20232016@apes.edu.vn', crypt('20232016', gen_salt('bf')), now(),
    jsonb_build_object('mssv', '20232016', 'full_name', 'Trần Minh Đức', 'khoa', 'K68', 'role', 'group_leader'),
    now(), now())
  RETURNING id INTO v_user_id;
  UPDATE public.users SET group_id = v_group_id, role = 'group_leader' WHERE id = v_user_id;
  UPDATE public.groups SET leader_id = v_user_id WHERE id = v_group_id;

  -- Nguyễn Văn Hiếu
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '202400011@apes.edu.vn', crypt('202400011', gen_salt('bf')), now(),
    jsonb_build_object('mssv', '202400011', 'full_name', 'Nguyễn Văn Hiếu', 'khoa', 'K69', 'role', 'student'),
    now(), now())
  RETURNING id INTO v_user_id;
  UPDATE public.users SET group_id = v_group_id WHERE id = v_user_id;

  -- Bùi Xuân Sơn
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '202412755@apes.edu.vn', crypt('202412755', gen_salt('bf')), now(),
    jsonb_build_object('mssv', '202412755', 'full_name', 'Bùi Xuân Sơn', 'khoa', 'K69', 'role', 'student'),
    now(), now())
  RETURNING id INTO v_user_id;
  UPDATE public.users SET group_id = v_group_id WHERE id = v_user_id;

  -- Nguyễn Văn Phương
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '20241839E@apes.edu.vn', crypt('20241839E', gen_salt('bf')), now(),
    jsonb_build_object('mssv', '20241839E', 'full_name', 'Nguyễn Văn Phương', 'khoa', 'K68', 'role', 'student'),
    now(), now())
  RETURNING id INTO v_user_id;
  UPDATE public.users SET group_id = v_group_id WHERE id = v_user_id;

  -- ============================
  -- NHÓM WPT ĐỘNG
  -- ============================
  SELECT id INTO v_group_id FROM public.groups WHERE name = 'WPT động';

  -- Hoàng Nguyên Hiệp - Trưởng nhóm
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '20232066@apes.edu.vn', crypt('20232066', gen_salt('bf')), now(),
    jsonb_build_object('mssv', '20232066', 'full_name', 'Hoàng Nguyên Hiệp', 'khoa', 'K68', 'role', 'group_leader'),
    now(), now())
  RETURNING id INTO v_user_id;
  UPDATE public.users SET group_id = v_group_id, role = 'group_leader' WHERE id = v_user_id;
  UPDATE public.groups SET leader_id = v_user_id WHERE id = v_group_id;

  -- Nguyễn Hoàng Minh Châu
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '20231944@apes.edu.vn', crypt('20231944', gen_salt('bf')), now(),
    jsonb_build_object('mssv', '20231944', 'full_name', 'Nguyễn Hoàng Minh Châu', 'khoa', 'K68', 'role', 'student'),
    now(), now())
  RETURNING id INTO v_user_id;
  UPDATE public.users SET group_id = v_group_id WHERE id = v_user_id;

  -- Nguyễn Gia Luân
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '202412624@apes.edu.vn', crypt('202412624', gen_salt('bf')), now(),
    jsonb_build_object('mssv', '202412624', 'full_name', 'Nguyễn Gia Luân', 'khoa', 'K69', 'role', 'student'),
    now(), now())
  RETURNING id INTO v_user_id;
  UPDATE public.users SET group_id = v_group_id WHERE id = v_user_id;

  -- ============================
  -- NHÓM WPT TĨNH
  -- ============================
  SELECT id INTO v_group_id FROM public.groups WHERE name = 'WPT tĩnh';

  -- Nguyễn Nguyên Phong
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '20232237@apes.edu.vn', crypt('20232237', gen_salt('bf')), now(),
    jsonb_build_object('mssv', '20232237', 'full_name', 'Nguyễn Nguyên Phong', 'khoa', 'K68', 'role', 'student'),
    now(), now())
  RETURNING id INTO v_user_id;
  UPDATE public.users SET group_id = v_group_id WHERE id = v_user_id;

  -- Đoàn Tăng Duy
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '20232040@apes.edu.vn', crypt('20232040', gen_salt('bf')), now(),
    jsonb_build_object('mssv', '20232040', 'full_name', 'Đoàn Tăng Duy', 'khoa', 'K68', 'role', 'student'),
    now(), now())
  RETURNING id INTO v_user_id;
  UPDATE public.users SET group_id = v_group_id WHERE id = v_user_id;

  -- Tạ Trung Kiên
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '20232156@apes.edu.vn', crypt('20232156', gen_salt('bf')), now(),
    jsonb_build_object('mssv', '20232156', 'full_name', 'Tạ Trung Kiên', 'khoa', 'K68', 'role', 'student'),
    now(), now())
  RETURNING id INTO v_user_id;
  UPDATE public.users SET group_id = v_group_id WHERE id = v_user_id;

  -- ============================
  -- NHÓM PLASMA
  -- ============================
  SELECT id INTO v_group_id FROM public.groups WHERE name = 'Plasma';

  -- Ngô Đăng Phú
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '20232242@apes.edu.vn', crypt('20232242', gen_salt('bf')), now(),
    jsonb_build_object('mssv', '20232242', 'full_name', 'Ngô Đăng Phú', 'khoa', 'K68', 'role', 'student'),
    now(), now())
  RETURNING id INTO v_user_id;
  UPDATE public.users SET group_id = v_group_id WHERE id = v_user_id;

  -- Phạm Đức Hoàng Tuấn
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '202412833@apes.edu.vn', crypt('202412833', gen_salt('bf')), now(),
    jsonb_build_object('mssv', '202412833', 'full_name', 'Phạm Đức Hoàng Tuấn', 'khoa', 'K69', 'role', 'student'),
    now(), now())
  RETURNING id INTO v_user_id;
  UPDATE public.users SET group_id = v_group_id WHERE id = v_user_id;

  -- Lê Xuân Hiển
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '202412506@apes.edu.vn', crypt('202412506', gen_salt('bf')), now(),
    jsonb_build_object('mssv', '202412506', 'full_name', 'Lê Xuân Hiển', 'khoa', 'K69', 'role', 'student'),
    now(), now())
  RETURNING id INTO v_user_id;
  UPDATE public.users SET group_id = v_group_id WHERE id = v_user_id;

  -- Phạm Công Minh
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '202412640@apes.edu.vn', crypt('202412640', gen_salt('bf')), now(),
    jsonb_build_object('mssv', '202412640', 'full_name', 'Phạm Công Minh', 'khoa', 'K69', 'role', 'student'),
    now(), now())
  RETURNING id INTO v_user_id;
  UPDATE public.users SET group_id = v_group_id WHERE id = v_user_id;

  -- Nguyễn Đức Quang Huy
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '20212837@apes.edu.vn', crypt('20212837', gen_salt('bf')), now(),
    jsonb_build_object('mssv', '20212837', 'full_name', 'Nguyễn Đức Quang Huy', 'khoa', 'K68', 'role', 'student'),
    now(), now())
  RETURNING id INTO v_user_id;
  UPDATE public.users SET group_id = v_group_id WHERE id = v_user_id;

  -- ============================
  -- NHÓM BMS
  -- ============================
  SELECT id INTO v_group_id FROM public.groups WHERE name = 'BMS';

  -- Vũ Thế Bảo - Trưởng nhóm
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '20231936@apes.edu.vn', crypt('20231936', gen_salt('bf')), now(),
    jsonb_build_object('mssv', '20231936', 'full_name', 'Vũ Thế Bảo', 'khoa', 'K68', 'role', 'group_leader'),
    now(), now())
  RETURNING id INTO v_user_id;
  UPDATE public.users SET group_id = v_group_id, role = 'group_leader' WHERE id = v_user_id;
  UPDATE public.groups SET leader_id = v_user_id WHERE id = v_group_id;

  -- Trần Hồng Quân
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '20232254@apes.edu.vn', crypt('20232254', gen_salt('bf')), now(),
    jsonb_build_object('mssv', '20232254', 'full_name', 'Trần Hồng Quân', 'khoa', 'K68', 'role', 'student'),
    now(), now())
  RETURNING id INTO v_user_id;
  UPDATE public.users SET group_id = v_group_id WHERE id = v_user_id;

  -- Nguyễn Trung Tín
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '202412804@apes.edu.vn', crypt('202412804', gen_salt('bf')), now(),
    jsonb_build_object('mssv', '202412804', 'full_name', 'Nguyễn Trung Tín', 'khoa', 'K69', 'role', 'student'),
    now(), now())
  RETURNING id INTO v_user_id;
  UPDATE public.users SET group_id = v_group_id WHERE id = v_user_id;

END $$;

-- Verify
SELECT u.mssv, u.full_name, u.khoa, u.role, g.name as group_name
FROM public.users u
LEFT JOIN public.groups g ON u.group_id = g.id
ORDER BY
  CASE u.role
    WHEN 'lab_leader' THEN 1
    WHEN 'group_leader' THEN 2
    WHEN 'student' THEN 3
  END,
  g.name,
  u.full_name;

-- =============================================
-- HƯỚNG DẪN ĐĂNG NHẬP
-- =============================================
-- Tất cả tài khoản đều có mật khẩu = MSSV
-- Ví dụ: Nguyễn Trọng Quyết (Trưởng Lab)
--   Email: 20232276@apes.edu.vn
--   Password: 20232276
--
-- Sau khi đăng nhập lần đầu, nên đổi mật khẩu qua:
--   Supabase Dashboard → Authentication → Users → chọn user → Reset password
-- =============================================