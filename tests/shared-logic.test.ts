// ============================================================
// Kiểm thử logic dùng chung: subnet Wi-Fi, cửa sổ điểm danh, QR
// Chạy: node --test apps/mobile/__tests__/  (hoặc npm run test)
// ============================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  inSubnet,
  ipToNumber,
  normalizeMac,
  pickPrimaryIPv4,
  listIPv4s,
  getCheckinStatus,
  toMinutes,
  humanTime,
  normalizeMssv,
  isValidMssv,
  parseLinkPayload,
  tokenSecondsLeft,
  toCheckinWindows,
  type ScheduleSlot,
} from '../packages/shared-types/src/attendance.ts';

// ------------------------------------------------------------
// CIDR / subnet — cơ chế chống gian lận chính
// ------------------------------------------------------------
test('ipToNumber chuyển đúng', () => {
  assert.equal(ipToNumber('192.168.1.1'), 3232235777);
  assert.equal(ipToNumber('0.0.0.0'), 0);
  assert.equal(ipToNumber('255.255.255.255'), 4294967295);
  assert.equal(ipToNumber('192.168.1.256'), null);
  assert.equal(ipToNumber('192.168.1'), null);
  assert.equal(ipToNumber('abc'), null);
});

test('inSubnet nhận diện IP trong/bên ngoài subnet lab', () => {
  // Trong subnet
  assert.equal(inSubnet('192.168.1.55', '192.168.1.0/24'), true);
  assert.equal(inSubnet('192.168.1.1', '192.168.1.0/24'), true);
  assert.equal(inSubnet('192.168.1.254', '192.168.1.0/24'), true);

  // Ngoài subnet
  assert.equal(inSubnet('192.168.2.55', '192.168.1.0/24'), false);
  assert.equal(inSubnet('10.0.0.5', '192.168.1.0/24'), false);

  // /16
  assert.equal(inSubnet('10.0.5.9', '10.0.0.0/16'), true);
  assert.equal(inSubnet('10.1.5.9', '10.0.0.0/16'), false);

  // /32 - chính xác từng IP
  assert.equal(inSubnet('192.168.1.7', '192.168.1.7/32'), true);
  assert.equal(inSubnet('192.168.1.8', '192.168.1.7/32'), false);

  // /0 - mọi thứ
  assert.equal(inSubnet('8.8.8.8', '0.0.0.0/0'), true);

  // Input sai
  assert.equal(inSubnet('192.168.1.5', 'không-hợp-lệ'), false);
  assert.equal(inSubnet('192.168.1.5', '192.168.1.0/99'), false);
});

// ------------------------------------------------------------
// MAC address
// ------------------------------------------------------------
test('normalizeMac chuẩn hoá mọi định dạng', () => {
  assert.equal(normalizeMac('AA:BB:CC:DD:EE:FF'), 'aa:bb:cc:dd:ee:ff');
  assert.equal(normalizeMac('aa-bb-cc-dd-ee-ff'), 'aa:bb:cc:dd:ee:ff');
  assert.equal(normalizeMac('AABBCCDDEEFF'), null, 'thiếu dấu : phải trả null');
  assert.equal(normalizeMac(null), null);
  assert.equal(normalizeMac(''), null);
});

test('pickPrimaryIPv4 ưu tiên Wi-Fi hơn Ethernet', () => {
  const ifaces = {
    'Ethernet': [
      { address: '172.16.0.5', family: 'IPv4', internal: false, mac: 'aa:aa:aa:aa:aa:aa' },
    ],
    'Wi-Fi': [
      { address: '192.168.1.42', family: 'IPv4', internal: false, mac: 'BB:BB:BB:BB:BB:BB' },
    ],
    'Loopback': [
      { address: '127.0.0.1', family: 'IPv4', internal: true },
    ],
  };

  const r = pickPrimaryIPv4(ifaces);
  assert.ok(r);
  assert.equal(r.ip, '192.168.1.42', 'phải chọn Wi-Fi');
  assert.equal(r.mac, 'bb:bb:bb:bb:bb:bb');
});

test('pickPrimaryIPv4 bỏ qua IPv6 và loopback', () => {
  const ifaces = {
    'Wi-Fi': [
      { address: 'fe80::1', family: 'IPv6', internal: false },
      { address: '127.0.0.1', family: 'IPv4', internal: true },
    ],
  };
  assert.equal(pickPrimaryIPv4(ifaces), null);
});

