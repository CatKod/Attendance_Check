// GET /admin/users — list tất cả user để check project status
const fs = require('fs');

const envContent = fs.readFileSync('D:\\GitHub\\Attendance_Check\\apps\\web-admin\\.env.local', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq < 0) continue;
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

(async () => {
  const res = await fetch(`${URL}/auth/v1/admin/users?page=1&per_page=5`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Body (first 1500 chars):');
  console.log(text.slice(0, 1500));
})();