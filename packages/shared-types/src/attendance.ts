// ============================================================
// Logic dùng chung cho Desktop App (Electron) và Mobile App (Expo).
// Không import gì từ React/Native/Electron để chạy được mọi nơi.
// ============================================================

/** Cấu hình runtime, đọc từ biến môi trường */
export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** URL Edge Function, VD: https://<ref>.supabase.co/functions/v1 */
  functionsUrl: string;
  labName: string;
}

export function readConfig(env: Record<string, string | undefined>): AppConfig {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  return {
    supabaseUrl,
    supabaseAnonKey:
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    functionsUrl:
      env.FUNCTIONS_URL ?? `${supabaseUrl.replace(/\/$/, '')}/functions/v1`,
    labName: env.LAB_NAME ?? 'APES Lab',
  };
}

export function assertConfig(cfg: AppConfig): void {
  const missing: string[] = [];
  if (!cfg.supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!cfg.supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (missing.length) {
    throw new Error(
      `Thiếu cấu hình: ${missing.join(', ')}. Hãy copy .env.example thành .env rồi điền.`
    );
  }
}

// ============================================================
// CỬA SỔ ĐIỂM DANH
// ============================================================

export interface CheckinWindow {
  start: string; // 'HH:MM'
  end: string; // 'HH:MM'
  label: string; // '08:00 – 08:15'
  human: string; // '8:00 sáng – 8:15 sáng'
}

export interface ScheduleSlot {
  checkin_start_time: string | null;
  checkin_end_time: string | null;
  start_time: string;
  end_time: string;
  is_active: boolean;
  allow_checkin: boolean | null;
}

/** '08:00:00' -> '08:00' */
export function hm(time: string): string {
  return time.slice(0, 5);
}

/** '08:30:00' -> 510 */
export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** 510 -> '08:30' */
export function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** '08:30' -> '8:30 sáng' */
export function humanTime(time: string): string {
  const total = toMinutes(time);
  const h = Math.floor(total / 60);
  const period = h < 12 ? 'sáng' : h < 17 ? 'chiều' : 'tối';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(total % 60).padStart(2, '0')} ${period}`;
}

/** Ca có thực sự mở cửa sổ điểm danh không */
export function isCheckinSlotOpen(s: ScheduleSlot): boolean {
  return Boolean(
    s.is_active && s.allow_checkin && s.checkin_start_time && s.checkin_end_time
  );
}

/** Lọc ra các ca được phép điểm danh, sắp xếp theo giờ */
export function openCheckinSlots(slots: ScheduleSlot[]): ScheduleSlot[] {
  return slots
    .filter(isCheckinSlotOpen)
    .sort((a, b) => toMinutes(a.checkin_start_time!) - toMinutes(b.checkin_start_time!));
}

/** Chuyển danh sách ca của ngày hôm nay thành cửa sổ điểm danh để hiển thị */
export function toCheckinWindows(slots: ScheduleSlot[]): CheckinWindow[] {
  return openCheckinSlots(slots).map((s) => ({
    start: hm(s.checkin_start_time!),
    end: hm(s.checkin_end_time!),
    label: `${hm(s.checkin_start_time!)} – ${hm(s.checkin_end_time!)}`,
    human: `${humanTime(s.checkin_start_time!)} – ${humanTime(s.checkin_end_time!)}`,
  }));
}

/** Số phút hiện tại theo giờ Việt Nam (UTC+7) */
export function vietnamNowMinutes(d: Date = new Date()): number {
  const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return vn.getUTCHours() * 60 + vn.getUTCMinutes();
}

/** Thứ trong tuần theo giờ VN: 0=CN .. 6=T7 */
export function vietnamDayOfWeek(d: Date = new Date()): number {
  return new Date(d.getTime() + 7 * 60 * 60 * 1000).getUTCDay();
}

export type CheckinState = 'open' | 'upcoming' | 'closed' | 'none';

export interface CheckinStatus {
  state: CheckinState;
  /** Cửa sổ đang mở, nếu có */
  current: CheckinWindow | null;
  /** Cửa sổ sắp tới gần nhất, nếu có */
  next: CheckinWindow | null;
  /** Số phút tới cửa sổ kế tiếp (null nếu không có) */
  minutesToNext: number | null;
  all: CheckinWindow[];
  message: string;
}

/**
 * Tính trạng thái điểm danh hôm nay từ danh sách cửa sổ.
 * Dùng chung cho Desktop và Mobile để hiển thị giống nhau.
 */
export function getCheckinStatus(
  windows: CheckinWindow[],
  now: Date = new Date()
): CheckinStatus {
  const all = [...windows].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const nowMins = vietnamNowMinutes(now);

  if (all.length === 0) {
    return {
      state: 'none',
      current: null,
      next: null,
      minutesToNext: null,
      all,
      message: 'Hôm nay không mở điểm danh',
    };
  }

  let current: CheckinWindow | null = null;
  let next: CheckinWindow | null = null;

  for (const w of all) {
    const s = toMinutes(w.start);
    const e = toMinutes(w.end);
    if (nowMins >= s && nowMins <= e) {
      current = w;
    } else if (nowMins < s && !next) {
      next = w;
    }
  }

  if (current) {
    return {
      state: 'open',
      current,
      next,
      minutesToNext: null,
      all,
      message: `Đang mở điểm danh (${current.label})`,
    };
  }

  if (next) {
    const mins = toMinutes(next.start) - nowMins;
    return {
      state: 'upcoming',
      current: null,
      next,
      minutesToNext: mins,
      all,
      message:
        mins <= 60
          ? `Sắp mở điểm danh sau ${mins} phút (${next.label})`
          : `Điểm danh mở lúc ${next.label}`,
    };
  }

  return {
    state: 'closed',
    current: null,
    next: null,
    minutesToNext: null,
    all,
    message: 'Đã hết giờ điểm danh hôm nay',
  };
}

// ============================================================
// MẠNG & ĐỊNH DANH THIẾT BỊ
// ============================================================

/** IPv4 -> số nguyên 32-bit. Trả null nếu không hợp lệ. */
export function ipToNumber(ip: string): number | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) + v;
  }
  return n >>> 0;
}

/** Kiểm tra IPv4 có thuộc CIDR không. VD: inSubnet('192.168.1.55', '192.168.1.0/24') */
export function inSubnet(ip: string, cidr: string): boolean {
  const [subnetIp, prefixStr] = cidr.split('/');
  const prefix = Number(prefixStr);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;

  const ipNum = ipToNumber(ip);
  const subnetNum = ipToNumber(subnetIp);
  if (ipNum === null || subnetNum === null) return false;

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipNum & mask) === (subnetNum & mask);
}

export interface NetworkInterfaceAddress {
  address: string;
  /** Node trả về 'IPv4' (string) hoặc 4 (number) tuỳ phiên bản */
  family: string | number;
  internal: boolean;
  mac?: string;
}

export type NetworkInterfaceInfo = Record<
  string,
  NetworkInterfaceAddress[] | undefined
>;

/** Lọc các interface đang UP và có IPv4, ưu tiên mạng không phải loopback. */
export function pickPrimaryIPv4(interfaces: NetworkInterfaceInfo): {
  ip: string;
  iface: string;
  mac: string | null;
} | null {
  const candidates: { ip: string; iface: string; mac: string | null; score: number }[] =
    [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      const family = typeof addr.family === 'number' ? `IPv${addr.family}` : addr.family;
      if (family !== 'IPv4' || addr.internal) continue;

      // Ưu tiên wlan/wi-fi, rồi ethernet, cuối cùng mới là loại khác
      const lower = name.toLowerCase();
      let score = 1;
      if (lower.startsWith('wlan') || lower.includes('wi-fi') || lower.includes('wireless')) score = 3;
      else if (lower.startsWith('eth') || lower.includes('ethernet')) score = 2;

      candidates.push({ ip: addr.address, iface: name, mac: addr.mac ?? null, score });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return { ip: best.ip, iface: best.iface, mac: normalizeMac(best.mac) };
}

/** Liệt kê mọi IPv4 đang hoạt động, định dạng "wlan: 192.168.1.5" */
export function listIPv4s(interfaces: NetworkInterfaceInfo): string[] {
  const out: string[] = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      const family =
        typeof addr.family === 'number' ? `IPv${addr.family}` : addr.family;
      if (family === 'IPv4' && !addr.internal) out.push(`${name}: ${addr.address}`);
    }
  }
  return out;
}

/** Chuẩn hoá MAC về dạng aa:bb:cc:dd:ee:ff (lowercase) */
export function normalizeMac(mac: string | null | undefined): string | null {
  if (!mac) return null;
  const cleaned = mac.replace(/-/g, ':').replace(/\s/g, '').toLowerCase();
  const parts = cleaned.split(':');
  if (parts.length !== 6) return null;
  return parts.map((p) => p.padStart(2, '0').slice(0, 2)).join(':');
}

// ============================================================
// QR LIÊN KẾT
// ============================================================

export interface LinkPayload {
  v: 1;
  /** token đổi lấy session */
  t: string;
  /** user_id */
  u: string;
  /** mssv (hiển thị cho SV để đối chiếu) */
  m: string;
  /** họ tên */
  n: string;
  /** thời điểm hết hạn ISO */
  e: string;
}

/** Parse nội dung QR thành LinkPayload. Hỗ trợ cả URI lẫn JSON thuần. */
export function parseLinkPayload(raw: string): LinkPayload | null {
  if (!raw) return null;
  let text = raw.trim();

  // QR có thể là apes://link?d=<urlencoded json>
  if (text.startsWith('apes://')) {
    const qIndex = text.indexOf('?');
    if (qIndex === -1) return null;
    const params = new URLSearchParams(text.slice(qIndex + 1));
    const d = params.get('d');
    if (!d) return null;
    text = d;
  }

  try {
    const obj = JSON.parse(text);
    if (obj && obj.v === 1 && typeof obj.t === 'string' && typeof obj.u === 'string') {
      return obj as LinkPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/** Số giây còn lại trước khi token hết hạn */
export function tokenSecondsLeft(payload: LinkPayload, now: Date = new Date()): number {
  const exp = new Date(payload.e).getTime();
  return Math.max(0, Math.round((exp - now.getTime()) / 1000));
}

// ============================================================
// MISC
// ============================================================

/** Chuẩn hoá MSSV: bỏ khoảng trắng, viết hoa */
export function normalizeMssv(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

/** MSSV hợp lệ: 8-10 ký tự, chữ/số (hỗ trợ dạng 20241839E) */
export function isValidMssv(mssv: string): boolean {
  return /^[A-Z0-9]{8,10}$/.test(mssv);
}

export function formatClock(d: Date = new Date()): string {
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDateVi(d: Date = new Date()): string {
  return d.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
