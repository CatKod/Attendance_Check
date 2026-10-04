'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { MIN_CHECKINS_PER_WEEK, MAX_CHECKINS_PER_WEEK } from '@/lib/schedule-utils';

async function assertManager() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Chưa đăng nhập');
  const { data: u } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!u || u.role !== 'lab_manager') throw new Error('Chỉ lab_manager mới có quyền thực hiện');
  return supabase;
}

async function assertLeader() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Chưa đăng nhập');
  const { data: u } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!u || !['lab_leader', 'lab_manager'].includes(u.role)) throw new Error('Không có quyền');
  return supabase;
}

// =============================================
// MEMBERS
// =============================================
export type MemberInput = {
  mssv: string;
  full_name: string;
  email: string;
  khoa: string;
  group_id: string | null;
  role: 'student' | 'group_leader' | 'lab_leader' | 'lab_manager';
};

export async function createMember(input: MemberInput) {
  const supabase = await assertLeader();
  const admin = createServiceClient();

  // 1) Tạo auth user qua service-role (bypass RLS).
  //    Trigger handle_new_user() sẽ tự tạo row trong public.users.
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.mssv, // mật khẩu mặc định = MSSV
    email_confirm: true,
    user_metadata: {
      mssv: input.mssv,
      full_name: input.full_name,
      khoa: input.khoa,
      role: input.role,
    },
  });
  if (authErr || !authData?.user) {
    throw new Error(authErr?.message ?? 'Không thể tạo auth user');
  }
  const userId = authData.user.id;

  // 2) Cập nhật group_id/role (trigger chỉ set role mặc định = raw_user_meta_data.role).
  //    Dùng service-role để update chắc chắn áp dụng được.
  const { error: updateErr } = await admin
    .from('users')
    .update({ group_id: input.group_id, role: input.role })
    .eq('id', userId);
  if (updateErr) throw new Error(updateErr.message);

  revalidatePath('/dashboard/members');
  return { id: userId };
}

export async function updateMember(id: string, input: Partial<MemberInput>) {
  const supabase = await assertLeader();
  const { error } = await supabase.from('users').update(input).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/members');
}

export async function deleteMember(id: string) {
  await assertLeader();
  const admin = createServiceClient();

  // 1) Xóa auth.users trước (cascade sẽ xóa public.users qua FK).
  const { error: authErr } = await admin.auth.admin.deleteUser(id);
  if (authErr) throw new Error(authErr.message);

  // 2) Phòng trường hợp không có FK cascade (chỉ trong dev) — xóa row public.users.
  //    ON CONFLICT DO NOTHING không hoạt động ở đây vì đã xóa xong; ignore lỗi 404.
  await admin.from('users').delete().eq('id', id);

  revalidatePath('/dashboard/members');
}

// =============================================
// GROUPS
// =============================================
export type GroupInput = { name: string; description: string; leader_id: string | null };

export async function createGroup(input: GroupInput) {
  const supabase = await assertLeader();
  const { data, error } = await supabase.from('groups').insert(input).select('id').single();
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/groups');
  return data;
}

export async function updateGroup(id: string, input: Partial<GroupInput>) {
  const supabase = await assertLeader();
  const { error } = await supabase.from('groups').update(input).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/groups');
}

export async function deleteGroup(id: string) {
  const supabase = await assertLeader();
  const { error } = await supabase.from('groups').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/groups');
}

// =============================================
// WIFI
// =============================================
export type WifiInput = {
  location_id: string;
  ssid: string;
  subnet: string;
  gateway?: string;
  bssid?: string;
  is_primary?: boolean;
  is_active?: boolean;
};

export async function createWifi(input: WifiInput) {
  const supabase = await assertLeader();
  const { data, error } = await supabase.from('wifi_networks').insert(input).select('id').single();
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/wifi');
  return data;
}

export async function updateWifi(id: string, input: Partial<WifiInput>) {
  const supabase = await assertLeader();
  const { error } = await supabase.from('wifi_networks').update(input).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/wifi');
}

export async function deleteWifi(id: string) {
  const supabase = await assertLeader();
  const { error } = await supabase.from('wifi_networks').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/wifi');
}

// =============================================
// LOCATIONS
// =============================================
export type LocationInput = { name: string; address: string; is_active: boolean };

export async function createLocation(input: LocationInput) {
  const supabase = await assertLeader();
  const { data, error } = await supabase.from('locations').insert(input).select('id').single();
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/wifi');
  return data;
}

