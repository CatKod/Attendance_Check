import { createClient } from '@/lib/supabase/server';
import { ScheduleManager } from '@/components/dashboard/schedule-manager';
import { Clock } from 'lucide-react';

export default async function SchedulePage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  let canEdit = false;
  if (user) {
    const { data: u } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    canEdit = u?.role === 'lab_manager';
  }

  const [schedulesRes, holidaysRes, settingsRes] = await Promise.all([
    supabase
      .from('lab_schedules')
      .select('*')
      .order('day_of_week')
      .order('start_time'),
    supabase
      .from('lab_holidays')
      .select('*')
      .order('holiday_date', { ascending: false }),
    supabase
      .from('lab_settings')
      .select('required_checkins_per_week')
      .limit(1)
      .maybeSingle(),
  ]);

  // Nếu chưa có row lab_settings thì dùng mặc định 3 lần/tuần
  const requiredCheckinsPerWeek = settingsRes.data?.required_checkins_per_week ?? 3;

  const hasError = schedulesRes.error || holidaysRes.error || settingsRes.error;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="apes-section-title flex items-center gap-2 text-2xl">
          <Clock className="h-5 w-5 text-primary" />
          Lịch Lab
        </h2>
        <p className="apes-section-desc">
          Thiết lập khung giờ hoạt động, cửa sổ điểm danh và các ngày nghỉ đặc biệt
        </p>
      </div>

      {hasError && (
        <div className="apes-card border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm font-medium text-destructive">
            Không thể tải lịch Lab
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {schedulesRes.error?.message ??
              holidaysRes.error?.message ??
              settingsRes.error?.message}
          </p>
        </div>
      )}

      <ScheduleManager
        schedules={schedulesRes.data ?? []}
        holidays={holidaysRes.data ?? []}
        requiredCheckinsPerWeek={requiredCheckinsPerWeek}
        canEdit={canEdit}
      />
    </div>
  );
}
