'use client';

import { useMemo, useState, useTransition } from 'react';
import { Modal, ConfirmButton } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Pencil,
  CalendarClock,
  CalendarOff,
  Repeat,
  Copy,
  AlertTriangle,
  Power,
  Trash2,
  Layers,
  Info,
  Check,
  Target,
  ScanLine,
  CircleCheck,
  CircleSlash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DAYS,
  dayLabel,
  dayShort,
  toHM,
  toMinutes,
  fromMinutes,
  durationMinutes,
  totalWeeklyHours,
  findOverlaps,
  groupByDay,
  openDays,
  closedDays,
  formatDateLong,
  todayISO,
  isoDayOfWeek,
  isHolidayOn,
  holidaysByYear,
  eachDateISO,
  isValidRange,
  hasCheckinWindow,
  isCheckinEnabled,
  isCheckinConfigured,
  isCheckinWithinOpenHours,
  checkinWindowError,
  weeklyCheckinCount,
  MIN_CHECKINS_PER_WEEK,
  MAX_CHECKINS_PER_WEEK,
  type Schedule,
  type Holiday,
} from '@/lib/schedule-utils';
import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
  toggleSchedule,
  toggleScheduleCheckin,
  applyScheduleToDays,
  copyScheduleFromDay,
  deleteSchedulesByDays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  createHolidaysBulk,
  updateWeeklyCheckinTarget,
  type ScheduleInput,
  type HolidayInput,
} from '@/lib/actions/crud';

type TabKey = 'week' | 'holidays' | 'overview';

const TABS: { key: TabKey; label: string; icon: typeof CalendarClock }[] = [
  { key: 'week', label: 'Lịch tuần', icon: CalendarClock },
  { key: 'holidays', label: 'Ngày nghỉ', icon: CalendarOff },
  { key: 'overview', label: 'Tổng quan', icon: Layers },
];

