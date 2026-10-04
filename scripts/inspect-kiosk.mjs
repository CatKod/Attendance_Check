// Kiểm tra UI kiosk đang chạy qua Chrome DevTools Protocol.
// Dùng: node scripts/inspect-kiosk.mjs [--screenshot out.png]
import { writeFileSync } from 'node:fs';

const PORT = process.env.CDP_PORT ?? '9222';
const base = `http://127.0.0.1:${PORT}`;

async function main() {
  const targets = await (await fetch(`${base}/json`)).json();
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('Không tìm thấy trang nào');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });

  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const myId = ++id;
      pending.set(myId, resolve);
      ws.send(JSON.stringify({ id: myId, method, params }));
    });

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return r.result?.result?.value;
  };

  // 1) Text hiển thị
  const text = await evaluate('document.body.innerText');
  console.log('=== TEXT HIỂN THỊ ===');
  console.log(text);

  // 2) Tiêu đề
  const title = await evaluate('document.title');
  console.log('\n=== TITLE ===');
  console.log(title);

  // 3) Kiểm tra bridge window.kiosk đã expose chưa
  const bridge = await evaluate(
    'JSON.stringify(Object.keys(window.kiosk || {}))'
  );
  console.log('\n=== PRELOAD BRIDGE (window.kiosk) ===');
  console.log(bridge);

  // 4) Thông tin mạng từ main process
  const net = await evaluate('window.kiosk.getNetworkInfo()');
  console.log('\n=== THÔNG TIN MẠNG MÁY KIOSK ===');
  console.log(JSON.stringify(net, null, 2));

  // 5) Cấu hình
  const cfg = await evaluate('window.kiosk.getConfig()');
  console.log('\n=== CẤU HÌNH ===');
  console.log(JSON.stringify(cfg, null, 2));

  // 6) Ảnh chụp
  const shotArg = process.argv.indexOf('--screenshot');
  if (shotArg !== -1 && process.argv[shotArg + 1]) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot.result?.data) {
      writeFileSync(process.argv[shotArg + 1], Buffer.from(shot.result.data, 'base64'));
      console.log(`\n=== ĐÃ LƯU ẢNH: ${process.argv[shotArg + 1]} ===`);
    }
  }

  ws.close();
}

main().catch((e) => {
  console.error('Lỗi:', e.message);
  process.exit(1);
});
