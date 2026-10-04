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
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

(async () => {
  const email = 'test-real-' + Date.now() + '@apes.edu.vn';
  const password = 'TestPass123!';
  console.log('=== Test signup via Admin API for', email);

  const res = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { mssv: 'TEST001', full_name: 'Test User', khoa: 'K69', role: 'student' },
      app_metadata: { provider: 'email', providers: ['email'] },
    }),
  });
  const text = await res.text();
  console.log('Signup status:', res.status);
  const signup = JSON.parse(text);
  console.log('Signup:', JSON.stringify(signup, null, 2).slice(0, 800));

  if (res.ok) {
    console.log('\n=== Now test login for this newly-created user');
    const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const loginRes = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON,
        Authorization: `Bearer ${ANON}`,
      },
      body: JSON.stringify({ email, password }),
    });
    const loginText = await loginRes.text();
    console.log('Login status:', loginRes.status);
    if (loginRes.ok) {
      console.log('✓ LOGIN OK for Admin-API-created user!');
    } else {
      console.log('✗ LOGIN FAILED');
      console.log(loginText.slice(0, 500));
    }
  }
})();