// =============================================
// SCHEDULES (chỉ lab_manager)
// =============================================
export type ScheduleInput = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  /** Ca này có được phép điểm danh hay không */
  allow_checkin?: boolean;
  /** Bắt đầu được điểm danh — luôn lưu kèm theo allow_checkin */
  checkin_start_time?: string | null;
  /** Kết thúc được điểm danh */
  checkin_end_time?: string | null;
  /** null = xoá ghi chú (undefined sẽ bị Supabase bỏ qua, không xoá được) */
  note?: string | null;
};

export async function createSchedule(input: ScheduleInput) {
  const supabase = await assertManager();
  const { data, error } = await supabase
    .from('lab_schedules')
    .insert(normalizeCheckin(input))
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/schedule');
  return data;
}

export async function updateSchedule(id: string, input: Partial<ScheduleInput>) {
  const supabase = await assertManager();
  const { error } = await supabase
    .from('lab_schedules')
    .update(normalizeCheckin(input))
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/schedule');
}

export async function deleteSchedule(id: string) {
  const supabase = await assertManager();
  const { error } = await supabase.from('lab_schedules').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/schedule');
}

/**
 * Bật/tắt nhanh một khung giờ mà không cần mở modal.
 */
export async function toggleSchedule(id: string, is_active: boolean) {
  const supabase = await assertManager();
  const { error } = await supabase
    .from('lab_schedules')
    .update({ is_active })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/schedule');
}

/**
 * Bật/tắt quyền điểm danh của một ca mà không cần mở modal.
 * Tắt sẽ xoá luôn cửa sổ điểm danh để dữ liệu luôn nhất quán.
 */
export async function toggleScheduleCheckin(
  id: string,
  allow_checkin: boolean,
  window?: { start: string; end: string }
) {
  const supabase = await assertManager();
  const patch = allow_checkin
    ? {
        allow_checkin: true,
        // Thiếu cửa sổ thì mặc định lấy 15 phút đầu của ca
        checkin_start_time: window?.start ?? null,
        checkin_end_time: window?.end ?? null,
      }
    : {
        allow_checkin: false,
        checkin_start_time: null,
        checkin_end_time: null,
      };
  const { error } = await supabase.from('lab_schedules').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/schedule');
}

/**
 * Đảm bảo cửa sổ điểm danh luôn nhất quán với cờ cho phép.
 * Nếu không cho phép điểm danh → xoá cửa sổ (NULL).
 */
function normalizeCheckin<T extends Partial<ScheduleInput>>(input: T): T {
  if (input.allow_checkin === false) {
    return {
      ...input,
      allow_checkin: false,
      checkin_start_time: null,
      checkin_end_time: null,
    };
  }
  if (input.allow_checkin === true) {
    return {
      ...input,
      allow_checkin: true,
      // Không có cửa sổ thì coi như chưa cấu hình, để form bắt người dùng chọn
      checkin_start_time: input.checkin_start_time ?? null,
      checkin_end_time: input.checkin_end_time ?? null,
    };
  }
  return input;
}

/**
 * Áp dụng giờ cho nhiều ngày trong tuần cùng lúc (bulk edit).
 * Xoá các ca cũ của các ngày được chọn rồi tạo ca mới.
 */
export async function applyScheduleToDays(input: {
  days: number[];
  start_time: string;
  end_time: string;
  note?: string | null;
  is_active?: boolean;
  allow_checkin?: boolean;
  checkin_start_time?: string | null;
  checkin_end_time?: string | null;
}) {
  const supabase = await assertManager();
  if (input.days.length === 0) throw new Error('Chưa chọn ngày nào');

  const allowCheckin = input.allow_checkin === true;
  const rows = input.days.map((day_of_week) =>
    normalizeCheckin({
      day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      is_active: input.is_active ?? true,
      allow_checkin: allowCheckin,
      checkin_start_time: allowCheckin ? input.checkin_start_time ?? null : null,
      checkin_end_time: allowCheckin ? input.checkin_end_time ?? null : null,
      note: input.note || null,
    })
  );

  const { error } = await supabase.from('lab_schedules').insert(rows);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/schedule');
  return { count: rows.length };
}

/**
 * Nhân bản toàn bộ lịch của một ngày sang các ngày đích chưa có ca nào.
 * days: các day_of_week sẽ tạo bản sao
 */
