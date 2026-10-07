// Dùng để debug: in ra tất cả network interfaces và lý do bị chọn/bỏ qua
// Chạy: node debug-interfaces.js
const os = require('os');

const ifaces = os.networkInterfaces();
console.log('=== Tất cả interface Node nhìn thấy ===\n');

for (const [name, addrs] of Object.entries(ifaces)) {
  if (!addrs) continue;
  for (const addr of addrs) {
    const family = typeof addr.family === 'number' ? `IPv${addr.family}` : addr.family;
    console.log(`Interface: ${name}`);
    console.log(`  family   : ${family}`);
    console.log(`  internal : ${addr.internal}  ${addr.internal ? '(loopback - sẽ bị bỏ)' : ''}`);
    console.log(`  address  : ${addr.address}`);
    console.log(`  netmask  : ${addr.netmask}`);
    console.log(`  mac      : ${addr.mac}`);
    console.log(`  cidr     : ${addr.cidr ?? 'n/a'}`);
    console.log('');
  }
}
