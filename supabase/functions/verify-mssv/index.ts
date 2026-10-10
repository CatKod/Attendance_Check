// ============================================================
// Deno Edge Function: verify-mssv
// Xác thực sinh viên tại Desktop kiosk bằng MSSV (F-DESK-AUTH-01..04)
//
// Luồng:
//   1. Nhận { mssv, mac_address }
//   2. Tra MSSV trong bảng users
//   3. Kiểm tra device_bindings kind='desktop'
//      - Chưa có        → INSERT binding với MAC hiện tại
//      - Có + MAC khớp  → OK
//      - Có + MAC khác  → TỪ CHỐI (SV đã liên kết máy khác)
//   4. Trả về thông tin SV để Desktop hiển thị
//
// Deploy: supabase functions deploy verify-mssv
// ============================================================

import { jsonResponse, preflight } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase.ts';
import { vietnamDayOfWeek, formatWindows } from '../_shared/time.ts';

interface Body {
  mssv: string;
  mac_address: string;
  /** Tùy chọn — thông tin bổ sung để bảo mật & audit */
  hostname?: string;
  os_info?: string;
  disk_serial?: string;
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const { mssv, mac_address, hostname, os_info, disk_serial } =
      (await req.json()) as Body;

    if (!mssv || !mac_address) {
      return jsonResponse({ error: 'Thiếu mssv hoặc mac_address' }, 400);
    }

    const normalizedMssv = String(mssv).trim().toUpperCase();
    const normalizedMac = String(mac_address).trim().toLowerCase();

    // Chuẩn hoá MAC về dạng 2 nhóm: aa:bb:cc:dd:ee:ff
    const macClean = normalizedMac.replace(/-/g, ':');
    const macParts = macClean.split(':');
    const mac = macParts.length === 6
      ? macParts.map((p) => p.padStart(2, '0')).join(':')
      : null;

    if (!mac) {
      return jsonResponse({ error: 'Địa chỉ MAC không hợp lệ' }, 400);
    }

    const supabase = adminClient();

    // 1) Tìm user theo MSSV
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, mssv, full_name, khoa, role, group_id, groups!fk_users_group(name)')
      .eq('mssv', normalizedMssv)
      .single();

    if (userErr || !user) {
      // Log thử xác thực sai
      await supabase.from('audit_logs').insert({
        action: 'desktop_auth_failed',
        entity: 'user',
        payload: { mssv: normalizedMssv, reason: 'MSSV not found', mac },
      });
      return jsonResponse(
        { error: 'MSSV không tồn tại trong hệ thống. Vui lòng kiểm tra lại.' },
        404
      );
    }

    const u = user as unknown as {
      id: string;
      mssv: string;
      full_name: string;
      khoa: string;
      role: string;
      group_id: string | null;
      groups: { name: string }[] | { name: string } | null;
    };
    // groups() là quan hệ 1-n nên trả về mảng
    const groupName = Array.isArray(u.groups)
      ? (u.groups[0]?.name ?? null)
      : (u.groups?.name ?? null);

    // 2) Kiểm tra device binding desktop hiện có
    const { data: existing } = await supabase
      .from('device_bindings')
      .select('id, device_identifier, status, bound_at')
      .eq('user_id', u.id)
      .eq('kind', 'desktop')
      .maybeSingle();

