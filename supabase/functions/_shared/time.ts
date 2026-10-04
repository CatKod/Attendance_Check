// ============================================================
// Deno Edge Function: _shared/time.ts
// Xử lý giờ theo múi giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7)
// ============================================================

/** Thứ trong tuần theo giờ VN: 0=CN, 1=T2, ..., 6=T7 */
export function vietnamDayOfWeek(d: Date = new Date()): number {
  // Lấy chuỗi ngày theo giờ VN rồi tính lại → tránh lệch do UTC
  const vnDate = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return vnDate.getUTCDay();
}

/** Ngày theo định dạng YYYY-MM-DD theo giờ VN */
export function vietnamDateISO(d: Date = new Date()): string {
  return new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Số phút từ 00:00 theo giờ VN */
export function vietnamMinutes(d: Date = new Date()): number {
  const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return vn.getUTCHours() * 60 + vn.getUTCMinutes();
}

/** Một dòng trả về từ RPC get_checkin_windows */
export interface CheckinWindowRow {
  schedule_id: string;
  checkin_start: string;
  checkin_end: string;
}

/** Định dạng cửa sổ điểm danh gửi về client */
export function formatWindows(
  windows: CheckinWindowRow[] | null | undefined
) {
  return (windows ?? []).map((w) => ({
    start: hm(w.checkin_start),
    end: hm(w.checkin_end),
    label: `${hm(w.checkin_start)} – ${hm(w.checkin_end)}`,
    human: `${humanTime(w.checkin_start)} – ${humanTime(w.checkin_end)}`,
  }));
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

/** '08:30' -> '8:30 sáng' */
export function humanTime(time: string): string {
  const total = toMinutes(time);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const period = h < 12 ? 'sáng' : h < 17 ? 'chiều' : 'tối';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}