export async function copyScheduleFromDay(input: {
  sourceDay: number;
  days: number[];
  overwrite?: boolean;
}) {
  const supabase = await assertManager();
  if (input.days.length === 0) throw new Error('Chưa chọn ngày đích');

  const { data: source, error: srcErr } = await supabase
    .from('lab_schedules')
    .select('*')
    .eq('day_of_week', input.sourceDay)
    .order('start_time');

  if (srcErr) throw new Error(srcErr.message);
  if (!source || source.length === 0) {
    throw new Error(`Thứ ${input.sourceDay} chưa có khung giờ để sao chép`);
  }

  const targetDays = [...new Set(input.days)].filter((d) => d !== input.sourceDay);
  if (targetDays.length === 0) throw new Error('Ngày đích không hợp lệ');

  if (input.overwrite) {
    const { error: delErr } = await supabase
      .from('lab_schedules')
      .delete()
      .in('day_of_week', targetDays);
    if (delErr) throw new Error(delErr.message);
  }

  const rows: ScheduleInput[] = [];
  for (const day of targetDays) {
    for (const s of source) {
      rows.push(
        normalizeCheckin({
          day_of_week: day,
          start_time: s.start_time,
          end_time: s.end_time,
          is_active: s.is_active,
          allow_checkin: s.allow_checkin,
          checkin_start_time: s.checkin_start_time ?? null,
          checkin_end_time: s.checkin_end_time ?? null,
          note: s.note ?? null,
        })
      );
    }
  }

  const { error } = await supabase.from('lab_schedules').insert(rows);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/schedule');
  return { count: rows.length };
}

/**
 * Xoá toàn bộ ca của một hoặc nhiều ngày trong tuần.
 */
export async function deleteSchedulesByDays(days: number[]) {
  const supabase = await assertManager();
  if (days.length === 0) throw new Error('Chưa chọn ngày nào');
  const { error } = await supabase.from('lab_schedules').delete().in('day_of_week', days);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/schedule');
}

// =============================================
// HOLIDAYS (chỉ lab_manager)
// =============================================
export type HolidayInput = {
  holiday_date: string;
  name: string;
  is_recurring: boolean;
  /** null = xoá ghi chú */
  note?: string | null;
};

export async function createHoliday(input: HolidayInput) {
  const supabase = await assertManager();
  const { data, error } = await supabase.from('lab_holidays').insert(input).select('id').single();
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/schedule');
  return data;
}

export async function updateHoliday(id: string, input: Partial<HolidayInput>) {
  const supabase = await assertManager();
  const { error } = await supabase.from('lab_holidays').update(input).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/schedule');
}

export async function deleteHoliday(id: string) {
  const supabase = await assertManager();
  const { error } = await supabase.from('lab_holidays').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/schedule');
}

/**
 * Thêm hàng loạt ngày nghỉ (VD: kỳ nghỉ Tết 10 ngày).
 * Tự bỏ qua các ngày đã tồn tại vì holiday_date có UNIQUE.
 */
export async function createHolidaysBulk(inputs: HolidayInput[]) {
  const supabase = await assertManager();
  if (inputs.length === 0) throw new Error('Không có ngày nào để thêm');

  // Loại trùng trong chính input
  const seen = new Set<string>();
  const unique = inputs.filter((h) => {
    if (seen.has(h.holiday_date)) return false;
    seen.add(h.holiday_date);
    return true;
  });

  const { data, error } = await supabase
    .from('lab_holidays')
    .upsert(unique, { onConflict: 'holiday_date', ignoreDuplicates: true })
    .select('id');

  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/schedule');
  return { inserted: data?.length ?? 0, skipped: unique.length - (data?.length ?? 0) };
}

// =============================================
// LAB SETTINGS — số lần điểm danh mỗi tuần (chỉ lab_manager)
// =============================================
/**
 * Cập nhật số lần điểm danh bắt buộc trong 1 tuần.
 * Đây là mục tiêu để sinh viên theo dõi, không khóa cứng việc điểm danh.
 */
export async function updateWeeklyCheckinTarget(requiredCheckins: number) {
  const supabase = await assertManager();
  if (
    !Number.isInteger(requiredCheckins) ||
    requiredCheckins < MIN_CHECKINS_PER_WEEK ||
    requiredCheckins > MAX_CHECKINS_PER_WEEK
  ) {
    throw new Error(
      `Số lần điểm danh phải từ ${MIN_CHECKINS_PER_WEEK} đến ${MAX_CHECKINS_PER_WEEK}`
    );
  }

  // lab_settings là single-row: luôn cập nhật row đầu tiên
  const { data: existing } = await supabase
    .from('lab_settings')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('lab_settings')
      .update({ required_checkins_per_week: requiredCheckins })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('lab_settings')
      .insert({ required_checkins_per_week: requiredCheckins });
    if (error) throw new Error(error.message);
  }

  revalidatePath('/dashboard/schedule');
  return { requiredCheckins };
}