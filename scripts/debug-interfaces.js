// scripts/debug-interfaces.js
// ============================================
// In ra:
//   1. Tất cả network interface Node thấy
//   2. Cái mà pickPrimaryIPv4() sẽ CHỌN (theo logic hiện tại)
//   3. Registry session hiện tại (HKCU\Software\APES-Lab\Kiosk) nếu có
//   4. Kết luận: MAC chọn có khớp MAC lưu trong registry không
//
// Chạy:  node scripts/debug-interfaces.js
// Yêu cầu: Node 20+. Trên Windows sẽ đọc được registry qua reg.exe.
// ============================================

const os = require('os');
const { execFileSync } = require('child_process');

// ------------------------------------------------------------
// 1. In tất cả interface
// ------------------------------------------------------------
console.log('=== [1] Tất cả interface Node nhìn thấy ===\n');
const ifaces = os.networkInterfaces();

const all = [];
for (const [name, addrs] of Object.entries(ifaces)) {
  if (!addrs) continue;
  for (const addr of addrs) {
    const family = typeof addr.family === 'number' ? `IPv${addr.family}` : addr.family;
    all.push({ name, family, ...addr });
    console.log(`Interface: ${name}`);
    console.log(`  family   : ${family}`);
    console.log(`  internal : ${addr.internal}  ${addr.internal ? '(loopback - bị bỏ)' : ''}`);
    console.log(`  address  : ${addr.address}`);
    console.log(`  netmask  : ${addr.netmask}`);
    console.log(`  mac      : ${addr.mac}`);
    console.log(`  cidr     : ${addr.cidr ?? 'n/a'}`);
    console.log('');
  }
}

// ------------------------------------------------------------
// 2. Mô phỏng pickPrimaryIPv4() — copy logic từ shared-types
// ------------------------------------------------------------
console.log('=== [2] pickPrimaryIPv4() chọn cái nào? ===\n');

function normalizeMac(mac) {
  if (!mac) return null;
  return mac.toLowerCase().split(':').map((p) => p.padStart(2, '0')).join(':');
}

const candidates = [];
for (const { name, family, internal, address, mac } of all) {
  if (family !== 'IPv4' || internal) continue;
  const lower = name.toLowerCase();
  let score = 1;
  if (lower.startsWith('wlan') || lower.includes('wi-fi') || lower.includes('wireless')) score = 3;
  else if (lower.startsWith('eth') || lower.includes('ethernet')) score = 2;
  candidates.push({ name, ip: address, mac, score });
}

candidates.sort((a, b) => b.score - a.score);
console.log('Bảng xếp hạng (cao → thấp):');
for (const c of candidates) {
  console.log(`  score=${c.score}  ${c.name.padEnd(20)} ip=${c.ip.padEnd(15)} mac=${c.mac}`);
}

if (candidates.length === 0) {
  console.log('\n⚠️  KHÔNG có IPv4 interface nào (chỉ có loopback hoặc Wi-Fi/Ethernet chưa bật)');
  process.exit(0);
}

const picked = candidates[0];
const pickedMac = normalizeMac(picked.mac);
console.log(`\n→ PICKED: ${picked.name} | ip=${picked.ip} | mac=${pickedMac}`);

// ------------------------------------------------------------
// 3. Đọc Registry (Windows) để so sánh MAC đã lưu
// ------------------------------------------------------------
console.log('\n=== [3] Session đã lưu trong Registry ===\n');

let savedMac = null;
let savedMssv = null;
let savedUserId = null;
let savedAt = null;

if (process.platform === 'win32') {
  const REG_PATH = 'HKCU\\Software\\APES-Lab\\Kiosk';
  try {
    const buf = execFileSync('reg.exe', ['query', REG_PATH], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    // REG_SZ là UTF-16LE nội bộ, decode đúng chuẩn
    const text = buf.toString('utf16le');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*(\S+)\s+REG_SZ\s+(.*)$/);
      if (!m) continue;
      const key = m[1];
      const val = m[2].trim();
      if (key === 'BoundMac') savedMac = val;
      if (key === 'BoundMssv') savedMssv = val;
      if (key === 'BoundUserId') savedUserId = val;
      if (key === 'BoundAt') savedAt = val;
    }
  } catch {
    console.log('(Không tìm thấy key Registry — chưa từng đăng nhập trên máy này)');
  }
} else {
  console.log('(Bỏ qua: script đang chạy trên ' + process.platform + ', chỉ test trên Windows)');
}

console.log(`  MSSV   : ${savedMssv ?? '(rỗng)'}`);
console.log(`  userId : ${savedUserId ?? '(rỗng)'}`);
console.log(`  MAC    : ${savedMac ?? '(rỗng)'}`);
console.log(`  boundAt: ${savedAt ?? '(rỗng)'}`);

// ------------------------------------------------------------
// 4. Kết luận
// ------------------------------------------------------------
console.log('\n=== [4] Kết luận ===\n');

if (!savedMac) {
  console.log('ℹ️  Chưa có session trong Registry → app sẽ hiển thị màn nhập MSSV (bình thường).');
} else if (savedMac === pickedMac) {
  console.log('✅ MAC KHỚP → auto-login sẽ thành công, không hiện màn MSSV.');
} else {
  console.log('❌ MAC KHÔNG KHỚP:');
  console.log(`   Registry : ${savedMac}`);
  console.log(`   Hiện tại : ${pickedMac}  (interface: ${picked.name})`);
  console.log('\n   → Đây là nguyên nhân app hiện màn nhập MSSV dù đã đăng nhập trước đó.');
  console.log('   → Logic hiện tại: MAC lưu ≠ MAC chọn → xoá session → setScreen("mssv").');
  console.log('\n   Gợi ý xử lý:');
  console.log('   - Nếu chỉ có 1 interface vật lý (Wi-Fi/Ethernet) → đây là bug của Node, cần fix.');
  console.log('   - Nếu có nhiều interface (vd: Wi-Fi + Ethernet) → chọn nhầm cái không dùng.');
}