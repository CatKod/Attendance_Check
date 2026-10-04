// Test login + dashboard count
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
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

(async () => {
  // Login
  const loginRes = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ email: '20232276@apes.edu.vn', password: '20232276' }),
  });
  const loginJson = await loginRes.json();
  console.log('Login status:', loginRes.status);
  if (!loginRes.ok) { console.log('FAIL', loginJson); return; }
  const token = loginJson.access_token;
  const userId = loginJson.user.id;
  console.log('User:', loginJson.user.email, '| id:', userId);

  // Query count users as authed user
  const cntRes = await fetch(`${URL}/rest/v1/users?select=id&head=true`, {
    method: 'HEAD',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      Prefer: 'count=exact',
    },
  });
  console.log('Count users (authed):', cntRes.headers.get('content-range'));
  console.log('Status:', cntRes.status);

  // Query count groups
  const grpRes = await fetch(`${URL}/rest/v1/groups?select=id&head=true`, {
    method: 'HEAD',
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, Prefer: 'count=exact' },
  });
  console.log('Count groups (authed):', grpRes.headers.get('content-range'));

  // List users with details
  const usersRes = await fetch(`${URL}/rest/v1/users?select=mssv,full_name,role,group_id&order=role.desc,mssv`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
  const users = await usersRes.json();
  console.log('List users status:', usersRes.status);
  console.log('Users count:', users.length);
  for (const u of users) {
    console.log(`  ${u.mssv} - ${u.full_name} - ${u.role} - group=${u.group_id ? u.group_id.slice(0, 8) : 'NULL'}`);
  }
})();