/** Dùng để bắt lỗi action và hiển thị toast nội tuyến thay vì alert. */
function useActionFeedback() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>, okMessage?: string) => {
    setError(null);
    setSuccess(null);
    try {
      await fn();
      if (okMessage) {
        setSuccess(okMessage);
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  return { error, success, setError, setSuccess, run };
}

// =============================================
// MAIN
// =============================================
export function ScheduleManager({
  schedules,
  holidays,
  requiredCheckinsPerWeek,
  canEdit,
}: {
  schedules: Schedule[];
  holidays: Holiday[];
  /** Số lần điểm danh bắt buộc trong 1 tuần (mục tiêu) */
  requiredCheckinsPerWeek: number;
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<TabKey>('week');
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [, startTransition] = useTransition();

  const overlapIds = useMemo(() => findOverlaps(schedules), [schedules]);
  const weeklyHours = useMemo(() => totalWeeklyHours(schedules), [schedules]);
  const weeklyCheckins = useMemo(() => weeklyCheckinCount(schedules), [schedules]);

  const openAddSchedule = () => {
    setEditing(null);
    setShowForm(true);
  };

  return (
    <div className="space-y-5">
      {/* ===== TABS ===== */}
      <div
        role="tablist"
        className="flex gap-1 overflow-x-auto rounded-xl border border-border/60 bg-card p-1"
      >
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all',
              tab === key
                ? 'bg-brand-gradient text-white shadow-brand'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'week' && (
        <WeeklyTab
          schedules={schedules}
          overlapIds={overlapIds}
          weeklyHours={weeklyHours}
          weeklyCheckins={weeklyCheckins}
          requiredCheckinsPerWeek={requiredCheckinsPerWeek}
          canEdit={canEdit}
          onAdd={openAddSchedule}
          onEdit={(s) => {
            setEditing(s);
            setShowForm(true);
          }}
          onToggle={(s) =>
            startTransition(async () => {
              await toggleSchedule(s.id, !s.is_active);
            })
          }
          onToggleCheckin={(s) =>
            startTransition(async () => {
              if (isCheckinEnabled(s)) {
                // Đang bật → tắt (xoá luôn cửa sổ)
                await toggleScheduleCheckin(s.id, false);
                return;
              }
              // Đang tắt → bật, giữ cửa sổ cũ nếu có, không thì lấy 15 phút đầu ca
              const window = hasCheckinWindow(s)
                ? { start: s.checkin_start_time!, end: s.checkin_end_time! }
                : {
                    start: s.start_time,
                    end: fromMinutes(
                      Math.min(
                        toMinutes(s.start_time) + 15,
                        toMinutes(s.end_time)
                      )
                    ),
                  };
              await toggleScheduleCheckin(s.id, true, window);
            })
          }
          onDelete={(s) =>
            startTransition(async () => {
              await deleteSchedule(s.id);
            })
          }
          onBulk={() => setShowBulk(true)}
          onCopy={() => setShowCopy(true)}
        />
      )}

      {tab === 'holidays' && (
        <HolidaysTab
          holidays={holidays}
          canEdit={canEdit}
          onAdd={() => {
            setEditingHoliday(null);
            setShowHolidayForm(true);
          }}
          onEdit={(h) => {
            setEditingHoliday(h);
            setShowHolidayForm(true);
          }}
          onDelete={(h) =>
            startTransition(async () => {
              await deleteHoliday(h.id);
            })
          }
        />
      )}

      {tab === 'overview' && (
        <OverviewTab
          schedules={schedules}
          holidays={holidays}
          weeklyHours={weeklyHours}
          weeklyCheckins={weeklyCheckins}
          requiredCheckinsPerWeek={requiredCheckinsPerWeek}
          overlapIds={overlapIds}
        />
      )}

      {/* ===== MODALS ===== */}
      <ScheduleFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        editing={editing}
      />

      <BulkApplyModal
        open={showBulk}
        onClose={() => setShowBulk(false)}
        existing={schedules}
      />

      <CopyDayModal
        open={showCopy}
        onClose={() => setShowCopy(false)}
        schedules={schedules}
      />

      <HolidayFormModal
        open={showHolidayForm}
        onClose={() => setShowHolidayForm(false)}
        editing={editingHoliday}
      />
    </div>
  );
}

// =============================================
// CẤU HÌNH MỤC TIÊU ĐIỂM DANH TRONG TUẦN
// =============================================
function WeeklyTargetCard({
  required,
  actual,
  canEdit,
}: {
  required: number;
  actual: number;
  canEdit: boolean;
}) {
  const { error, success, setError, setSuccess, run } = useActionFeedback();
  const [value, setValue] = useState(required);
  const [pending, startTransition] = useTransition();

  // Đồng bộ khi server trả về giá trị mới
  const [syncedWith, setSyncedWith] = useState(required);
  if (syncedWith !== required) {
    setSyncedWith(required);
    setValue(required);
  }

  const diff = actual - required;
  const met = required === 0 || actual >= required;
  const dirty = value !== required;
  const outOfRange =
    value < MIN_CHECKINS_PER_WEEK || value > MAX_CHECKINS_PER_WEEK;

  const save = () =>
    run(
      () =>
        new Promise<void>((resolve, reject) => {
          startTransition(async () => {
            try {
              await updateWeeklyCheckinTarget(value);
              setSuccess(`Đã đặt mục tiêu ${value} lần điểm danh/tuần`);
              resolve();
            } catch (e: any) {
              setError(e?.message ?? String(e));
              reject(e);
            }
          });
        })
    );

  return (
    <div className="apes-card overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        {/* Mô tả + trạng thái */}
        <div className="min-w-0">
          <h4 className="apes-section-title flex items-center gap-2 text-base">
            <Target className="h-[18px] w-[18px] text-primary" />
            Mục tiêu điểm danh trong tuần
          </h4>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              Yêu cầu sinh viên điểm danh tối thiểu{' '}
              <span className="font-semibold text-foreground">
                {required} lần/tuần
              </span>
            </span>
            <span
              className={cn(
                'apes-badge',
                met ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
              )}
            >
              {met ? (
                <CircleCheck className="h-3 w-3" />
              ) : (
                <AlertTriangle className="h-3 w-3" />
              )}
              Đang có {actual} cửa sổ
            </span>
            {required > 0 && (
              <span
                className={cn(
                  'apes-badge',
                  met ? 'bg-muted text-muted-foreground' : 'bg-muted text-muted-foreground'
                )}
              >
                {met
                  ? `đạt ${actual - required}/${required} dư`
                  : `thiếu ${required - actual} lần`}
              </span>
            )}
          </p>
        </div>

        {/* Chỉnh số lần */}
        {canEdit && (
          <div className="flex shrink-0 flex-col gap-2 sm:w-64">
            {error && <InlineError message={error} />}
            {success && <InlineSuccess message={success} />}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                aria-label="Giảm 1 lần"
                disabled={outOfRange || value <= MIN_CHECKINS_PER_WEEK}
                onClick={() => setValue((v) => Math.max(MIN_CHECKINS_PER_WEEK, v - 1))}
              >
                −
              </Button>
              <Input
                type="number"
                min={MIN_CHECKINS_PER_WEEK}
                max={MAX_CHECKINS_PER_WEEK}
                value={value}
                aria-label="Số lần điểm danh bắt buộc mỗi tuần"
                aria-invalid={outOfRange}
                onChange={(e) => setValue(Number(e.target.value))}
                className="h-9 text-center font-mono"
              />
              <Button
                variant="outline"
                size="sm"
                aria-label="Tăng 1 lần"
                disabled={outOfRange || value >= MAX_CHECKINS_PER_WEEK}
                onClick={() => setValue((v) => Math.min(MAX_CHECKINS_PER_WEEK, v + 1))}
              >
                +
              </Button>
            </div>
            <Button
              size="sm"
              variant="brand"
              disabled={!dirty || outOfRange || pending}
              onClick={save}
              className="w-full"
            >
              {pending ? 'Đang lưu...' : 'Lưu mục tiêu'}
            </Button>
            {outOfRange && (
              <p className="text-xs font-medium text-destructive">
                Nhập giá trị từ {MIN_CHECKINS_PER_WEEK} đến {MAX_CHECKINS_PER_WEEK}
              </p>
            )}
            {required > 0 && actual < required && (
              <p className="text-xs text-warning">
                ⚠ Hãy bật điểm danh cho ít nhất {required} ca để đạt mục tiêu.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================
// TAB 1: LỊCH TUẦN
// =============================================
function WeeklyTab({
  schedules,
  overlapIds,
  weeklyHours,
  weeklyCheckins,
  requiredCheckinsPerWeek,
  canEdit,
  onAdd,
  onEdit,
  onToggle,
  onToggleCheckin,
  onDelete,
  onBulk,
  onCopy,
}: {
  schedules: Schedule[];
  overlapIds: Set<string>;
  weeklyHours: number;
  weeklyCheckins: number;
  requiredCheckinsPerWeek: number;
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (s: Schedule) => void;
  onToggle: (s: Schedule) => void;
  onToggleCheckin: (s: Schedule) => void;
  onDelete: (s: Schedule) => void;
  onBulk: () => void;
  onCopy: () => void;
}) {
  const grouped = useMemo(() => groupByDay(schedules), [schedules]);
  const todayDow = isoDayOfWeek(todayISO());

  return (
    <section className="space-y-4">
      <WeeklyTargetCard
        required={requiredCheckinsPerWeek}
        actual={weeklyCheckins}
        canEdit={canEdit}
      />

      {/* Thanh công cụ */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="apes-section-title flex items-center gap-2">
            <CalendarClock className="h-[18px] w-[18px] text-primary" />
            Khung giờ hoạt động
          </h3>
          <p className="apes-section-desc">
            {schedules.length} khung giờ · tổng {weeklyHours}h/tuần ·{' '}
            <span className="font-medium text-foreground">
              {weeklyCheckins} cửa sổ điểm danh
            </span>
            {overlapIds.size > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 font-medium text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                {overlapIds.size} ca bị chồng
              </span>
            )}
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onCopy}>
              <Copy className="h-4 w-4" />
              Sao chép ngày
            </Button>
            <Button variant="outline" size="sm" onClick={onBulk}>
              <Layers className="h-4 w-4" />
              Áp dụng hàng loạt
            </Button>
            <Button variant="brand" size="sm" onClick={onAdd}>
              <Plus className="h-4 w-4" />
              Thêm khung giờ
            </Button>
          </div>
        )}
      </div>

      {schedules.length === 0 ? (
        <div className="apes-card flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
            <CalendarClock className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">Chưa có khung giờ nào</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Thêm khung giờ để hệ thống biết khi nào Lab mở cửa.
          </p>
          {canEdit && (
            <Button variant="brand" size="sm" className="mt-4" onClick={onAdd}>
              <Plus className="h-4 w-4" />
              Thêm khung giờ
            </Button>
          )}
        </div>
      ) : (
        /* Lưới 7 cột: mỗi cột là một ngày trong tuần */
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {DAYS.map(({ value: day, label }) => {
            const list = grouped.get(day) ?? [];
            const activeCount = list.filter((s) => s.is_active).length;
            const checkinCount = list.filter((s) => isCheckinEnabled(s)).length;
            const isToday = day === todayDow;
            const hasOverlap = list.some((s) => overlapIds.has(s.id));

            return (
              <div
                key={day}
                className={cn(
                  'apes-card flex flex-col p-3.5 transition-shadow',
                  isToday && 'ring-2 ring-primary/50'
                )}
              >
                {/* Header ngày */}
                <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'text-sm font-semibold',
                        isToday ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {label}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {list.length === 0
                        ? 'Không mở cửa'
                        : `${activeCount}/${list.length} ca`}
                    </p>
                    {checkinCount > 0 && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-success">
                        <ScanLine className="h-3 w-3" />
                        {checkinCount} lần điểm danh
                      </p>
                    )}
                  </div>
                  {isToday && (
                    <span className="apes-badge shrink-0 bg-primary/10 text-primary">
                      Hôm nay
                    </span>
                  )}
                </div>

                {/* Danh sách ca */}
                {list.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground/60">
                    —
                  </p>
                ) : (
                  <div className="space-y-2">
                    {list.map((s) => {
                      const conflict = overlapIds.has(s.id);
                      const checkinOn = isCheckinEnabled(s);
                      // Ca chưa cấu hình cửa sổ điểm danh → coi như "tối"
                      const windowBroken =
                        isCheckinConfigured(s) && !isCheckinWithinOpenHours(s);
                      return (
                        <div
                          key={s.id}
                          className={cn(
                            'group rounded-lg border p-2.5 transition-all',
                            // Bật điểm danh → nền sáng, viền đậm
                            checkinOn
                              ? 'border-success/40 bg-success/[0.07] shadow-sm'
                              : // Tắt → nền tối, viền nhạt, mờ đi
                                'border-border/50 bg-muted/50 opacity-60 saturate-50',
                            conflict && 'border-warning/50 bg-warning/5'
                          )}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <span
                              className={cn(
                                'font-mono text-sm font-bold tabular-nums',
                                checkinOn
                                  ? 'text-foreground'
                                  : 'text-muted-foreground line-through'
                              )}
                            >
                              {toHM(s.start_time)}
                            </span>
                            <div className="flex shrink-0 items-center gap-1">
                              {checkinOn && (
                                <span className="apes-badge bg-success/15 text-success">
                                  <ScanLine className="h-3 w-3" />
                                  Điểm danh
                                </span>
                              )}
                              {windowBroken && (
                                <AlertTriangle
                                  className="h-3.5 w-3.5 shrink-0 text-warning"
                                  aria-label="Cửa sổ điểm danh nằm ngoài giờ mở cửa"
                                />
                              )}
                              {conflict && (
                                <AlertTriangle
                                  className="h-3.5 w-3.5 shrink-0 text-warning"
                                  aria-label="Chồng khung giờ"
                                />
                              )}
                            </div>
                          </div>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            → {toHM(s.end_time)} · {durationMinutes(s.start_time, s.end_time) / 60}h
                          </p>

                          {/* Cửa sổ điểm danh */}
                          {hasCheckinWindow(s) ? (
                            <p
                              className={cn(
                                'mt-1 flex items-center gap-1 font-mono text-[11px] font-semibold',
                                checkinOn
                                  ? 'text-success'
                                  : 'text-muted-foreground line-through'
                              )}
                            >
                              <ScanLine className="h-3 w-3 shrink-0" />
                              {toHM(s.checkin_start_time!)} – {toHM(s.checkin_end_time!)}
                            </p>
                          ) : (
                            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground/80">
                              <CircleSlash className="h-3 w-3 shrink-0" />
                              Không cho điểm danh
                            </p>
                          )}

                          {s.note && (
                            <p className="mt-1 truncate text-[11px] text-muted-foreground/80">
                              {s.note}
                            </p>
                          )}

                          {canEdit && (
                            <div className="mt-2 flex gap-1">
                              <IconAction
                                icon={ScanLine}
                                label={
                                  checkinOn
                                    ? 'Tắt điểm danh'
                                    : 'Bật điểm danh (mặc định 15 phút đầu ca)'
                                }
                                onClick={() => onToggleCheckin(s)}
                                active={checkinOn}
                              />
                              <IconAction
                                icon={Power}
                                label={s.is_active ? 'Tắt' : 'Bật'}
                                onClick={() => onToggle(s)}
                                active={s.is_active}
                              />
                              <IconAction icon={Pencil} label="Sửa" onClick={() => onEdit(s)} />
                              <button
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Xoá khung giờ ${dayLabel(s.day_of_week)} ${toHM(
                                        s.start_time
                                      )}–${toHM(s.end_time)}?`
                                    )
                                  ) {
                                    onDelete(s);
                                  }
                                }}
                                title="Xóa"
                                aria-label={`Xóa ca ${toHM(s.start_time)} ngày ${dayLabel(
                                  s.day_of_week
                                )}`}
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-destructive/30 text-destructive transition-colors hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {hasOverlap && (
                  <p className="mt-2 text-[11px] font-medium text-warning">
                    ⚠ Có ca chồng giờ
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function IconAction({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: typeof Power | typeof ScanLine | typeof Pencil;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'flex h-7 w-7 flex-1 items-center justify-center rounded-md border transition-colors',
        active
          ? 'border-success/30 text-success hover:bg-success/10'
          : 'border-border/70 text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-primary'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

// =============================================
// TAB 2: NGÀY NGHỈ
// =============================================
function HolidaysTab({
  holidays,
  canEdit,
  onAdd,
  onEdit,
  onDelete,
}: {
  holidays: Holiday[];
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (h: Holiday) => void;
  onDelete: (h: Holiday) => void;
}) {
  const [yearFilter, setYearFilter] = useState<'all' | string>('all');
  const byYear = useMemo(() => holidaysByYear(holidays), [holidays]);
  const years = useMemo(
    () => [...byYear.keys()].sort((a, b) => b - a),
    [byYear]
  );

  const filtered = useMemo(() => {
    if (yearFilter === 'all') return holidays;
    return byYear.get(Number(yearFilter)) ?? [];
  }, [holidays, byYear, yearFilter]);

  const recurring = holidays.filter((h) => h.is_recurring).length;
  const today = todayISO();

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="apes-section-title flex items-center gap-2">
            <CalendarOff className="h-[18px] w-[18px] text-primary" />
            Ngày nghỉ
          </h3>
          <p className="apes-section-desc">
            {holidays.length} ngày · {recurring} ngày lặp hàng năm — không tính điểm danh
          </p>
        </div>
        {canEdit && (
          <Button variant="brand" size="sm" onClick={onAdd}>
            <Plus className="h-4 w-4" />
            Thêm ngày nghỉ
          </Button>
        )}
      </div>

      {holidays.length === 0 ? (
        <div className="apes-card flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
            <CalendarOff className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">Chưa có ngày nghỉ</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Thêm ngày lễ để hệ thống bỏ qua điểm danh.
          </p>
        </div>
      ) : (
        <>
          {/* Bộ lọc năm */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Lọc năm:</span>
            <button
              onClick={() => setYearFilter('all')}
              className={cn(
                'apes-badge border transition-colors',
                yearFilter === 'all'
                  ? 'border-primary bg-accent text-accent-foreground'
                  : 'border-border/70 text-muted-foreground hover:bg-accent/60'
              )}
            >
              Tất cả ({holidays.length})
            </button>
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setYearFilter(String(y))}
                className={cn(
                  'apes-badge border transition-colors',
                  yearFilter === String(y)
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border/70 text-muted-foreground hover:bg-accent/60'
                )}
              >
                {y} ({byYear.get(y)?.length ?? 0})
              </button>
            ))}
          </div>

          <div className="apes-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="apes-table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Tên</th>
                    <th>Lặp lại</th>
                    <th>Ghi chú</th>
                    {canEdit && <th className="text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((h) => {
                    const isPast = h.is_recurring
                      ? false
                      : h.holiday_date.slice(0, 10) < today;
                    return (
                      <tr key={h.id} className={cn(isPast && 'opacity-55')}>
                        <td className="whitespace-nowrap font-mono text-xs font-semibold">
                          {formatDateLong(h.holiday_date)}
                        </td>
                        <td className="font-medium text-foreground">{h.name}</td>
                        <td>
                          {h.is_recurring ? (
                            <span className="apes-badge bg-info/10 text-info">
                              <Repeat className="h-3 w-3" />
                              Hàng năm
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Một lần</span>
                          )}
                        </td>
                        <td className="text-muted-foreground">{h.note ?? '—'}</td>
                        {canEdit && (
                          <td>
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => onEdit(h)}
                                title="Sửa"
                                aria-label={`Sửa ${h.name}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-primary"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <ConfirmButton
                                message={`Xóa ngày nghỉ "${h.name}"?`}
                                onConfirm={async () => onDelete(h)}
                              >
                                <span className="sr-only">Xóa {h.name}</span>
                              </ConfirmButton>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

// =============================================
// TAB 3: TỔNG QUAN
// =============================================
function OverviewTab({
  schedules,
  holidays,
  weeklyHours,
  weeklyCheckins,
  requiredCheckinsPerWeek,
  overlapIds,
}: {
  schedules: Schedule[];
  holidays: Holiday[];
  weeklyHours: number;
  weeklyCheckins: number;
  requiredCheckinsPerWeek: number;
  overlapIds: Set<string>;
}) {
  const grouped = useMemo(() => groupByDay(schedules), [schedules]);
  const open = openDays(schedules);
  const closed = closedDays(schedules);

  // Số ca bị trùng và số ngày có trùng
  const overlapCount = overlapIds.size;
  const overlapDays = useMemo(() => {
    const days = new Set<number>();
    for (const s of schedules) {
      if (overlapIds.has(s.id)) days.add(s.day_of_week);
    }
    return days.size;
  }, [schedules, overlapIds]);

  const maxMinutes = useMemo(
    () =>
      Math.max(
        0,
        ...DAYS.map((d) =>
          (grouped.get(d.value) ?? []).reduce(
            (acc, s) => acc + (s.is_active ? durationMinutes(s.start_time, s.end_time) : 0),
            0
          )
        )
      ),
    [grouped]
  );

  const today = todayISO();
  const todayDow = isoDayOfWeek(today);
  const todayHoliday = isHolidayOn(holidays, today);
  const todaySchedules = (grouped.get(todayDow) ?? []).filter((s) => s.is_active);
  const todayCheckins = todaySchedules.filter((s) => isCheckinEnabled(s));

  return (
    <section className="space-y-5">
      {/* Thẻ số liệu */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Cửa sổ điểm danh"
          value={`${weeklyCheckins}/tuần`}
          hint={
            requiredCheckinsPerWeek > 0
              ? weeklyCheckins >= requiredCheckinsPerWeek
                ? `Đạt mục tiêu ${requiredCheckinsPerWeek} lần/tuần`
                : `Mục tiêu ${requiredCheckinsPerWeek} lần/tuần — thiếu ${
                    requiredCheckinsPerWeek - weeklyCheckins
                  }`
              : 'Chưa đặt mục tiêu'
          }
          tone={requiredCheckinsPerWeek === 0 || weeklyCheckins >= requiredCheckinsPerWeek ? 'success' : 'warning'}
        />
        <StatCard
          label="Tổng giờ/tuần"
          value={`${weeklyHours}h`}
          hint={`${schedules.filter((s) => s.is_active).length} ca đang hoạt động`}
          tone="primary"
        />
        <StatCard
          label="Ngày mở cửa"
          value={`${open.length}/7`}
          hint={open.length ? open.map(dayShort).join(', ') : 'Chưa có ca nào'}
          tone="success"
        />
        <StatCard
          label="Ngày đóng cửa"
          value={`${closed.length}/7`}
          hint={closed.length ? closed.map(dayShort).join(', ') : 'Mở cửa cả tuần'}
          tone="muted"
        />
        <StatCard
          label="Ngày bị trùng ca"
          value={String(overlapDays)}
          hint={
            overlapCount > 0 ? `${overlapCount} ca cần rà soát` : 'Không có xung đột'
          }
          tone={overlapCount > 0 ? 'warning' : 'muted'}
        />
      </div>

      {/* Hôm nay */}
      <div className="apes-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Hôm nay
            </p>
            <p className="mt-1 text-lg font-bold text-foreground">{formatDateLong(today)}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{dayLabel(todayDow)}</p>
          </div>
          <div className="text-right">
            {todayHoliday ? (
              <span className="apes-badge bg-destructive/10 text-destructive">
                <CalendarOff className="h-3 w-3" />
                {todayHoliday.name}
              </span>
            ) : todaySchedules.length > 0 ? (
              <div className="space-y-1">
                {todaySchedules.map((s) =>
                  isCheckinEnabled(s) ? (
                    <p
                      key={s.id}
                      className="font-mono text-sm font-semibold text-success"
                    >
                      {toHM(s.start_time)} – {toHM(s.end_time)}
                      <span className="ml-1.5 text-[11px] font-normal">
                        (điểm danh {toHM(s.checkin_start_time!)}–
                        {toHM(s.checkin_end_time!)})
                      </span>
                    </p>
                  ) : (
                    <p
                      key={s.id}
                      className="font-mono text-sm font-semibold text-muted-foreground"
                    >
                      {toHM(s.start_time)} – {toHM(s.end_time)}
                      <span className="ml-1.5 text-[11px] font-normal">
                        (không điểm danh)
                      </span>
                    </p>
                  )
                )}
              </div>
            ) : (
              <span className="apes-badge bg-muted text-muted-foreground">Không mở cửa</span>
            )}
          </div>
        </div>
        {todayCheckins.length > 0 && (
          <p className="mt-3 flex items-center gap-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <ScanLine className="h-3.5 w-3.5 text-success" />
            Hôm nay có <span className="font-semibold text-success">{todayCheckins.length}</span>{' '}
            cửa sổ để điểm danh
          </p>
        )}
      </div>

      {/* Biểu đồ giờ theo ngày */}
      <div className="apes-card p-5">
        <h4 className="apes-section-title text-base">Phân bổ giờ theo ngày</h4>
        <div className="mt-4 space-y-2.5">
          {DAYS.map((d) => {
            const list = grouped.get(d.value) ?? [];
            const mins = list.reduce(
              (acc, s) => acc + (s.is_active ? durationMinutes(s.start_time, s.end_time) : 0),
              0
            );
            const pct = maxMinutes > 0 ? (mins / maxMinutes) * 100 : 0;
            return (
              <div key={d.value} className="flex items-center gap-3">
                <span className="w-8 shrink-0 text-xs font-semibold text-muted-foreground">
                  {d.short}
                </span>
                <div className="h-6 flex-1 overflow-hidden rounded-md bg-muted/60">
                  <div
                    className="h-full rounded-md bg-brand-gradient transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {Math.round((mins / 60) * 10) / 10}h
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'primary' | 'success' | 'warning' | 'muted';
}) {
  const tones = {
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    muted: 'text-muted-foreground',
  };
  return (
    <div className="apes-stat-card">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn('mt-1.5 text-2xl font-bold tabular-nums', tones[tone])}>{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

// =============================================
// MODAL: THÊM / SỬA KHUNG GIỜ
// =============================================
function ScheduleFormModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Schedule | null;
}) {
  const { error, setError, run } = useActionFeedback();
  const [start, setStart] = useState(editing?.start_time.slice(0, 5) ?? '08:00');
  const [end, setEnd] = useState(editing?.end_time.slice(0, 5) ?? '17:00');
  const [allowCheckin, setAllowCheckin] = useState(editing?.allow_checkin ?? false);
  const [checkinStart, setCheckinStart] = useState(
    editing?.checkin_start_time?.slice(0, 5) ?? '08:00'
  );
  const [checkinEnd, setCheckinEnd] = useState(
    editing?.checkin_end_time?.slice(0, 5) ?? '08:15'
  );
  const [formKey, setFormKey] = useState('');

  // Reset state khi mở modal với bản ghi khác
  const openKey = `${open}-${editing?.id ?? 'new'}`;
  if (open && openKey !== formKey) {
    setFormKey(openKey);
    setStart(editing?.start_time.slice(0, 5) ?? '08:00');
    setEnd(editing?.end_time.slice(0, 5) ?? '17:00');
    setAllowCheckin(editing?.allow_checkin ?? false);
    setCheckinStart(
      editing?.checkin_start_time?.slice(0, 5) ?? editing?.start_time.slice(0, 5) ?? '08:00'
    );
    setCheckinEnd(
      editing?.checkin_end_time?.slice(0, 5) ??
        fromMinutes(
          Math.min(
            toMinutes(`${editing?.start_time.slice(0, 5) ?? '08:00'}:00`) + 15,
            toMinutes(`${editing?.end_time.slice(0, 5) ?? '17:00'}:00`)
          )
        )
    );
    setError(null);
  }

  const invalidRange = !isValidRange(start, end);

  // Chỉ validate cửa sổ điểm danh khi ca hợp lệ và người dùng bật
  const windowErr =
    allowCheckin && !invalidRange
      ? checkinWindowError(
          { start_time: `${start}:00`, end_time: `${end}:00` },
          `${checkinStart}:00`,
          `${checkinEnd}:00`
        )
      : null;

  /** Kéo giờ mở/đóng cửa thì cửa sổ điểm danh cũ phải dịch theo cho hợp lệ. */
  const shiftCheckinWithOpenHours = (nextStart: string, nextEnd: string) => {
    if (!allowCheckin) return;
    setCheckinStart((cs) => (toMinutes(cs) < toMinutes(nextStart) ? nextStart : cs));
    setCheckinEnd((ce) => (toMinutes(ce) > toMinutes(nextEnd) ? nextEnd : ce));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Sửa khung giờ' : 'Thêm khung giờ'}
      description="Cấu hình giờ mở/đóng cửa và thời gian được điểm danh"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="submit"
            form="schedule-form"
            variant="brand"
            disabled={invalidRange || !!windowErr}
          >
            {editing ? 'Cập nhật' : 'Thêm'}
          </Button>
        </>
      }
    >
      <form
        id="schedule-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const input: ScheduleInput = {
            day_of_week: Number(fd.get('day_of_week')),
            start_time: fd.get('start_time') as string,
            end_time: fd.get('end_time') as string,
            is_active: fd.get('is_active') === 'on',
            allow_checkin: allowCheckin,
            checkin_start_time: allowCheckin ? `${checkinStart}:00` : null,
            checkin_end_time: allowCheckin ? `${checkinEnd}:00` : null,
            note: String(fd.get('note') ?? '').trim() || null,
          };
          run(async () => {
            if (editing) await updateSchedule(editing.id, input);
            else await createSchedule(input);
            onClose();
          });
        }}
      >
        {error && <InlineError message={error} />}

        <div className="space-y-1.5">
          <label htmlFor="day_of_week" className="apes-label">
            Thứ
          </label>
          <Select
            id="day_of_week"
            name="day_of_week"
            defaultValue={editing?.day_of_week ?? 1}
          >
            {DAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="start_time" className="apes-label">
              Giờ bắt đầu
            </label>
            <Input
              id="start_time"
              type="time"
              name="start_time"
              required
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                shiftCheckinWithOpenHours(e.target.value, end);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="end_time" className="apes-label">
              Giờ kết thúc
            </label>
            <Input
              id="end_time"
              type="time"
              name="end_time"
              required
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                shiftCheckinWithOpenHours(start, e.target.value);
              }}
              aria-invalid={invalidRange}
            />
          </div>
        </div>

        {invalidRange && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            Giờ kết thúc phải sau giờ bắt đầu
          </p>
        )}

        {!invalidRange && (
          <p className="text-xs text-muted-foreground">
            Thời lượng:{' '}
            <span className="font-mono font-semibold text-foreground">
              {durationMinutes(`${start}:00`, `${end}:00`) / 60}h
            </span>
          </p>
        )}

        {/* Chọn nhanh bằng slider */}
        <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">Điều chỉnh nhanh</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-xs tabular-nums text-muted-foreground">08:00</span>
            <input
              type="range"
              min={0}
              max={1439}
              step={15}
              value={toMinutes(`${start}:00`)}
              onChange={(e) => {
                const v = fromMinutes(Number(e.target.value));
                setStart(v);
                shiftCheckinWithOpenHours(v, end);
              }}
              className="h-1.5 flex-1 cursor-pointer accent-[hsl(var(--primary))]"
              aria-label="Chỉnh giờ bắt đầu"
            />
            <span className="font-mono text-xs tabular-nums text-muted-foreground">23:45</span>
          </div>
        </div>

        {/* ===== ĐIỂM DANH ===== */}
        <label
          className={cn(
            'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-all',
            allowCheckin
              ? 'border-success/40 bg-success/[0.07]'
              : 'border-border/70 hover:bg-accent/50'
          )}
        >
          <input
            type="checkbox"
            checked={allowCheckin}
            onChange={(e) => setAllowCheckin(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(var(--success))]"
          />
          <span>
            <span className="flex items-center gap-1.5 font-medium">
              <ScanLine className="h-4 w-4" />
              Cho phép điểm danh trong ca này
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {allowCheckin
                ? 'Sinh viên có thể điểm danh trong khoảng thời gian bên dưới.'
                : 'Tắt sẽ không cho điểm danh trong ca này.'}
            </span>
          </span>
        </label>

        {allowCheckin && (
          <div
            className={cn(
              'space-y-3 rounded-lg border p-3.5 transition-all',
              windowErr ? 'border-destructive/40 bg-destructive/5' : 'border-success/40 bg-success/[0.07]'
            )}
          >
            <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <ScanLine className="h-3.5 w-3.5 text-success" />
              Khung giờ được điểm danh
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="checkin_start_time" className="apes-label">
                  Bắt đầu điểm danh
                </label>
                <Input
                  id="checkin_start_time"
                  type="time"
                  value={checkinStart}
                  min={start}
                  max={end}
                  onChange={(e) => setCheckinStart(e.target.value)}
                  aria-invalid={!!windowErr}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="checkin_end_time" className="apes-label">
                  Kết thúc điểm danh
                </label>
                <Input
                  id="checkin_end_time"
                  type="time"
                  value={checkinEnd}
                  min={start}
                  max={end}
                  onChange={(e) => setCheckinEnd(e.target.value)}
                  aria-invalid={!!windowErr}
                />
              </div>
            </div>

            {windowErr ? (
              <p className="flex items-start gap-1.5 text-xs font-medium text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {windowErr}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Cửa sổ điểm danh nằm trong giờ mở cửa (
                <span className="font-mono font-semibold text-foreground">
                  {start} – {end}
                </span>
                ), dài{' '}
                <span className="font-mono font-semibold text-foreground">
                  {durationMinutes(`${checkinStart}:00`, `${checkinEnd}:00`)} phút
                </span>
                .
              </p>
            )}

            {/* Tuỳ chọn nhanh */}
            {!windowErr && (
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Đầu ca', from: start, to: start },
                  { label: '15 phút đầu', from: start, to: null },
                  { label: 'Cả ca', from: start, to: end },
                  { label: 'Cuối ca', from: null, to: end },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      if (p.from) setCheckinStart(p.from);
                      if (p.to) setCheckinEnd(p.to);
                      else if (p.label === '15 phút đầu')
                        setCheckinEnd(
                          fromMinutes(
                            Math.min(
                              toMinutes(`${p.from}:00`) + 15,
                              toMinutes(`${end}:00`)
                            )
                          )
                        );
                    }}
                    className="apes-badge border border-border/70 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-primary"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="note" className="apes-label">
            Ghi chú
          </label>
          <Input
            id="note"
            name="note"
            defaultValue={editing?.note ?? ''}
            placeholder="VD: Buổi họp nhóm..."
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/70 p-3 text-sm transition-colors hover:bg-accent/50">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={editing?.is_active ?? true}
            className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
          />
          <span className="font-medium">Đang hoạt động</span>
        </label>
      </form>
    </Modal>
  );
}

// =============================================
// MODAL: ÁP DỤNG HÀNG LOẠT
// =============================================
function BulkApplyModal({
  open,
  onClose,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  existing: Schedule[];
}) {
  const { error, success, setError, setSuccess, run } = useActionFeedback();
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('17:00');
  const [note, setNote] = useState('');
  const [replace, setReplace] = useState(true);
  const [allowCheckin, setAllowCheckin] = useState(false);
  const [checkinStart, setCheckinStart] = useState('08:00');
  const [checkinEnd, setCheckinEnd] = useState('08:15');
  const [pending, startTransition] = useTransition();

  const grouped = useMemo(() => groupByDay(existing), [existing]);
  const invalidRange = !isValidRange(start, end);
  const targetCount = days.reduce((n, d) => n + (grouped.get(d)?.length ?? 0), 0);

  const windowErr =
    allowCheckin && !invalidRange
      ? checkinWindowError(
          { start_time: `${start}:00`, end_time: `${end}:00` },
          `${checkinStart}:00`,
          `${checkinEnd}:00`
        )
      : null;

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const submit = () => {
    run(async () => {
      if (replace && days.length > 0) {
        await deleteSchedulesByDays(days);
      }
      const res = await applyScheduleToDays({
        days,
        start_time: `${start}:00`,
        end_time: `${end}:00`,
        note: note.trim() || null,
        allow_checkin: allowCheckin,
        checkin_start_time: allowCheckin ? `${checkinStart}:00` : null,
        checkin_end_time: allowCheckin ? `${checkinEnd}:00` : null,
      });
      setSuccess(`Đã áp dụng ${res.count} ca cho ${days.length} ngày`);
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Áp dụng giờ cho nhiều ngày"
      description="Tạo cùng một khung giờ cho các ngày được chọn"
      className="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button
            variant="brand"
            onClick={submit}
            disabled={pending || days.length === 0 || invalidRange || !!windowErr}
          >
            {pending ? 'Đang áp dụng...' : `Áp dụng cho ${days.length} ngày`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <InlineError message={error} />}
        {success && <InlineSuccess message={success} />}

        {/* Chọn ngày */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="apes-label">Chọn ngày trong tuần</span>
            <div className="flex gap-2">
              <button
                onClick={() => setDays(DAYS.map((d) => d.value))}
                className="text-xs font-medium text-primary hover:underline"
              >
                Chọn tất cả
              </button>
              <button
                onClick={() => setDays([])}
                className="text-xs font-medium text-muted-foreground hover:underline"
              >
                Bỏ chọn
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {DAYS.map((d) => {
              const selected = days.includes(d.value);
              const count = grouped.get(d.value)?.length ?? 0;
              return (
                <button
                  key={d.value}
                  onClick={() => toggleDay(d.value)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-lg border py-2.5 text-xs font-semibold transition-all',
                    selected
                      ? 'border-primary bg-accent text-accent-foreground shadow-brand'
                      : 'border-border/70 text-muted-foreground hover:border-primary/40 hover:bg-accent/50'
                  )}
                >
                  {d.short}
                  {count > 0 && (
                    <span className="text-[10px] font-normal opacity-70">{count} ca</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Giờ */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="bulk-start" className="apes-label">
              Giờ bắt đầu
            </label>
            <Input
              id="bulk-start"
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="bulk-end" className="apes-label">
              Giờ kết thúc
            </label>
            <Input
              id="bulk-end"
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              aria-invalid={invalidRange}
            />
          </div>
        </div>

        {invalidRange && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            Giờ kết thúc phải sau giờ bắt đầu
          </p>
        )}

        {/* ===== ĐIỂM DANH (áp dụng cho tất cả ngày đã chọn) ===== */}
        <label
          className={cn(
            'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-all',
            allowCheckin
              ? 'border-success/40 bg-success/[0.07]'
              : 'border-border/70 hover:bg-accent/50'
          )}
        >
          <input
            type="checkbox"
            checked={allowCheckin}
            onChange={(e) => setAllowCheckin(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(var(--success))]"
          />
          <span>
            <span className="flex items-center gap-1.5 font-medium">
              <ScanLine className="h-4 w-4" />
              Cho phép điểm danh trong các ca này
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {allowCheckin
                ? `Mở điểm danh ${checkinStart} – ${checkinEnd} cho ${days.length} ngày đã chọn.`
                : 'Các ca tạo ra sẽ không cho phép điểm danh.'}
            </span>
          </span>
        </label>

        {allowCheckin && (
          <div
            className={cn(
              'space-y-3 rounded-lg border p-3.5',
              windowErr
                ? 'border-destructive/40 bg-destructive/5'
                : 'border-success/40 bg-success/[0.07]'
            )}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="bulk-checkin-start" className="apes-label">
                  Bắt đầu điểm danh
                </label>
                <Input
                  id="bulk-checkin-start"
                  type="time"
                  value={checkinStart}
                  min={start}
                  max={end}
                  onChange={(e) => setCheckinStart(e.target.value)}
                  aria-invalid={!!windowErr}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="bulk-checkin-end" className="apes-label">
                  Kết thúc điểm danh
                </label>
                <Input
                  id="bulk-checkin-end"
                  type="time"
                  value={checkinEnd}
                  min={start}
                  max={end}
                  onChange={(e) => setCheckinEnd(e.target.value)}
                  aria-invalid={!!windowErr}
                />
              </div>
            </div>
            {windowErr && (
              <p className="flex items-start gap-1.5 text-xs font-medium text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {windowErr}
              </p>
            )}
            {!windowErr && (
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '15 phút đầu', from: start },
                  { label: 'Cả ca', from: start },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      if (p.label === '15 phút đầu') {
                        setCheckinStart(p.from);
                        setCheckinEnd(
                          fromMinutes(
                            Math.min(
                              toMinutes(`${p.from}:00`) + 15,
                              toMinutes(`${end}:00`)
                            )
                          )
                        );
                      } else {
                        setCheckinStart(start);
                        setCheckinEnd(end);
                      }
                    }}
                    className="apes-badge border border-border/70 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-primary"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="bulk-note" className="apes-label">
            Ghi chú (áp dụng cho tất cả)
          </label>
          <Input
            id="bulk-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VD: Ca sáng chung"
          />
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/70 p-3 text-sm transition-colors hover:bg-accent/50">
          <input
            type="checkbox"
            checked={replace}
            onChange={(e) => setReplace(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
          />
          <span>
            <span className="font-medium">Xoá ca cũ của các ngày đã chọn</span>
            {targetCount > 0 && (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Sẽ xoá {targetCount} ca hiện có trước khi tạo ca mới.
              </span>
            )}
          </span>
        </label>

        <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/50 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Thao tác này áp dụng cho các ngày trong tuần và lặp lại mỗi tuần.
          </span>
        </div>
      </div>
    </Modal>
  );
}

// =============================================
// MODAL: SAO CHÉP NGÀY
// =============================================
function CopyDayModal({
  open,
  onClose,
  schedules,
}: {
  open: boolean;
  onClose: () => void;
  schedules: Schedule[];
}) {
  const { error, success, setError, setSuccess, run } = useActionFeedback();
  const [sourceDay, setSourceDay] = useState<number | null>(null);
  const [targets, setTargets] = useState<number[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const [pending, startTransition] = useTransition();

  const grouped = useMemo(() => groupByDay(schedules), [schedules]);
  const sourceList = sourceDay !== null ? grouped.get(sourceDay) ?? [] : [];
  const hasSource = sourceList.length > 0;

  const availableSources = DAYS.filter((d) => (grouped.get(d.value)?.length ?? 0) > 0);
  const targetCount = targets.reduce((n, d) => n + (grouped.get(d)?.length ?? 0), 0);

  const toggleTarget = (d: number) =>
    setTargets((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const submit = () => {
    if (sourceDay === null) return;
    run(async () => {
      const res = await copyScheduleFromDay({
        sourceDay,
        days: targets,
        overwrite,
      });
      setSuccess(`Đã sao chép ${res.count} ca sang ${targets.length} ngày`);
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sao chép lịch từ ngày"
      description="Nhân bản toàn bộ khung giờ của một ngày sang các ngày khác"
      className="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button
            variant="brand"
            onClick={submit}
            disabled={pending || !hasSource || targets.length === 0}
          >
            {pending ? 'Đang sao chép...' : 'Sao chép'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <InlineError message={error} />}
        {success && <InlineSuccess message={success} />}

        {/* Chọn ngày nguồn */}
        <div className="space-y-2">
          <span className="apes-label">Ngày nguồn</span>
          {availableSources.length === 0 ? (
            <p className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
              Chưa có ngày nào có khung giờ để sao chép.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {availableSources.map((d) => (
                <button
                  key={d.value}
                  onClick={() => {
                    setSourceDay(d.value);
                    setTargets([]);
                  }}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-lg border py-2.5 text-xs font-semibold transition-all',
                    sourceDay === d.value
                      ? 'border-primary bg-accent text-accent-foreground shadow-brand'
                      : 'border-border/70 text-muted-foreground hover:border-primary/40 hover:bg-accent/50'
                  )}
                >
                  {d.short}
                  <span className="text-[10px] font-normal opacity-70">
                    {grouped.get(d.value)?.length ?? 0} ca
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Xem trước nguồn */}
        {hasSource && (
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
            <p className="text-xs font-semibold text-muted-foreground">
              Sẽ sao chép {sourceList.length} ca từ {dayLabel(sourceDay!)}:
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sourceList.map((s) => (
                <span
                  key={s.id}
                  className="apes-badge bg-background font-mono text-muted-foreground"
                >
                  {toHM(s.start_time)}–{toHM(s.end_time)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Chọn ngày đích */}
        {hasSource && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="apes-label">Sao chép sang ngày</span>
              <button
                onClick={() =>
                  setTargets(
                    DAYS.map((d) => d.value).filter((v) => v !== sourceDay)
                  )
                }
                className="text-xs font-medium text-primary hover:underline"
              >
                Chọn tất cả
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {DAYS.map((d) => {
                const isSource = d.value === sourceDay;
                const selected = targets.includes(d.value);
                const count = grouped.get(d.value)?.length ?? 0;
                return (
                  <button
                    key={d.value}
                    disabled={isSource}
                    onClick={() => toggleTarget(d.value)}
                    className={cn(
                      'flex flex-col items-center gap-0.5 rounded-lg border py-2.5 text-xs font-semibold transition-all',
                      isSource && 'cursor-not-allowed border-border/40 bg-muted/40 text-muted-foreground/40',
                      !isSource && selected
                        ? 'border-primary bg-accent text-accent-foreground shadow-brand'
                        : !isSource && 'border-border/70 text-muted-foreground hover:border-primary/40 hover:bg-accent/50'
                    )}
                  >
                    {d.short}
                    {count > 0 && (
                      <span className="text-[10px] font-normal opacity-70">{count} ca</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/70 p-3 text-sm transition-colors hover:bg-accent/50">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
          />
          <span>
            <span className="font-medium">Ghi đè ca cũ ở ngày đích</span>
            {targetCount > 0 && (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Sẽ xoá {targetCount} ca hiện có. Bỏ chọn nếu muốn giữ lại và thêm ca mới.
              </span>
            )}
          </span>
        </label>
      </div>
    </Modal>
  );
}

// =============================================
// MODAL: THÊM / SỬA NGÀY NGHỈ
// =============================================
function HolidayFormModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Holiday | null;
}) {
  const { error, setError, run } = useActionFeedback();
  const [mode, setMode] = useState<'single' | 'range'>('single');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const openKey = `${open}-${editing?.id ?? 'new'}`;
  const [formKey, setFormKey] = useState('');
  if (open && openKey !== formKey) {
    setFormKey(openKey);
    setMode('single');
    setFrom('');
    setTo('');
    setError(null);
  }

  const rangeInvalid = mode === 'range' && from && to && to < from;
  const rangeCount = useMemo(() => {
    if (mode === 'single' || !from) return 0;
    return eachDateISO(from, to || from).length;
  }, [mode, from, to]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
        const name = String(fd.get('name'));
        const isRecurring = fd.get('is_recurring') === 'on';
        const note = String(fd.get('note') ?? '').trim() || null;

    run(async () => {
      if (editing) {
        await updateHoliday(editing.id, {
          holiday_date: String(fd.get('holiday_date')),
          name,
          is_recurring: isRecurring,
          note,
        });
      } else if (mode === 'range') {
        const dates = eachDateISO(from, to || from);
        await createHolidaysBulk(
          dates.map((d) => ({ holiday_date: d, name, is_recurring: isRecurring, note }))
        );
      } else {
        await createHoliday({
          holiday_date: String(fd.get('holiday_date')),
          name,
          is_recurring: isRecurring,
          note,
        });
      }
      onClose();
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Sửa ngày nghỉ' : 'Thêm ngày nghỉ'}
      description="Ngày lễ/Tết sẽ không tính điểm danh"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" form="holiday-form" variant="brand" disabled={!!rangeInvalid}>
            {editing ? 'Cập nhật' : 'Thêm'}
          </Button>
        </>
      }
    >
      <form id="holiday-form" className="space-y-4" onSubmit={submit}>
        {error && <InlineError message={error} />}

        {/* Chế độ: một ngày / khoảng ngày */}
        {!editing && (
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/70 p-1">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={cn(
                'rounded-md py-2 text-sm font-medium transition-colors',
                mode === 'single'
                  ? 'bg-brand-gradient text-white shadow-brand'
                  : 'text-muted-foreground hover:bg-accent'
              )}
            >
              Một ngày
            </button>
            <button
              type="button"
              onClick={() => setMode('range')}
              className={cn(
                'rounded-md py-2 text-sm font-medium transition-colors',
                mode === 'range'
                  ? 'bg-brand-gradient text-white shadow-brand'
                  : 'text-muted-foreground hover:bg-accent'
              )}
            >
              Khoảng ngày
            </button>
          </div>
        )}

        {mode === 'single' || editing ? (
          <div className="space-y-1.5">
            <label htmlFor="holiday_date" className="apes-label">
              Ngày
            </label>
            <Input
              id="holiday_date"
              type="date"
              name="holiday_date"
              required
              defaultValue={editing?.holiday_date ?? ''}
            />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="range-from" className="apes-label">
                  Từ ngày
                </label>
                <Input
                  id="range-from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="range-to" className="apes-label">
                  Đến ngày
                </label>
                <Input
                  id="range-to"
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                  aria-invalid={!!rangeInvalid}
                />
              </div>
            </div>
            {rangeCount > 1 && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-info">
                <Check className="h-3.5 w-3.5" />
                Sẽ tạo {rangeCount} ngày nghỉ
              </p>
            )}
            {rangeInvalid && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                Ngày kết thúc phải sau ngày bắt đầu
              </p>
            )}
          </>
        )}

        <div className="space-y-1.5">
          <label htmlFor="holiday-name" className="apes-label">
            Tên
          </label>
          <Input
            id="holiday-name"
            name="name"
            required
            defaultValue={editing?.name ?? ''}
            placeholder="VD: Tết Nguyên Đán, Quốc khánh..."
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="holiday-note" className="apes-label">
            Ghi chú
          </label>
          <Textarea
            id="holiday-note"
            name="note"
            defaultValue={editing?.note ?? ''}
            placeholder="(không bắt buộc)"
            rows={3}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/70 p-3 text-sm transition-colors hover:bg-accent/50">
          <input
            type="checkbox"
            name="is_recurring"
            defaultChecked={editing?.is_recurring ?? false}
            className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
          />
          <span className="font-medium">Lặp lại hàng năm</span>
        </label>
      </form>
    </Modal>
  );
}

// =============================================
// FEEDBACK
// =============================================
function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function InlineSuccess({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
      <Check className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
