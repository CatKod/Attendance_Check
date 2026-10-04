import { createClient } from '@/lib/supabase/server';
import GroupsManager from '@/components/dashboard/groups-manager';

export default async function GroupsPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  let canEdit = false;
  if (user) {
    const { data: u } = await supabase.from('users').select('role').eq('id', user.id).single();
    canEdit = u?.role === 'lab_leader' || u?.role === 'lab_manager';
  }

  const [{ data: groups }, { data: members }] = await Promise.all([
    supabase
      .from('groups')
      .select('id, name, description, leader_id, users:leader_id(mssv, full_name)')
      .order('name'),
    supabase
      .from('users')
      .select('id, mssv, full_name')
      .in('role', ['group_leader', 'lab_leader', 'lab_manager'])
      .order('full_name'),
  ]);

  return (
    <GroupsManager
      groups={(groups ?? []) as any}
      members={members ?? []}
      canEdit={canEdit}
    />
  );
}