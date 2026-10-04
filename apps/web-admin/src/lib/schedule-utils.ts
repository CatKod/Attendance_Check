/**
 * Logic thuần cho tab Lịch Lab.
 * Tách riêng khỏi component để dễ test và dùng lại.
 */

export const DAYS = [
  { value: 1, label: 'Thứ 2', short: 'T2' },
  { value: 2, label: 'Thứ 3', short: 'T3' },
  { value: 3, label: 'Thứ 4', short: 'T4' },
  { value: 4, label: 'Thứ 5', short: 'T5' },
  { value: 5, label: 'Thứ 6', short: 'T6' },
  { value: 6, label: 'Thứ 7', short: 'T7' },
  { value: 0, label: 'Chủ nhật', short: 'CN' },
] as const;

export type DayOfWeek = (typeof DAYS)[number]['value'];

export type Schedule = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  note: string | null;
  /** Ca này có được phép điểm danh hay không */
  allow_checkin?: boolean;
  /** Bắt đầu được điểm danh (null = không dùng để điểm danh) */
  checkin_start_time?: string | null;
  /** Kết thúc được điểm danh (null = không dùng để điểm danh) */
  checkin_end_time?: string | null;
};

export type Holiday = {
  id: string;
  holiday_date: string;
  name: string;
  is_recurring: boolean;
  note: string | null;
};

export function dayLabel(d: number) {
  return DAYS.find((x) => x.value === d)?.label ?? `Thứ ${d}`;
}

export function dayShort(d: number) {
  return DAYS.find((x) => x.value === d)?.short ?? `T${d}`;
}

/** '08:00:00' -> '08:00' */
export function toHM(time: string) {
  return time.slice(0, 5);
}

/** '08:00' hoặc '08:00:00' -> số phút từ 00:00 */
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

/** Thời lượng của một ca tính bằng phút. */
export function durationMinutes(start: string, end: string) {
  return toMinutes(end) - toMinutes(start);
}

/** '08:00 – 17:00' */
export function formatRange(start: string, end: string) {
  return `${toHM(start)} – ${toHM(end)}`;
}

/** Tổng số giờ hoạt động trong tuần (chỉ tính ca active), ra số giờ thập phân. */
export function totalWeeklyHours(schedules: Schedule[]): number {
  const mins = schedules
    .filter((s) => s.is_active)
    .reduce((acc, s) => acc + durationMinutes(s.start_time, s.end_time), 0);
  return Math.round((mins / 60) * 10) / 10;
}

/**
 * Phát hiện các ca chồng nhau trong cùng một ngày.
 * Trả về Set các id bị chồng (để highlight trên UI).
 */
export function findOverlaps(schedules: Schedule[]): Set<string> {
  const byDay = new Map<number, Schedule[]>();
  for (const s of schedules) {
    if (!s.is_active) continue;
    const list = byDay.get(s.day_of_week) ?? [];
    list.push(s);
    byDay.set(s.day_of_week, list);
  }

  const conflicted = new Set<string>();
  for (const list of byDay.values()) {
    const sorted = [...list].sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
    for (let i = 0; i < sorted.length - 1; i++) {
      const cur = sorted[i];
      for (let j = i + 1; j < sorted.length; j++) {
        const next = sorted[j];
        // chồng nhau nếu next.start < cur.end
        if (toMinutes(next.start_time) < toMinutes(cur.end_time)) {
          conflicted.add(cur.id);
          conflicted.add(next.id);
        } else {
          break;
        }
      }
    }
  }
  return conflicted;
}

/** Nhóm ca theo thứ, sắp xếp theo giờ bắt đầu. */
export function groupByDay(schedules: Schedule[]): Map<number, Schedule[]> {
  const map = new Map<number, Schedule[]>();
  for (const s of schedules) {
    const list = map.get(s.day_of_week) ?? [];
    list.push(s);
    map.set(s.day_of_week, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
  }
  return map;
}

/** Trạng thái mở cửa của Lab theo ngày trong tuần. */
export function openDays(schedules: Schedule[]): number[] {
  const byDay = groupByDay(schedules);
  return DAYS.map((d) => d.value).filter((day) => {
    const list = byDay.get(day);
    return list ? list.some((s) => s.is_active) : false;
  });
}

export function closedDays(schedules: Schedule[]): number[] {
  const open = new Set(openDays(schedules));
  return DAYS.map((d) => d.value).filter((day) => !open.has(day));
}

/** Định dạng ngày kiểu Việt Nam, tránh lệch múi giờ do new Date('YYYY-MM-DD'). */
export function formatDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('vi-VN');
}

