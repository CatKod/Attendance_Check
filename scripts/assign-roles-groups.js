// Update role + group_id cho 22 user (Admin API tạo user với role=student default từ trigger)
// Sử dụng public.users.id = auth.users.id (1-1 match)

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

const GROUP_MAP = {
  'Sạc pin': ['20232447@apes.edu.vn', '202413026@apes.edu.vn', '202412801@apes.edu.vn'],
  'BESS': ['20232016@apes.edu.vn', '202400011@apes.edu.vn', '202412755@apes.edu.vn', '20241839E@apes.edu.vn'],
  'WPT động': ['20232066@apes.edu.vn', '20231944@apes.edu.vn', '202412624@apes.edu.vn'],
  'WPT tĩnh': ['20232237@apes.edu.vn', '20232040@apes.edu.vn', '20232156@apes.edu.vn'],
  'Plasma': ['20232242@apes.edu.vn', '202412833@apes.edu.vn', '202412506@apes.edu.vn', '202412640@apes.edu.vn', '20212837@apes.edu.vn'],
  'BMS': ['20231936@apes.edu.vn', '20232254@apes.edu.vn', '202412804@apes.edu.vn'],
};

const LEADER_BY_GROUP = {
  'Sạc pin': '20232447@apes.edu.vn',
  'BESS': '20232016@apes.edu.vn',
  'WPT động': '20232066@apes.edu.vn',
  'BMS': '20231936@apes.edu.vn',
};

(async () => {
  // Lấy danh sách auth.users
  const listRes = await fetch(`${URL}/auth/v1/admin/users?per_page=100`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  const listData = await listRes.json();
  console.log('Total auth users:', listData.users?.length);

  // Build map email → auth_id
  const emailToId = {};
  for (const u of listData.users || []) {
    emailToId[u.email] = u.id;
  }
  console.log('Email → ID map size:', Object.keys(emailToId).length);

  // Lấy group_id theo name
  const listGroups = await fetch(`${URL}/rest/v1/groups?select=id,name`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  const groups = await listGroups.json();
  const groupNameToId = {};
  for (const g of groups) groupNameToId[g.name] = g.id;
  console.log('Groups:', Object.keys(groupNameToId));

  // Lấy danh sách public.users hiện tại
  const pubUsers = await fetch(`${URL}/rest/v1/users?select=id,mssv,role,group_id,email`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  const pubData = await pubUsers.json();
  console.log('Public users count:', pubData.length);
  const pubById = {};
  for (const u of pubData) pubById[u.id] = u;

  // 1) Cập nhật role cho Trưởng Lab
  console.log('\n=== Step 1: Set Trưởng Lab role ===');
  const labLeaderId = emailToId['20232276@apes.edu.vn'];
  if (labLeaderId) {
    const r = await fetch(`${URL}/rest/v1/users?id=eq.${labLeaderId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ role: 'lab_leader', group_id: null }),
    });
    console.log('  Trưởng Lab role update →', r.status);
  }

  // 2) Cập nhật group_id cho student + set role=student, set leader_id cho groups
  console.log('\n=== Step 2: Assign group_id + leader_id ===');
  for (const [groupName, emails] of Object.entries(GROUP_MAP)) {
    const groupId = groupNameToId[groupName];
    if (!groupId) {
      console.log('  Group not found:', groupName);
      continue;
    }
    const leaderEmail = LEADER_BY_GROUP[groupName];
    let leaderId = null;
    if (leaderEmail) {
      leaderId = emailToId[leaderEmail];
      // Set group leader role + group_id
      const r = await fetch(`${URL}/rest/v1/users?id=eq.${leaderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE,
          Authorization: `Bearer ${SERVICE}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ role: 'group_leader', group_id: groupId }),
      });
      console.log(`  [${groupName}] Leader ${leaderEmail} → role=group_leader, group_id=${groupId.slice(0, 8)}... status=${r.status}`);
    }

    // Set leader_id cho group
    if (leaderId) {
      const r = await fetch(`${URL}/rest/v1/groups?id=eq.${groupId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE,
          Authorization: `Bearer ${SERVICE}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ leader_id: leaderId }),
      });
      console.log(`  [${groupName}] group.leader_id → ${leaderId.slice(0, 8)}... status=${r.status}`);
    }

    // Set group_id cho các student trong group
    for (const email of emails) {
      if (email === leaderEmail) continue; // đã xử lý ở trên
      const id = emailToId[email];
      if (!id) {
        console.log(`  [${groupName}] User not found: ${email}`);
        continue;
      }
      const r = await fetch(`${URL}/rest/v1/users?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE,
          Authorization: `Bearer ${SERVICE}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ group_id: groupId }),
      });
      console.log(`  [${groupName}] ${email} → group_id status=${r.status}`);
    }
  }

  console.log('\n=== Verify ===');
  const finalUsers = await fetch(`${URL}/rest/v1/users?select=mssv,full_name,role,group_id&order=role.desc,mssv`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  const finalData = await finalUsers.json();
  console.log('Final users:');
  for (const u of finalData.slice(0, 25)) {
    console.log(`  ${u.mssv} - ${u.full_name} - role=${u.role} - group_id=${u.group_id ? u.group_id.slice(0, 8) : 'NULL'}`);
  }
  console.log('Total:', finalData.length);
})();