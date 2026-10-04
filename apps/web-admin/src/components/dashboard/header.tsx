'use client';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { LogOut, Menu, Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  user: {
    email?: string;
  };
  onOpenSidebar?: () => void;
}

export function Header({ user, onOpenSidebar }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const initial = (user.email ?? 'A').charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border/60 bg-card/80 px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onOpenSidebar}
          aria-label="Mở menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Quản trị APES Lab
          </h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            Hệ thống quản lý điểm danh
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <Button variant="ghost" size="icon" aria-label="Thông báo" className="hidden sm:inline-flex">
          <Bell className="h-[18px] w-[18px]" />
        </Button>

        <div className="flex items-center gap-2.5 rounded-full border border-border/60 bg-background py-1 pl-1 pr-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-[11px] font-bold text-white">
            {initial}
          </div>
          <span className="hidden max-w-[160px] truncate text-xs font-medium text-foreground md:block">
            {user.email}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="mr-1.5 h-3.5 w-3.5" />
          <span className="hidden sm:inline">Đăng xuất</span>
        </Button>
      </div>
    </header>
  );
}