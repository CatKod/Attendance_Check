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
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

(async () => {
  console.log('=== Test login on', URL);
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
    },
    body: JSON.stringify({
      email: '20232276@apes.edu.vn',
      password: '20232276',
    }),
  });
  const text = await res.text();
  console.log('Status:', res.status);
  const json = JSON.parse(text);
  if (res.ok) {
    console.log('✓ Login OK!');
    console.log('  user_id:', json.user?.id);
    console.log('  email:', json.user?.email);
    console.log('  role (in metadata):', json.user?.user_metadata?.role);
    console.log('  access_token (first 40):', json.access_token?.slice(0, 40) + '...');
  } else {
    console.log('✗ Login FAILED');
    console.log(JSON.stringify(json, null, 2));
  }
})();