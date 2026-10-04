// ============================================================
// Deno Edge Function: generate-link-qr
// Sinh QR liên kết Mobile sau khi Desktop xác thực MSSV (F-DESK-AUTH-05, F-DESK-KIOSK-07)
//
// Token sống 60 giây, dùng 1 lần. Desktop hiển thị QR, Mobile quét rồi
// gọi claim-mobile-binding với token này.
//
// Deploy: supabase functions deploy generate-link-qr
// ============================================================

import { jsonResponse, preflight } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase.ts';

interface Body {
  user_id: string;
  kiosk_mac?: string;
  /** TTL tính bằng giây, mặc định 60 (không cho vượt quá 120) */
  ttl_seconds?: number;
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const { user_id, kiosk_mac, ttl_seconds } = (await req.json()) as Body;

    if (!user_id) {
      return jsonResponse({ error: 'Thiếu user_id' }, 400);
    }

    const ttl = Math.min(Math.max(ttl_seconds ?? 60, 15), 120);
    const supabase = adminClient();

    // Xác nhận user tồn tại
    const { data: user } = await supabase
      .from('users')
      .select('id, mssv, full_name')
      .eq('id', user_id)
      .single();

    if (!user) {
      return jsonResponse({ error: 'Không tìm thấy sinh viên' }, 404);
    }

    // Dọn token cũ đã hết hạn / đã dùng
    await supabase.rpc('cleanup_expired_link_tokens');

    // Vô hiệu hoá các token chưa dùng của user này (chỉ giữ 1 QR tại 1 thời điểm)
    await supabase
      .from('device_link_tokens')
      .update({ expires_at: new Date().toISOString() })
      .eq('user_id', user_id)
      .is('used_at', null);

    const token = randomToken();
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    const { error } = await supabase.from('device_link_tokens').insert({
      token,
      user_id,
      kiosk_mac: kiosk_mac ?? null,
      expires_at: expiresAt,
    });

    if (error) {
      return jsonResponse({ error: 'Không thể tạo token: ' + error.message }, 500);
    }

    // Payload nhúng vào QR — Mobile parse được
    // Dùng scheme apes:// để mở app tự động nếu đã cài, fallback copy/paste
    const payload = JSON.stringify({
      v: 1,
      t: token,
      u: user_id,
      m: user.mssv,
      n: user.full_name,
      e: expiresAt,
    });

    return jsonResponse({
      success: true,
      token,
      payload,
      /** URI để render QR — app mobile tự parse */
      qr_uri: `apes://link?d=${encodeURIComponent(payload)}`,
      expires_at: expiresAt,
      ttl_seconds: ttl,
      student: { mssv: user.mssv, full_name: user.full_name },
    });
  } catch (e) {
    console.error('generate-link-qr error:', e);
    return jsonResponse({ error: 'Lỗi hệ thống: ' + (e as Error).message }, 500);
  }
});
