import { createClient } from '@/lib/supabase/server';
import { CalendarDays, Radio, CheckCircle2, Clock, Users } from 'lucide-react';

export default async function SessionsPage() {
  const supabase = createClient();

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select(
      'id, title, start_time, end_time, status, groups:group_id(name), locations:location_id(name)'
    )
    .order('start_time', { ascending: false })
    .limit(50);

  const openCount = sessions?.filter((s) => s.status === 'open').length ?? 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="apes-section-title flex items-center gap-2 text-2xl">
            <CalendarDays className="h-5 w-5 text-primary" />
            Buổi họp
          </h2>
          <p className="apes-section-desc">
            {sessions?.length ?? 0} buổi họp gần đây
            {openCount > 0 && (
              <>
                {' · '}
                <span className="font-semibold text-success">
                  {openCount} đang mở
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Empty / error */}
      {error ? (
        <div className="apes-card border-destructive/30 bg-destructive/5 px-6 py-14 text-center">
          <p className="text-sm font-medium text-destructive">
            Không thể tải danh sách buổi họp
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <div className="apes-card flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
            <CalendarDays className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            Chưa có buổi họp
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Các buổi họp sẽ hiển thị tại đây khi được tạo.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="apes-card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="apes-table">
                <thead>
                  <tr>
                    <th>Tiêu đề</th>
                    <th>Bắt đầu</th>
                    <th>Kết thúc</th>
                    <th>Nhóm</th>
                    <th>Cơ sở</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="font-semibold text-foreground">{s.title}</td>
                      <td className="whitespace-nowrap text-muted-foreground">
                        {new Date(s.start_time).toLocaleString('vi-VN')}
                      </td>
                      <td className="whitespace-nowrap text-muted-foreground">
                        {s.end_time
                          ? new Date(s.end_time).toLocaleString('vi-VN')
                          : '—'}
                      </td>
                      <td>{(s as any).groups?.name ?? '—'}</td>
                      <td>{(s as any).locations?.name ?? '—'}</td>
                      <td>
                        {s.status === 'open' ? (
                          <span className="apes-badge bg-success/10 text-success">
                            <Radio className="h-3 w-3" />
                            Đang mở
                          </span>
                        ) : (
                          <span className="apes-badge bg-muted text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3" />
                            Đã đóng
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {sessions.map((s) => (
              <div key={s.id} className="apes-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 font-semibold text-foreground">
                    {s.title}
                  </p>
                  {s.status === 'open' ? (
                    <span className="apes-badge shrink-0 bg-success/10 text-success">
                      Mở
                    </span>
                  ) : (
                    <span className="apes-badge shrink-0 bg-muted text-muted-foreground">
                      Đóng
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(s.start_time).toLocaleString('vi-VN')}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {(s as any).groups?.name ?? 'Chưa có nhóm'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}