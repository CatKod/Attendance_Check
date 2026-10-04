/**
 * Test logic thuần của tab Lịch Lab.
 * Chạy: node --experimental-strip-types scripts/test-schedule-utils.ts
 * hoặc dùng tsx / ts-node nếu có.
 */

// --- Định nghĩa lại tối thiểu các hàm cần test để chạy độc lập TS ---
type Schedule = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  note: string | null;
};

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function durationMinutes(start: string, end: string) {
  return toMinutes(end) - toMinutes(start);
}

function findOverlaps(schedules: Schedule[]): Set<string> {
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

function groupByDay(schedules: Schedule[]): Map<number, Schedule[]> {
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

function eachDateISO(from: string, to: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = from.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = to.slice(0, 10).split('-').map(Number);
  const cur = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  while (cur <= end) {
    out.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    );
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function isHolidayOn(
  holidays: { holiday_date: string; is_recurring: boolean; name: string }[],
  iso: string
) {
  const target = iso.slice(0, 10);
  const [, targetMonth, targetDay] = target.split('-');
  return holidays.find((h) => {
    if (h.is_recurring) {
      return h.holiday_date.slice(5, 10) === `${targetMonth}-${targetDay}`;
    }
    return h.holiday_date.slice(0, 10) === target;
  });
}

function totalWeeklyHours(schedules: Schedule[]) {
  const mins = schedules
    .filter((s) => s.is_active)
    .reduce((acc, s) => acc + durationMinutes(s.start_time, s.end_time), 0);
  return Math.round((mins / 60) * 10) / 10;
}

// ================= TEST =================
let pass = 0;
let fail = 0;

function check(name: string, cond: boolean, detail?: any) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`, detail !== undefined ? detail : '');
  }
}

const mk = (
  id: string,
  day: number,
  start: string,
  end: string,
  active = true
): Schedule => ({
  id,
  day_of_week: day,
  start_time: start,
  end_time: end,
  is_active: active,
  note: null,
});

console.log('\n[1] findOverlaps — phát hiện ca chồng');
{
  // Không chồng: 8-12 và 13-17
  const r1 = findOverlaps([mk('a', 1, '08:00', '12:00'), mk('b', 1, '13:00', '17:00')]);
  check('hai ca liền nhau không chồng', r1.size === 0, [...r1]);

  // Chồng: 8-12 và 11-15
  const r2 = findOverlaps([mk('a', 1, '08:00', '12:00'), mk('b', 1, '11:00', '15:00')]);
  check('hai ca chồng nhau bị phát hiện', r2.has('a') && r2.has('b'), [...r2]);

  // Chạm biên: 8-12 và 12-15 -> KHÔNG chồng
  const r3 = findOverlaps([mk('a', 1, '08:00', '12:00'), mk('b', 1, '12:00', '15:00')]);
  check('ca kề tiếp giáp biên không chồng', r3.size === 0, [...r3]);

  // Khác ngày -> không chồng
  const r4 = findOverlaps([mk('a', 1, '08:00', '17:00'), mk('b', 2, '08:00', '12:00')]);
  check('cùng giờ nhưng khác ngày không chồng', r4.size === 0, [...r4]);

  // Ca đã tắt không tính
  const r5 = findOverlaps([mk('a', 1, '08:00', '17:00'), mk('b', 1, '09:00', '10:00', false)]);
  check('ca is_active=false bị bỏ qua', r5.size === 0, [...r5]);

  // Ba ca, hai ca chồng nhau
  const r6 = findOverlaps([
    mk('a', 3, '08:00', '12:00'),
    mk('b', 3, '09:00', '11:00'),
    mk('c', 3, '14:00', '17:00'),
  ]);
  check('trong 3 ca chỉ 2 ca chồng bị đánh dấu', r6.size === 2 && r6.has('a') && r6.has('b'), [...r6]);
}

console.log('\n[2] groupByDay — nhóm & sắp xếp');
{
  const g = groupByDay([
    mk('x', 1, '13:00', '15:00'),
    mk('y', 1, '08:00', '12:00'),
    mk('z', 5, '08:00', '17:00'),
  ]);
  const mon = g.get(1)!;
  check('ngày 1 có 2 ca', mon.length === 2);
  check('sắp xếp theo giờ bắt đầu tăng dần', mon[0].id === 'y' && mon[1].id === 'x');
  check('ngày 5 nhóm riêng', g.get(5)!.length === 1);
  check('ngày không có ca trả về undefined', g.get(3) === undefined);
}

console.log('\n[3] eachDateISO — sinh dải ngày');
{
  check('1 ngày', eachDateISO('2026-01-01', '2026-01-01').length === 1);
  check('3 ngày', eachDateISO('2026-01-01', '2026-01-03').length === 3);
  check('tháng có 31 ngày', eachDateISO('2026-01-01', '2026-01-31').length === 31);
  check('năm ngoan', eachDateISO('2024-12-30', '2025-01-02').length === 4);
  check('format YYYY-MM-DD', eachDateISO('2026-03-05', '2026-03-05')[0] === '2026-03-05');
  // qua năm
  const cross = eachDateISO('2026-12-30', '2027-01-02');
  check('vượt ranh giới năm', cross.length === 4 && cross[3] === '2027-01-02', cross);
}

console.log('\n[4] isHolidayOn — ngày nghỉ lặp vs một lần');
{
  const holidays = [
    { holiday_date: '2026-01-01', is_recurring: true, name: 'Tết' },
    { holiday_date: '2026-05-01', is_recurring: false, name: 'Lễ đặc biệt' },
  ];
  check('ngày nghỉ lặp khớp năm sau', isHolidayOn(holidays, '2027-01-01')?.name === 'Tết');
  check('ngày nghỉ lặp khớp năm trước', isHolidayOn(holidays, '2025-01-01')?.name === 'Tết');
  check('ngày nghỉ lặp KHÔNG khớp ngày khác', !isHolidayOn(holidays, '2026-01-02'));
  check('ngày nghỉ một lần khớp đúng', isHolidayOn(holidays, '2026-05-01')?.name === 'Lễ đặc biệt');
  check('ngày nghỉ một lần KHÔNG lặp sang năm sau', !isHolidayOn(holidays, '2027-05-01'));
}

console.log('\n[5] totalWeeklyHours — tổng giờ');
{
  const r1 = totalWeeklyHours([mk('a', 1, '08:00', '17:00'), mk('b', 2, '08:00', '12:00')]);
  check('9h + 4h = 13h', r1 === 13, r1);

  const r2 = totalWeeklyHours([mk('a', 1, '08:00', '12:00', false)]);
  check('ca tắt không tính', r2 === 0, r2);

  const r3 = totalWeeklyHours([]);
  check('mảng rỗng = 0', r3 === 0, r3);
}

console.log('\n[6] durationMinutes');
{
  check('8-17 = 540 phút', durationMinutes('08:00', '17:00') === 540);
  check('8-12:30 = 270 phút', durationMinutes('08:00', '12:30') === 270);
  check('xử lý định dạng có giây', durationMinutes('08:00:00', '17:00:00') === 540);
}

console.log(`\n${'='.repeat(40)}`);
console.log(`Kết quả: ${pass} pass, ${fail} fail`);
console.log('='.repeat(40));
process.exit(fail > 0 ? 1 : 0);
