'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type DeviceBinding = {
  binding_id: string;
  kind: string;
  device_identifier: string;
  status: string;
  bound_at: string;
  last_seen_at: string | null;
  mobile_linked_at: string | null;
  hostname: string | null;
  os_info: string | null;
  disk_serial: string | null;
  note: string | null;
};

async function assertLeader() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Chưa đăng nhập');
  const { data: u } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!u || !['lab_leader', 'lab_manager'].includes(u.role)) {
    throw new Error('Không có quyền');
  }
  return supabase;
}

/**
 * Lấy danh sách thiết bị đã liên kết của 1 user.
 * Trả về qua RPC get_member_devices().
 */
export async function getMemberDevices(userId: string): Promise<DeviceBinding[]> {
  const supabase = await assertLeader();
  const { data, error } = await supabase.rpc('get_member_devices', {
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as DeviceBinding[];
}

/**
 * Reset 1 device binding. Sau khi reset:
 *  - status = 'reset'
 *  - SV có thể đăng nhập lại trên máy khác
 *  - Audit log được lưu với lý do
 */
export async function resetDeviceBinding(
  bindingId: string,
  reason: string
): Promise<{ ok: boolean }> {
  const supabase = await assertLeader();
  if (!bindingId) throw new Error('Thiếu bindingId');
  if (!reason || reason.trim().length < 3) {
    throw new Error('Vui lòng nhập lý do reset (tối thiểu 3 ký tự)');
  }

  const { error } = await supabase.rpc('reset_device_binding', {
    p_binding_id: bindingId,
    p_reason: reason.trim(),
  });
  if (error) throw new Error(error.message);

  revalidatePath('/dashboard/devices');
  revalidatePath('/dashboard/members');
  return { ok: true };
}
