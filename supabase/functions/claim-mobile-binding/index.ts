// ============================================================
// Deno Edge Function: claim-mobile-binding
// Mobile quét QR từ Desktop → đổi token lấy session + liên kết thiết bị
// (F-MOB-AUTH-02..04, F-MOB-AUTH-06)
//
// Luồng:
//   1. Nhận { token, device_id }  (device_id = Android ID)
//   2. Kiểm tra token tồn tại, chưa dùng, chưa hết hạn
//   3. Kiểm tra device_bindings kind='mobile'
//      - Chưa có              → INSERT
//      - Có + device khác     → TỪ CHỐI (SV đã liên kết máy khác)
//      - Có + device khớp     → OK
//      - Có + status reset    → cho phép liên kết lại
//   4. Đánh dấu token đã dùng
//   5. Trả về access_token (tạo session cho user để app dùng lâu dài)
//
// Deploy: supabase functions deploy claim-mobile-binding
// ============================================================

import { jsonResponse, preflight } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase.ts';
import { vietnamDayOfWeek, formatWindows } from '../_shared/time.ts';

interface Body {
  token: string;
  device_id: string;
  /** model thiết bị để Trưởng Lab dễ nhận biết */
  device_model?: string;
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const { token, device_id, device_model } = (await req.json()) as Body;

    if (!token || !device_id) {
      return jsonResponse({ error: 'Thiếu token hoặc device_id' }, 400);
    }

    const supabase = adminClient();

    // 1) Kiểm tra token
    const { data: link, error: linkErr } = await supabase
      .from('device_link_tokens')
      .select('id, user_id, expires_at, used_at, kiosk_mac')
      .eq('token', token)
      .single();

    if (linkErr || !link) {
      return jsonResponse(
        { error: 'Mã QR không hợp lệ. Vui lòng quét lại mã mới trên Desktop.' },
        404
      );
    }

    if (link.used_at) {
      return jsonResponse(
        { error: 'Mã QR đã được sử dụng. Vui lòng quét mã mới.' },
        409
      );
    }

    if (new Date(link.expires_at).getTime() < Date.now()) {
      return jsonResponse(
        { error: 'Mã QR đã hết hạn (60 giây). Vui lòng quét lại mã mới trên Desktop.' },
        410
      );
    }

    // 2) Lấy thông tin user
    const { data: user } = await supabase
      .from('users')
      .select('id, mssv, full_name, khoa, role, group_id, email, groups!fk_users_group(name)')
      .eq('id', link.user_id)
      .single();

    if (!user) {
      return jsonResponse({ error: 'Không tìm thấy sinh viên' }, 404);
    }

    // groups() là quan hệ 1-n nên trả về mảng; chỉ lấy nhóm đầu tiên
    const groupsData = user.groups as unknown as
      | { name: string }[]
      | { name: string }
      | null;
    const groupName = Array.isArray(groupsData)
      ? (groupsData[0]?.name ?? null)
      : (groupsData?.name ?? null);
    const userEmail = user.email ?? `${user.mssv}@apes.edu.vn`;

    // 3) Kiểm/tạo device binding mobile
    const { data: existing } = await supabase
      .from('device_bindings')
      .select('id, device_identifier, status, bound_at')
      .eq('user_id', user.id)
      .eq('kind', 'mobile')
      .maybeSingle();

    const now = new Date().toISOString();
    let bindingAction: 'created' | 'reused' | 'reset_rebind';

    if (!existing) {
      const { error: insErr } = await supabase.from('device_bindings').insert({
        user_id: user.id,
        kind: 'mobile',
        device_identifier: device_id,
        status: 'active',
        bound_at: now,
        note: device_model ?? null,
      });
      if (insErr) {
        return jsonResponse({ error: 'Không thể lưu liên kết: ' + insErr.message }, 500);
      }
      bindingAction = 'created';
    } else if (existing.status === 'reset' || existing.status === 'revoked') {
      const { error: updErr } = await supabase
        .from('device_bindings')
        .update({
          device_identifier: device_id,
          status: 'active',
          bound_at: now,
          note: device_model ?? null,
          reset_reason: null,
          reset_at: null,
          reset_by: null,
        })
        .eq('id', existing.id);
      if (updErr) {
        return jsonResponse({ error: 'Không thể tái liên kết: ' + updErr.message }, 500);
      }
      bindingAction = 'reset_rebind';
    } else if (existing.device_identifier === device_id) {
      await supabase
        .from('device_bindings')
        .update({ last_seen_at: now })
        .eq('id', existing.id);
      bindingAction = 'reused';
    } else {
      // SV đã liên kết máy khác → từ chối
      await supabase.from('audit_logs').insert({
        actor_id: user.id,
        action: 'mobile_link_denied',
        entity: 'device_binding',
        entity_id: existing.id,
        payload: {
          reason: 'device mismatch',
          expected: existing.device_identifier,
          got: device_id,
        },
      });
      return jsonResponse(
        {
          error:
            'Tài khoản này đã được liên kết với một điện thoại khác. Vui lòng liên hệ Trưởng Lab để reset.',
          code: 'DEVICE_MISMATCH',
        },
        403
      );
    }

    // 4) Đánh dấu token đã dùng
    await supabase
      .from('device_link_tokens')
      .update({ used_at: now })
      .eq('id', link.id);

    // 4b) Đánh dấu desktop binding đã liên kết mobile (vĩnh viễn)
    //     Sau này Desktop sẽ không hiện QR nữa nếu mobile_linked_at != null
    await supabase
      .from('device_bindings')
      .update({ mobile_linked_at: now })
      .eq('user_id', user.id)
      .eq('kind', 'desktop')
      .eq('status', 'active');

    // 5) Tạo access token cho app (dùng admin.generateLink hoặc ký JWT thủ công)
    //    Cách đơn giản & ổn định: tạo magiclink token rồi app dùng verifyOtp.
    const { data: otp, error: otpErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
    });

    if (otpErr || !otp?.properties?.hashed_token) {
      return jsonResponse(
        { error: 'Không thể tạo phiên đăng nhập: ' + (otpErr?.message ?? 'unknown') },
        500
      );
    }

    // 6) Lịch điểm danh hôm nay
    const { data: windows } = await supabase.rpc('get_checkin_windows', {
      for_day_of_week: vietnamDayOfWeek(),
    });

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'mobile_link_success',
      entity: 'user',
      entity_id: user.id,
      payload: { device_id, binding: bindingAction, kiosk_mac: link.kiosk_mac },
    });

    await supabase
      .from('users')
      .update({ last_login_at: now })
      .eq('id', user.id);

    return jsonResponse({
      success: true,
      binding: bindingAction,
      /** App gọi verifyOtp({ token_hash }) để lấy session thật */
      token_hash: otp.properties.hashed_token,
      email: userEmail,
      user: {
        id: user.id,
        mssv: user.mssv,
        full_name: user.full_name,
        khoa: user.khoa,
        role: user.role,
        group_name: groupName,
      },
      device_id,
      today_windows: formatWindows(windows),
    });
  } catch (e) {
    console.error('claim-mobile-binding error:', e);
    return jsonResponse({ error: 'Lỗi hệ thống: ' + (e as Error).message }, 500);
  }
});
