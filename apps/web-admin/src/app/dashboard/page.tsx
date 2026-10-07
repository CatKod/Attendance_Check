import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  ArrowUpRight,
  Wifi,
  CalendarDays,
  Sparkles,
  Building2,
  Monitor,
  Smartphone,
} from 'lucide-react';

export default async function DashboardPage() {
  const supabase = createClient();
  const today = new Date();

  const [
    { count: totalMembers },
    { count: presentToday },
    { data: bindingCounts },
  ] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .gte('check_in_time', `${new Date().toISOString().split('T')[0]}T00:00:00`)
      .lte('check_in_time', `${new Date().toISOString().split('T')[0]}T23:59:59`),
    supabase.rpc('count_active_bindings'),
  ]);

  const desktopActive =
    bindingCounts?.find((b: any) => b.kind === 'desktop')?.active_count ?? 0;
  const mobileActive =
    bindingCounts?.find((b: any) => b.kind === 'mobile')?.active_count ?? 0;

  const total = totalMembers || 0;
  const present = presentToday || 0;
  const absent = Math.max(0, total - present);
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  const stats = [
    {
      label: 'Tổng thành viên',
      value: total,
      icon: Users,
      tone: 'brand' as const,
      hint: 'Đã đăng ký vào Lab',
    },
    {
      label: 'Có mặt hôm nay',
      value: present,
      icon: UserCheck,
      tone: 'success' as const,
      hint: `${rate}% tổng thành viên`,
    },
    {
      label: 'Vắng hôm nay',
      value: absent,
      icon: UserX,
      tone: 'destructive' as const,
      hint: 'Chưa điểm danh',
    },
    {
      label: 'Laptop liên kết',
      value: desktopActive,
      icon: Monitor,
      tone: 'brand' as const,
      hint: `${total > 0 ? Math.round((Number(desktopActive) / total) * 100) : 0}% thành viên`,
    },
    {
      label: 'Mobile liên kết',
      value: mobileActive,
      icon: Smartphone,
      tone: 'success' as const,
      hint: 'Sẵn sàng điểm danh qua Wi-Fi',
    },
    {
      label: 'Buổi họp',
      value: 0,
      icon: CalendarDays,
      tone: 'warning' as const,
      hint: 'Sắp diễn ra hôm nay',
    },
  ];

  const toneStyles = {
    brand: {
      card: '',
      icon: 'bg-brand-gradient text-white shadow-brand',
      bar: 'bg-brand-gradient',
      text: 'text-foreground',
    },
    success: {
      card: '',
      icon: 'bg-success/10 text-success',
      bar: 'bg-success',
      text: 'text-foreground',
    },
    destructive: {
      card: '',
      icon: 'bg-destructive/10 text-destructive',
      bar: 'bg-destructive',
      text: 'text-foreground',
    },
    warning: {
      card: '',
      icon: 'bg-warning/10 text-warning',
      bar: 'bg-warning',
      text: 'text-foreground',
    },
  };

  const quickActions = [
    {
      href: '/dashboard/wifi',
      label: 'Cấu hình Wi-Fi',
      desc: 'Điểm danh tự động',
      icon: Wifi,
    },
    {
      href: '/dashboard/members',
      label: 'Quản lý thiết bị',
      desc: 'Reset binding của SV',
      icon: Monitor,
    },
    {
      href: '/dashboard/sessions',
      label: 'Tạo buổi họp',
      desc: 'Bắt đầu phiên điểm danh',
      icon: CalendarDays,
    },
    {
      href: '/dashboard/groups',
      label: 'Quản lý nhóm',
      desc: 'Phân nhóm thành viên',
      icon: Building2,
    },
  ];

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-brand-subtle p-6 shadow-sm sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, hsl(var(--primary) / 0.18) 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <span className="apes-badge bg-accent text-accent-foreground">
              <Sparkles className="h-3 w-3" />
              Hôm nay
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Tổng quan điểm danh
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {today.toLocaleDateString('vi-VN', {
                weekday: 'long',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </p>
          </div>

          {/* Attendance rate ring */}
          <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-card/80 p-4 backdrop-blur-sm">
            <div className="relative h-16 w-16 shrink-0">
              <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  className="text-muted"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={`${(rate / 100) * 97.4} 97.4`}
                  className="text-primary"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-foreground">{rate}%</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">Tỷ lệ có mặt</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                {present}/{total} thành viên đã điểm danh
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const t = toneStyles[stat.tone];
          let barWidth = '0%';
          if (stat.tone === 'brand' && stat.label === 'Tổng thành viên') {
            barWidth = '100%';
          } else if (total > 0) {
            barWidth = Math.min(100, (Number(stat.value) / total) * 100) + '%';
          }
          return (
            <div key={stat.label} className="apes-stat-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
                    {stat.value}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {stat.hint}
                  </p>
                </div>
                <div className={`shrink-0 rounded-xl p-2.5 ${t.icon}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${t.bar}`}
                  style={{ width: barWidth }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <section className="space-y-0">
        <h3 className="apes-section-title">Thao tác nhanh</h3>
        <p className="apes-section-desc">Các chức năng thường dùng</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href as any}
                className="apes-card group flex items-center gap-3.5 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary transition-colors group-hover:bg-brand-gradient group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {action.label}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {action.desc}
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* Help banner */}
      <section className="apes-card flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="min-w-0">
          <h3 className="apes-section-title">Bắt đầu sử dụng APES Lab</h3>
          <p className="apes-section-desc">
            Cấu hình Wi-Fi Lab và thêm thành viên để hệ thống tự động điểm danh.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/dashboard/wifi"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-gradient px-4 text-sm font-semibold text-white shadow-brand transition-all hover:brightness-95 active:scale-[0.98]"
          >
            <Wifi className="h-4 w-4" />
            Cấu hình Wi-Fi
          </Link>
        </div>
      </section>
    </div>
  );
}