// Tạo auth user qua Supabase Admin API
// Service role key đọc từ apps/web-admin/.env.local (absolute path)

const fs = require('fs');

// Đọc .env.local — dùng absolute path để tránh __dirname phụ thuộc cwd
const envPath = 'D:\\GitHub\\Attendance_Check\\apps\\web-admin\\.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq < 0) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim();
  env[key] = value;
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Thiếu SUPABASE_URL hoặc SERVICE_ROLE_KEY trong .env.local');
  process.exit(1);
}

if (SERVICE_ROLE_KEY.includes('replace_me')) {
  console.error('❌ SERVICE_ROLE_KEY vẫn là placeholder — hãy paste key thật');
  process.exit(1);
}

// Chỉ tạo Trưởng Lab trước để test login
const users = [
  { email: '20232276@apes.edu.vn', password: '20232276', name: 'Nguyễn Trọng Quyết', mssv: '20232276' },
];

async function createUser(user) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.name, mssv: user.mssv },
    }),
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body, user };
}

(async () => {
  console.log(`🚀 Tạo ${users.length} auth user...\n`);
  for (const u of users) {
    const { status, body } = await createUser(u);
    if (status >= 200 && status < 300) {
      console.log(`✅ ${u.email}  →  id=${body.id}`);
    } else {
      const msg = body?.msg || body?.message || JSON.stringify(body);
      // 422 với "already been registered" là OK (đã tồn tại)
      if (status === 422 && msg.toLowerCase().includes('already')) {
        console.log(`⏭  ${u.email}  →  đã tồn tại (skip)`);
      } else {
        console.log(`❌ ${u.email}  →  HTTP ${status}: ${msg}`);
      }
    }
  }
  console.log('\n✨ Xong.');
})();