test('listIPv4s liệt kê đầy đủ', () => {
  const ifaces = {
    'Wi-Fi': [{ address: '192.168.1.42', family: 'IPv4', internal: false }],
    'Loopback': [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
  };
  assert.deepEqual(listIPv4s(ifaces), ['Wi-Fi: 192.168.1.42']);
});

// ------------------------------------------------------------
// MSSV
// ------------------------------------------------------------
test('normalizeMssv bỏ khoảng trắng + viết hoa', () => {
  assert.equal(normalizeMssv(' 2023 2276 '), '20232276');
  assert.equal(normalizeMssv('2023e2276'), '2023E2276');
});

test('isValidMssv chấp nhận định dạng hợp lệ', () => {
  assert.equal(isValidMssv('20232276'), true);
  assert.equal(isValidMssv('2023227'), false, 'quá ngắn');
  assert.equal(isValidMssv('12345678901'), false, 'quá dài');
  assert.equal(isValidMssv('2023-2276'), false, 'có dấu gạch ngang');
  assert.equal(isValidMssv('ABCDEFGH'), true, 'chữ cái hợp lệ');
});

// ------------------------------------------------------------
// Cửa sổ điểm danh
// ------------------------------------------------------------
const slot = (
  start: string | null,
  end: string | null,
  allow = true
): ScheduleSlot => ({
  checkin_start_time: start,
  checkin_end_time: end,
  start_time: '00:00:00',
  end_time: '23:59:59',
  is_active: true,
  allow_checkin: allow,
});

test('toCheckinWindows chỉ lấy ca được bật, sắp xếp theo giờ', () => {
  const windows = toCheckinWindows([
    slot('14:00:00', '14:15:00'),
    slot('08:00:00', '08:15:00'),
    slot('10:00:00', '10:15:00', false), // tắt
  ]);

  assert.equal(windows.length, 2, 'loại ca bị tắt');
  assert.equal(windows[0].start, '08:00');
  assert.equal(windows[1].start, '14:00');
});

test('toCheckinWindows bỏ qua ca thiếu giờ', () => {
  const windows = toCheckinWindows([
    slot(null, null),
    slot('08:00:00', null),
    slot('08:00:00', '08:15:00'),
  ]);
  assert.equal(windows.length, 1);
});

test('getCheckinStatus: không có ca nào', () => {
  const s = getCheckinStatus([], new Date('2026-10-05T02:00:00Z')); // 09:00 VN
  assert.equal(s.state, 'none');
});

test('getCheckinStatus: đang mở', () => {
  // 09:00 giờ VN = 02:00 UTC
  const now = new Date('2026-10-05T02:00:00Z');
  const s = getCheckinStatus(
    [
      { start: '08:00', end: '08:15', label: '08:00 – 08:15', human: '' },
      { start: '09:00', end: '09:15', label: '09:00 – 09:15', human: '' },
    ],
    now
  );
  assert.equal(s.state, 'open');
  assert.equal(s.current?.label, '09:00 – 09:15');
});

test('getCheckinStatus: sắp mở, tính phút còn lại', () => {
  const now = new Date('2026-10-05T02:00:00Z'); // 09:00 VN
  const s = getCheckinStatus(
    [{ start: '09:30', end: '09:45', label: '09:30 – 09:45', human: '' }],
    now
  );
  assert.equal(s.state, 'upcoming');
  assert.equal(s.minutesToNext, 30);
});

test('getCheckinStatus: đã đóng', () => {
  const now = new Date('2026-10-05T09:00:00Z'); // 16:00 VN
  const s = getCheckinStatus(
    [{ start: '08:00', end: '08:15', label: '08:00 – 08:15', human: '' }],
    now
  );
  assert.equal(s.state, 'closed');
});

test('getCheckinStatus: chọn đúng ca khi các ca chồng nhau', () => {
  // 10:00 VN
  const now = new Date('2026-10-05T03:00:00Z');
  const s = getCheckinStatus(
    [
      { start: '09:00', end: '10:30', label: 'A', human: '' },
      { start: '10:00', end: '11:00', label: 'B', human: '' },
    ],
    now
  );
  assert.equal(s.state, 'open');
  assert.ok(s.current);
  assert.ok(['A', 'B'].includes(s.current.label));
});

test('toMinutes và humanTime', () => {
  assert.equal(toMinutes('00:00:00'), 0);
  assert.equal(toMinutes('08:30:00'), 510);
  assert.equal(toMinutes('23:59:00'), 1439);
  assert.equal(humanTime('08:30:00'), '8:30 sáng');
  assert.equal(humanTime('13:05:00'), '1:05 chiều');
  assert.equal(humanTime('00:00:00'), '12:00 sáng');
});

// ------------------------------------------------------------
// QR liên kết
// ------------------------------------------------------------
test('parseLinkPayload đọc được JSON thuần', () => {
  const p = parseLinkPayload(
    JSON.stringify({
      v: 1,
      t: 'abc123',
      u: 'user-uuid',
      m: '20232276',
      n: 'Nguyễn Văn A',
      e: new Date(Date.now() + 60000).toISOString(),
    })
  );
  assert.ok(p);
  assert.equal(p.t, 'abc123');
  assert.equal(p.m, '20232276', 'trường MSSV trong QR là `m`');
  assert.equal(p.n, 'Nguyễn Văn A', 'trường họ tên trong QR là `n`');
  assert.equal(p.u, 'user-uuid');
});

test('parseLinkPayload đọc được URI apes://', () => {
  const inner = JSON.stringify({
    v: 1, t: 'tok', u: 'uid', m: '1', n: 'x',
    e: new Date().toISOString(),
  });
  const p = parseLinkPayload(`apes://link?d=${encodeURIComponent(inner)}`);
  assert.ok(p);
  assert.equal(p.t, 'tok');
});

test('parseLinkPayload từ chối dữ liệu rác', () => {
  assert.equal(parseLinkPayload(''), null);
  assert.equal(parseLinkPayload('hello'), null);
  assert.equal(parseLinkPayload('{"v":2,"t":"x","u":"y"}'), null, 'sai version');
  assert.equal(parseLinkPayload('apes://link'), null, 'thiếu tham số');
});

test('tokenSecondsLeft đếm ngược đúng', () => {
  const now = new Date('2026-10-05T00:00:00Z');
  const p = {
    v: 1 as const, t: 't', u: 'u', m: '1', n: 'n',
    e: '2026-10-05T00:01:00.000Z',
  };
  assert.equal(tokenSecondsLeft(p, now), 60);

  const expired = { ...p, e: '2026-10-04T23:59:00.000Z' };
  assert.equal(tokenSecondsLeft(expired, now), 0, 'hết hạn → 0, không âm');
});
