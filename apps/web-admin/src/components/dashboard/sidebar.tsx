'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  Wifi,
  CalendarDays,
  Clock,
  Settings,
  Monitor,
  Download,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_GROUPS = [
  {
    title: 'Quản lý',
    items: [
      { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
      { href: '/dashboard/members', label: 'Thành viên', icon: Users },
      { href: '/dashboard/groups', label: 'Nhóm', icon: Building2 },
      { href: '/dashboard/wifi', label: 'Wi-Fi Lab', icon: Wifi },
      { href: '/dashboard/sessions', label: 'Buổi họp', icon: CalendarDays },
      { href: '/dashboard/schedule', label: 'Lịch Lab', icon: Clock },
      { href: '/dashboard/devices', label: 'Thiết bị', icon: Monitor },
      { href: '/dashboard/downloads', label: 'Tải ứng dụng', icon: Download },
    ],
  },
  {
    title: 'Hệ thống',
    items: [{ href: '/dashboard/settings', label: 'Cài đặt', icon: Settings }],
  },
];

function Brand() {
  return (
    <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-border/60 px-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-gradient shadow-brand">
        <Image
          src="/apes-logo-256.png"
          alt="APES Lab"
          width={28}
          height={28}
          className="h-7 w-7 object-contain"
          priority
        />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[15px] font-bold tracking-tight">APES Lab</p>
        <p className="truncate text-[11px] font-medium text-muted-foreground">
          Hệ thống điểm danh
        </p>
      </div>
    </div>
  );
}

function NavList({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href);

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
      {NAV_GROUPS.map((group) => (
        <div key={group.title} className="mb-1">
          <p className="px-3 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            {group.title}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href as any}
                onClick={onNavigate}
                className={cn('apes-nav-item', active && 'active')}
              >
                <Icon
                  className={cn(
                    'h-[18px] w-[18px] shrink-0',
                    active ? 'text-primary' : ''
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="mt-auto pt-4">
        <div className="rounded-xl bg-brand-gradient p-4 text-white shadow-brand">
          <p className="text-xs font-semibold opacity-90">Wi-Fi Lab</p>
          <p className="mt-1 text-[11px] leading-relaxed opacity-80">
            Kết nối Wi-Fi Lab để bắt đầu điểm danh tự động.
          </p>
          <Link
            href="/dashboard/wifi"
            onClick={onNavigate}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-apes-red transition-transform hover:bg-white active:scale-95"
          >
            <Wifi className="h-3 w-3" />
            Cấu hình
          </Link>
        </div>
      </div>
    </nav>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border/60 bg-card md:flex">
      <Brand />
      <NavList pathname={pathname} />
    </aside>
  );
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm animate-fade-in md:hidden"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border/60 bg-card shadow-brand-lg animate-slide-in-left md:hidden">
        <button
          onClick={onClose}
          className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
          aria-label="Đóng menu"
        >
          <X className="h-4 w-4" />
        </button>
        <Brand />
        <NavList pathname={pathname} onNavigate={onClose} />
      </aside>
    </>
  );
}