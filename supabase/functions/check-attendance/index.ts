// ============================================================
// Deno Edge Function: check-attendance
// Ghi nhận điểm danh từ Desktop (Electron) và Mobile (Expo)
//
// Kiểm tra theo thứ tự:
//   1. User tồn tại
//   2. device_bindings khớp & còn active
//   3. IP thuộc subnet Wi-Fi lab đang bật
//   4. Đang nằm trong cửa sổ điểm danh hôm nay (allow_checkin)
//   5. Chưa điểm danh hôm nay
//   → INSERT attendance (method = 'desktop' | 'mobile_wifi')
//
// Deploy: supabase functions deploy check-attendance
// ============================================================

import { jsonResponse, preflight } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase.ts';
import {
  vietnamDayOfWeek,
  vietnamDateISO,
  vietnamMinutes,
  humanTime,
  toMinutes,
  formatWindows,
  type CheckinWindowRow,
} from '../_shared/time.ts';

interface RequestBody {
  user_id: string;
  ip_address: string;
  method: 'desktop' | 'mobile_wifi';
  device_id: string;
  /** Thông báo lỗi thân thiện hơn khi app muốn tự hiển thị */
  lang?: 'vi' | 'en';
}

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = (await req.json()) as RequestBody;
    const { user_id, ip_address, method, device_id } = body;

    if (!user_id || !ip_address || !method || !device_id) {
      return jsonResponse(
        { error: 'Thiếu tham số: user_id, ip_address, method, device_id' },
        400
      );
    }

    const supabaseAdmin = adminClient();

    // ========================================
    // BƯỚC 1: Verify user
    // ========================================
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, mssv, full_name, role, email')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return jsonResponse({ error: 'User không tồn tại' }, 404);
    }

    // ========================================
    // BƯỚC 2: Verify device binding
    // ========================================
    const bindingKind = method === 'desktop' ? 'desktop' : 'mobile';
    const { data: binding, error: bindingError } = await supabaseAdmin
      .from('device_bindings')
      .select('id, status, device_identifier')
      .eq('user_id', user_id)
      .eq('kind', bindingKind)
      .single();

    if (bindingError || !binding) {
      return jsonResponse(
        {
          error:
            bindingKind === 'desktop'
              ? 'Máy này chưa được liên kết với bạn. Vui lòng nhập MSSV trước.'
              : 'Điện thoại chưa được liên kết. Vui lòng quét QR tại lab.',
        },
        403
      );
    }

    if (binding.status !== 'active') {
      return jsonResponse(
        {
          error:
            'Thiết bị đã bị vô hiệu hóa. Vui lòng liên hệ Trưởng Lab để được reset.',
        },
        403
      );
    }

    // Desktop so sánh không phân biệt hoa thường; mobile so chính xác
    const normalizedDevice =
      bindingKind === 'desktop'
        ? String(device_id).toLowerCase()
        : device_id;

    if (binding.device_identifier.toLowerCase() !== normalizedDevice) {
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: user_id,
        action: 'attendance_denied',
        entity: 'attendance',
        payload: { reason: 'Device mismatch', method, got: device_id },
      });
      return jsonResponse(
        { error: 'Thiết bị không khớp với thiết bị đã đăng ký.' },
        403
      );
    }

    // ========================================
    // BƯỚC 3: Verify IP thuộc Wi-Fi lab
    // ========================================
    const { data: wifiRows, error: wifiErr } = await supabaseAdmin.rpc(
      'match_wifi_by_ip',
      { check_ip: ip_address }
    );

    if (wifiErr) {
      console.error('match_wifi_by_ip error:', wifiErr);
    }

    const wifiResult = Array.isArray(wifiRows) ? wifiRows[0] : null;

    if (!wifiResult) {
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: user_id,
        action: 'attendance_denied',
        entity: 'attendance',
        payload: { ip_address, method, reason: 'IP not in lab subnet' },
        ip_address,
      });

      return jsonResponse(
        {
          error:
            method === 'mobile_wifi'
              ? 'Vui lòng kết nối Wi-Fi lab (APES-Lab) để điểm danh.'
              : 'Không phát hiện kết nối Wi-Fi lab.',
          code: 'NOT_ON_LAB_WIFI',
        },
        403
      );
    }

    // ========================================
    // BƯỚC 4: Verify đang trong cửa sổ điểm danh
    // ========================================
    const dayOfWeek = vietnamDayOfWeek();
    const { data: windows } = await supabaseAdmin.rpc('get_checkin_windows', {
      for_day_of_week: dayOfWeek,
    });

    const slots = (windows ?? []) as CheckinWindowRow[];

    if (slots.length === 0) {
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: user_id,
        action: 'attendance_denied',
        entity: 'attendance',
        payload: { reason: 'No check-in window today', day_of_week: dayOfWeek },
        ip_address,
      });
      return jsonResponse(
        {
          error: 'Hôm nay không mở điểm danh. Vui lòng liên hệ Trưởng Lab.',
          code: 'NO_WINDOW_TODAY',
          today_windows: [],
        },
        403
      );
    }

    const nowMins = vietnamMinutes();
    const inWindow = slots.some(
      (s) => nowMins >= toMinutes(s.checkin_start) && nowMins <= toMinutes(s.checkin_end)
    );

    if (!inWindow) {
      const human = slots
        .map((s) => `${humanTime(s.checkin_start)} – ${humanTime(s.checkin_end)}`)
        .join(', ');

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: user_id,
        action: 'attendance_denied',
        entity: 'attendance',
        payload: { reason: 'Outside check-in window', day_of_week: dayOfWeek, now: nowMins },
        ip_address,
      });

      return jsonResponse(
        {
          error: `Ngoài giờ điểm danh. Hôm nay chỉ điểm danh được: ${human}`,
          code: 'OUTSIDE_WINDOW',
          today_windows: formatWindows(slots),
        },
        403
      );
    }

    // ========================================
    // BƯỚC 5: Check đã điểm danh hôm nay chưa
    // ========================================
    const todayISO = vietnamDateISO();
    const { data: existingAttendance } = await supabaseAdmin
      .from('attendance')
      .select('id, check_in_time, method')
      .eq('user_id', user_id)
      .gte('check_in_time', `${todayISO}T00:00:00+07:00`)
      .lt('check_in_time', `${todayISO}T23:59:59+07:00`)
      .in('method', ['desktop', 'mobile_wifi'])
      .maybeSingle();

    if (existingAttendance) {
      const at = new Date(existingAttendance.check_in_time).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
      });
      return jsonResponse(
        {
          warning: `Bạn đã điểm danh hôm nay rồi (${at})`,
          already_attended: true,
          check_in_time: existingAttendance.check_in_time,
          method_used: existingAttendance.method,
        },
        200
      );
    }

    // ========================================
    // BƯỚC 6: Insert bản ghi
    // ========================================
    // Session đang mở (optional)
    const { data: currentSession } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('status', 'open')
      .lte('start_time', new Date().toISOString())
      .gte('end_time', new Date().toISOString())
      .maybeSingle();

    const { data: attendance, error: insertError } = await supabaseAdmin
      .from('attendance')
      .insert({
        user_id,
        session_id: currentSession?.id ?? null,
        method,
        ip_address,
        subnet_matched: wifiResult.wifi_id,
        location_id: wifiResult.location_id,
        status: 'present',
      })
      .select()
      .single();

    if (insertError) {
      // Đụng unique index "1 lần/ngày" → coi như đã điểm danh
      if (insertError.code === '23505') {
        return jsonResponse(
          { warning: 'Bạn đã điểm danh hôm nay rồi', already_attended: true },
          200
        );
      }
      return jsonResponse(
        { error: 'Lỗi khi ghi nhận điểm danh: ' + insertError.message },
        500
      );
    }

    // Cập nhật last_seen + last_login
    await supabaseAdmin
      .from('device_bindings')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', binding.id);

    await supabaseAdmin
      .from('users')
      .update({
        last_login_at: new Date().toISOString(),
        last_login_ip: ip_address,
      })
      .eq('id', user_id);

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: user_id,
      action: 'attendance_recorded',
      entity: 'attendance',
      entity_id: attendance.id,
      payload: { method, ip_address, location_id: wifiResult.location_id },
      ip_address,
    });

    const timeStr = new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    });

    return jsonResponse({
      success: true,
      message: 'Điểm danh thành công!',
      check_in_time: attendance.check_in_time,
      time: timeStr,
      method,
      location: wifiResult.ssid,
      wifi_ssid: wifiResult.ssid,
      attendance,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return jsonResponse(
      { error: 'Lỗi hệ thống: ' + (error as Error).message },
      500
    );
  }
});
