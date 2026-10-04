// Test query count users qua PostgREST giả lập client
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
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

(async () => {
  // 1) Service role - bypass RLS
  const sr = await fetch(`${URL}/rest/v1/users?select=id&head=true`, {
    method: 'HEAD',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, Prefer: 'count=exact' },
  });
  console.log('Service role count:', sr.headers.get('content-range'));

  // 2) Anon key - áp dụng RLS
  const ar = await fetch(`${URL}/rest/v1/users?select=id&head=true`, {
    method: 'HEAD',
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, Prefer: 'count=exact' },
  });
  console.log('Anon key count (RLS):', ar.headers.get('content-range'));
  console.log('Anon status:', ar.status);

  // 3) Anon key truy vấn lấy current user (lab_leader) - dùng auth header
  const lr = await fetch(`${URL}/rest/v1/users?id=eq.975b4216-42f3-41b2-b994-a4b303064eaf&select=role`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  console.log('Anon role check:', lr.status, await lr.text());
})();