    // 2.5) Bug fix: chống 1 MAC bị bind cho nhiều user.
    //      Nếu MAC này đã bind với user khác (active), từ chối ngay.
    //      Query có .limit(1) vì cùng 1 MAC có thể bị bind với nhiều user
    //      (do bug trước đó hoặc data race). .maybeSingle() fail khi
    //      có nhiều hơn 1 row → tách riêng count vs data.
    const { count: conflictCount } = await supabase
      .from('device_bindings')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'desktop')
      .eq('device_identifier', mac)
      .eq('status', 'active')
      .neq('user_id', u.id)
      .limit(1);

    if (conflictCount && conflictCount > 0) {
      // Lấy thông tin owner của MAC để báo user
      const { data: conflictOwner } = await supabase
        .from('device_bindings')
        .select('users!inner(mssv, full_name)')
        .eq('kind', 'desktop')
        .eq('device_identifier', mac)
        .eq('status', 'active')
        .neq('user_id', u.id)
        .limit(1)
        .maybeSingle();

      const otherMssv = (conflictOwner as unknown as { users: { mssv: string; full_name: string } })?.users?.mssv ?? 'MSSV khác';
      const otherName = (conflictOwner as unknown as { users: { mssv: string; full_name: string } })?.users?.full_name ?? '';

      await supabase.from('audit_logs').insert({
        action: 'desktop_auth_failed',
        entity: 'device_binding',
        payload: {
          reason: 'MAC already bound to another user',
          attempted_mssv: normalizedMssv,
          other_mssv: otherMssv,
          mac,
        },
      });
      return jsonResponse(
        {
          error:
            `Máy này đã được liên kết với SV ${otherMssv}${otherName ? ` (${otherName})` : ''}. ` +
            'Vui lòng liên hệ Trưởng Lab để reset binding.',
          code: 'MAC_BOUND_TO_OTHER_USER',
          other_mssv: otherMssv,
          other_name: otherName,
        },
        403
      );
    }

    let bindingAction: 'created' | 'reused' | 'reset_rebind';

    if (!existing) {
      // 3a) Chưa liên kết → tạo binding mới
      const { error: insErr } = await supabase.from('device_bindings').insert({
        user_id: u.id,
        kind: 'desktop',
        device_identifier: mac,
        status: 'active',
        bound_at: new Date().toISOString(),
        hostname: hostname ?? null,
        os_info: os_info ?? null,
        disk_serial: disk_serial ?? null,
      });
      if (insErr) {
        return jsonResponse({ error: 'Không thể lưu liên kết thiết bị: ' + insErr.message }, 500);
      }
      bindingAction = 'created';
    } else if (existing.status === 'reset' || existing.status === 'revoked') {
      // 3b) Trưởng Lab đã reset → cho phép liên kết lại
      const { error: updErr } = await supabase
        .from('device_bindings')
        .update({
          device_identifier: mac,
          status: 'active',
          bound_at: new Date().toISOString(),
          hostname: hostname ?? null,
          os_info: os_info ?? null,
          disk_serial: disk_serial ?? null,
          reset_reason: null,
          reset_at: null,
          reset_by: null,
        })
        .eq('id', existing.id);
      if (updErr) {
        return jsonResponse({ error: 'Không thể tái liên kết: ' + updErr.message }, 500);
      }
      bindingAction = 'reset_rebind';
    } else if (existing.device_identifier.toLowerCase() === mac) {
      // 3c) MAC khớp → cập nhật thông tin máy + last_seen
      await supabase
        .from('device_bindings')
        .update({
          last_seen_at: new Date().toISOString(),
          hostname: hostname ?? null,
          os_info: os_info ?? null,
          disk_serial: disk_serial ?? null,
        })
        .eq('id', existing.id);
      bindingAction = 'reused';
    } else {
      // 3d) MAC khác → TỪ CHỐI (F-DESK-AUTH-04)
      await supabase.from('audit_logs').insert({
        actor_id: u.id,
        action: 'desktop_auth_denied',
        entity: 'device_binding',
        entity_id: existing.id,
        payload: {
          reason: 'MAC mismatch',
          expected: existing.device_identifier,
          got: mac,
        },
      });
      return jsonResponse(
        {
          error:
            'Bạn đã được liên kết với một máy khác. Vui lòng liên hệ Trưởng Lab để reset.',
          code: 'MAC_MISMATCH',
        },
        403
      );
    }

    // 4) Cập nhật thông tin đăng nhập
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', u.id);

    // 5) Lấy lịch điểm danh hôm nay để Desktop hiển thị
    const todayDow = vietnamDayOfWeek();
    const { data: windows } = await supabase.rpc('get_checkin_windows', {
      for_day_of_week: todayDow,
    });

    // 6) Kiểm tra mobile đã liên kết chưa (F-DESK-AUTH-05 vĩnh viễn)
    //    Nếu mobile đã liên kết rồi, Desktop sẽ KHÔNG hiện QR nữa
    const { data: mobileBinding } = await supabase
      .from('device_bindings')
      .select('id, device_identifier, status, bound_at, mobile_linked_at')
      .eq('user_id', u.id)
      .eq('kind', 'mobile')
      .eq('status', 'active')
      .maybeSingle();

    const mobileLinked = !!mobileBinding;

    await supabase.from('audit_logs').insert({
      actor_id: u.id,
      action: 'desktop_auth_success',
      entity: 'user',
      entity_id: u.id,
      payload: {
        mac,
        binding: bindingAction,
        hostname: hostname ?? null,
        mobile_linked: mobileLinked,
      },
    });

    return jsonResponse({
      success: true,
      binding: bindingAction,
      user: {
        id: u.id,
        mssv: u.mssv,
        full_name: u.full_name,
        khoa: u.khoa,
        role: u.role,
        // groups() là quan hệ 1-n nên trả về mảng
        group_name: groupName,
      },
      mac_address: mac,
      /** MAC đã bind trong DB — dùng để so sánh với session trên client */
      bound_mac: existing?.device_identifier ?? mac,
      hostname: hostname ?? null,
      mobile_linked: mobileLinked,
      today_windows: formatWindows(windows),
      day_of_week: todayDow,
    });
  } catch (e) {
    console.error('verify-mssv error:', e);
    return jsonResponse({ error: 'Lỗi hệ thống: ' + (e as Error).message }, 500);
  }
});
