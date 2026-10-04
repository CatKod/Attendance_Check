import { createClient } from '@/lib/supabase/server';
import MembersManager from '@/components/dashboard/members-manager';

export default async function MembersPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  let canEdit = false;
  if (user) {
    const { data: u } = await supabase.from('users').select('role').eq('id', user.id).single();
    canEdit = u?.role === 'lab_leader' || u?.role === 'lab_manager';
  }

  const [{ data: users }, { data: groups }] = await Promise.all([
    supabase
      .from('users')
      .select('id, mssv, full_name, email, khoa, group_id, role, groups:group_id(name)')
      .order('role', { ascending: false })
      .order('mssv'),
    supabase.from('groups').select('id, name').order('name'),
  ]);

  return (
    <MembersManager
      members={(users ?? []) as any}
      groups={groups ?? []}
      canEdit={canEdit}
    />
  );
}