export function formatDateLong(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Ngày hôm nay dạng 'YYYY-MM-DD' theo giờ địa phương. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/** day_of_week ISO (0=CN .. 6=T7) của một chuỗi ngày. */
export function isoDayOfWeek(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/**
 * Ngày nghỉ có áp dụng cho ngày cụ thể hay không.
 * - Ngày nghỉ một lần: khớp đúng holiday_date
 * - Ngày nghỉ lặp hàng năm: khớp tháng/ngày
 */
export function isHolidayOn(holidays: Holiday[], iso: string): Holiday | undefined {
  const target = iso.slice(0, 10);
  const [_, targetMonth, targetDay] = target.split('-');
  return holidays.find((h) => {
    if (h.is_recurring) {
      const hm = h.holiday_date.slice(5, 10);
      return hm === `${targetMonth}-${targetDay}`;
    }
    return h.holiday_date.slice(0, 10) === target;
  });
}

/** Nhóm ngày nghỉ theo năm. */
export function holidaysByYear(holidays: Holiday[]): Map<number, Holiday[]> {
  const map = new Map<number, Holiday[]>();
  for (const h of holidays) {
    const year = Number(h.holiday_date.slice(0, 4));
    const list = map.get(year) ?? [];
    list.push(h);
    map.set(year, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
  }
  return map;
}

/** Sinh danh sách ngày trong khoảng [from, to] (bao gồm hai đầu). */
export function eachDateISO(from: string, to: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = from.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = to.slice(0, 10).split('-').map(Number);
  const cur = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  while (cur <= end) {
    out.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(
        cur.getDate()
      ).padStart(2, '0')}`
    );
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** Kiểm tra giờ hợp lệ: end > start. */
export function isValidRange(start: string, end: string): boolean {
  return toMinutes(end) > toMinutes(start);
}

// =============================================
// ĐIỂM DANH
// =============================================

/** Giới hạn số lần điểm danh bắt buộc mỗi tuần (mục tiêu). */
export const MIN_CHECKINS_PER_WEEK = 0;
export const MAX_CHECKINS_PER_WEEK = 7;

/** Ca có thực sự mở cửa sổ điểm danh hay không (cần đủ 2 mốc thời gian). */
export function hasCheckinWindow(s: Schedule): boolean {
  return Boolean(s.checkin_start_time && s.checkin_end_time);
}

/**
 * Ca có được phép điểm danh không.
 * Yêu cầu: ca đang hoạt động, allow_checkin = true, và có cửa sổ điểm danh.
 */
export function isCheckinEnabled(s: Schedule): boolean {
  return s.is_active && s.allow_checkin === true && hasCheckinWindow(s);
}

/** Ca có cấu hình điểm danh nhưng đang bị tắt (is_active = false). */
export function isCheckinConfigured(s: Schedule): boolean {
  return s.allow_checkin === true || hasCheckinWindow(s);
}

/**
 * Kiểm tra cửa sổ điểm danh có nằm trong khoảng mở/đóng cửa không.
 * Giờ bắt đầu phải >= start_time, giờ kết thúc phải <= end_time.
 */
export function isCheckinWithinOpenHours(s: Schedule): boolean {
  if (!hasCheckinWindow(s)) return true;
  return (
    toMinutes(s.checkin_start_time!) >= toMinutes(s.start_time) &&
    toMinutes(s.checkin_end_time!) <= toMinutes(s.end_time)
  );
}

/** Lý do cửa sổ điểm danh không hợp lệ (dùng cho thông báo trong form). */
export function checkinWindowError(s: Pick<Schedule, 'start_time' | 'end_time'>, start: string, end: string): string | null {
  if (!isValidRange(start, end)) return 'Giờ kết thúc điểm danh phải sau giờ bắt đầu điểm danh';
  if (toMinutes(start) < toMinutes(s.start_time))
    return `Giờ bắt đầu điểm danh phải sau giờ mở cửa (${toHM(s.start_time)})`;
  if (toMinutes(end) > toMinutes(s.end_time))
    return `Giờ kết thúc điểm danh phải trước giờ đóng cửa (${toHM(s.end_time)})`;
  return null;
}

/**
 * Danh sách các ca được phép điểm danh, đã bỏ qua ca bị trùng giờ.
 * Dùng cho màn hình Desktop/Mobile: chỉ hiện những giờ thực sự điểm danh được.
 */
export function openCheckinSlots(schedules: Schedule[]): Schedule[] {
  const conflicts = findOverlaps(schedules);
  return schedules
    .filter((s) => isCheckinEnabled(s) && !conflicts.has(s.id))
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
}

/** Tổng số cửa sổ điểm danh trong tuần (chỉ tính ca hợp lệ). */
export function weeklyCheckinCount(schedules: Schedule[]): number {
  return openCheckinSlots(schedules).length;
}
