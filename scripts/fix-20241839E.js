// Fix email 20241839e -> 20241839E + assign group BESS
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

(async () => {
  const userId = 'a1e129c9-4cbd-4f12-aa1c-efea89f3f3be';

  // Update email via Admin API
  const r = await fetch(`${URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
    },
    body: JSON.stringify({ email: '20241839E@apes.edu.vn', email_confirm: true }),
  });
  const text = await r.text();
  console.log('Update email →', r.status);
  console.log(text.slice(0, 500));

  if (r.ok) {
    // Get BESS group_id
    const g = await fetch(`${URL}/rest/v1/groups?name=eq.BESS&select=id`, {
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    });
    const gj = await g.json();
    const bessId = gj[0]?.id;
    console.log('BESS group_id:', bessId);

    // Update public.users.group_id
    const r2 = await fetch(`${URL}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ group_id: bessId }),
    });
    console.log('Update group_id →', r2.status);

    // Verify
    const v = await fetch(`${URL}/auth/v1/admin/users/${userId}`, {
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    });
    console.log('Verify:', JSON.stringify(await v.json(), null, 2).slice(0, 500));
  }
})();