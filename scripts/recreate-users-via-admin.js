// Delete 22 SQL-inserted users (giữ lại Admin-API test user)
// Rồi re-create 22 user qua Admin API (sẽ tự động insert identity + trigger tạo public.users)

const fs = require('fs');
const env = {};
const envContent = fs.readFileSync('D:\\GitHub\\Attendance_Check\\apps\\web-admin\\.env.local', 'utf8');
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq < 0) continue;
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

// Danh sách 22 user (giữ nguyên thứ tự + thông tin từ seed_members.sql)
const USERS = [
  { email: '20232276@apes.edu.vn', mssv: '20232276', full_name: 'Nguyễn Trọng Quyết', khoa: 'K68', role: 'lab_leader' },
  { email: '20232447@apes.edu.vn', mssv: '20232447', full_name: 'Lê Huy Đức Anh', khoa: 'K68', role: 'group_leader' },
  { email: '202413026@apes.edu.vn', mssv: '202413026', full_name: 'Ngô Bình Nam', khoa: 'K69', role: 'student' },
  { email: '202412801@apes.edu.vn', mssv: '202412801', full_name: 'Phạm Khắc Tiến', khoa: 'K69', role: 'student' },
  { email: '20232016@apes.edu.vn', mssv: '20232016', full_name: 'Trần Minh Đức', khoa: 'K68', role: 'group_leader' },
  { email: '202400011@apes.edu.vn', mssv: '202400011', full_name: 'Nguyễn Văn Hiếu', khoa: 'K69', role: 'student' },
  { email: '202412755@apes.edu.vn', mssv: '202412755', full_name: 'Bùi Xuân Sơn', khoa: 'K69', role: 'student' },
  { email: '20241839E@apes.edu.vn', mssv: '20241839E', full_name: 'Nguyễn Văn Phương', khoa: 'K68', role: 'student' },
  { email: '20232066@apes.edu.vn', mssv: '20232066', full_name: 'Hoàng Nguyên Hiệp', khoa: 'K68', role: 'group_leader' },
  { email: '20231944@apes.edu.vn', mssv: '20231944', full_name: 'Nguyễn Hoàng Minh Châu', khoa: 'K68', role: 'student' },
  { email: '202412624@apes.edu.vn', mssv: '202412624', full_name: 'Nguyễn Gia Luân', khoa: 'K69', role: 'student' },
  { email: '20232237@apes.edu.vn', mssv: '20232237', full_name: 'Nguyễn Nguyên Phong', khoa: 'K68', role: 'student' },
  { email: '20232040@apes.edu.vn', mssv: '20232040', full_name: 'Đoàn Tăng Duy', khoa: 'K68', role: 'student' },
  { email: '20232156@apes.edu.vn', mssv: '20232156', full_name: 'Tạ Trung Kiên', khoa: 'K68', role: 'student' },
  { email: '20232242@apes.edu.vn', mssv: '20232242', full_name: 'Ngô Đăng Phú', khoa: 'K68', role: 'student' },
  { email: '202412833@apes.edu.vn', mssv: '202412833', full_name: 'Phạm Đức Hoàng Tuấn', khoa: 'K69', role: 'student' },
  { email: '202412506@apes.edu.vn', mssv: '202412506', full_name: 'Lê Xuân Hiển', khoa: 'K69', role: 'student' },
  { email: '202412640@apes.edu.vn', mssv: '202412640', full_name: 'Phạm Công Minh', khoa: 'K69', role: 'student' },
  { email: '20212837@apes.edu.vn', mssv: '20212837', full_name: 'Nguyễn Đức Quang Huy', khoa: 'K68', role: 'student' },
  { email: '20231936@apes.edu.vn', mssv: '20231936', full_name: 'Vũ Thế Bảo', khoa: 'K68', role: 'group_leader' },
  { email: '20232254@apes.edu.vn', mssv: '20232254', full_name: 'Trần Hồng Quân', khoa: 'K68', role: 'student' },
  { email: '202412804@apes.edu.vn', mssv: '202412804', full_name: 'Nguyễn Trung Tín', khoa: 'K69', role: 'student' },
];

(async () => {
  // Step 1: Lấy danh sách user hiện tại (skip Admin-API test user)
  console.log('Step 1: Lấy danh sách user hiện tại...');
  const listRes = await fetch(`${URL}/auth/v1/admin/users?per_page=100`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  const listData = await listRes.json();
  const sqlInserted = listData.users?.filter(u => !u.email.startsWith('test-real-')) || [];
  console.log('  Tìm thấy', sqlInserted.length, 'user SQL-inserted cần xóa');

  // Step 2: Xóa 22 user
  console.log('\nStep 2: Xóa 22 user cũ...');
  for (const u of sqlInserted) {
    const delRes = await fetch(`${URL}/auth/v1/admin/users/${u.id}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    });
    console.log('  DELETE', u.email, '→', delRes.status);
  }

  // Step 3: Re-create 22 user qua Admin API
  console.log('\nStep 3: Re-create 22 user qua Admin API...');
  const results = [];
  for (const u of USERS) {
    const res = await fetch(`${URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
      },
      body: JSON.stringify({
        email: u.email,
        password: u.mssv,
        email_confirm: true,
        user_metadata: { mssv: u.mssv, full_name: u.full_name, khoa: u.khoa, role: u.role },
        app_metadata: { provider: 'email', providers: ['email'] },
      }),
    });
    const text = await res.text();
    if (res.ok) {
      const json = JSON.parse(text);
      results.push({ email: u.email, id: json.id, role: u.role });
      console.log('  ✓', u.email, '(role:', u.role + ')');
    } else {
      console.log('  ✗', u.email, '→', res.status, text.slice(0, 200));
    }
  }
  console.log('\nDone!', results.length, '/', USERS.length, 'users created.');

  // Step 4: Test login
  console.log('\nStep 4: Test login cho Trưởng Lab...');
  const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const loginRes = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ email: '20232276@apes.edu.vn', password: '20232276' }),
  });
  const loginText = await loginRes.text();
  console.log('  Status:', loginRes.status);
  if (loginRes.ok) {
    const j = JSON.parse(loginText);
    console.log('  ✓ LOGIN OK');
    console.log('  user_id:', j.user.id);
    console.log('  email:', j.user.email);
    console.log('  role (in metadata):', j.user.user_metadata?.role);
  } else {
    console.log('  ✗ LOGIN FAILED');
    console.log('  ', loginText.slice(0, 300));
  }
})();