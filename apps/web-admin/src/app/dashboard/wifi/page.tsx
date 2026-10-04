import { createClient } from '@/lib/supabase/server';
import WifiManager from '@/components/dashboard/wifi-manager';

export default async function WifiPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  let canEdit = false;
  if (user) {
    const { data: u } = await supabase.from('users').select('role').eq('id', user.id).single();
    canEdit = u?.role === 'lab_leader' || u?.role === 'lab_manager';
  }

  const [{ data: networks }, { data: locations }] = await Promise.all([
    supabase
      .from('wifi_networks')
      .select('id, ssid, subnet, gateway, bssid, is_primary, is_active, location_id, locations:location_id(name)'),
    supabase.from('locations').select('id, name, is_active').order('name'),
  ]);

  return (
    <WifiManager
      networks={(networks ?? []) as any}
      locations={locations ?? []}
      canEdit={canEdit}
    />
  );
}