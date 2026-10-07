import { createClient } from '@/lib/supabase/server';
import DevicesManager from '@/components/dashboard/devices-manager';

export default async function DevicesPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  let canEdit = false;
  if (user) {
    const { data: u } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    canEdit = u?.role === 'lab_leader' || u?.role === 'lab_manager';
  }

  // Lấy danh sách user kèm thông tin binding qua view
  const { data: members } = await supabase
    .from('v_member_bindings')
    .select(
      'user_id, mssv, full_name, role, khoa, group_name, has_desktop, has_mobile, desktop_mac, desktop_hostname, desktop_bound_at, mobile_bound_at'
    )
    .order('role', { ascending: false })
    .order('mssv');

  return (
    <DevicesManager
      members={(members ?? []).map((m: any) => ({
        id: m.user_id,
        mssv: m.mssv,
        full_name: m.full_name,
        role: m.role,
        khoa: m.khoa,
        group_name: m.group_name,
        has_desktop: m.has_desktop,
        has_mobile: m.has_mobile,
        desktop_mac: m.desktop_mac,
        desktop_hostname: m.desktop_hostname,
        desktop_bound_at: m.desktop_bound_at,
        mobile_bound_at: m.mobile_bound_at,
      }))}
      canEdit={canEdit}
    />
  );
}
