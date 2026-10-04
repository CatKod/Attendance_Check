import { LoginForm } from '@/components/auth/login-form';
import Image from 'next/image';
import { ShieldCheck, Wifi, Users, Zap } from 'lucide-react';

const features = [
  {
    icon: Wifi,
    title: 'Điểm danh tự động',
    desc: 'Kết nối Wi-Fi Lab là tự động ghi nhận',
  },
  {
    icon: Users,
    title: 'Quản lý thành viên',
    desc: 'Nhóm, khóa, vai trò rõ ràng',
  },
  {
    icon: Zap,
    title: 'Thống kê tức thì',
    desc: 'Tỷ lệ có mặt theo thời gian thực',
  },
];

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Left: brand panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-brand-gradient lg:flex lg:flex-col lg:justify-between">
        {/* Decorative pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, #fff 1.5px, transparent 0)',
            backgroundSize: '26px 26px',
          }}
        />
        {/* Soft glows */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-black/10 blur-3xl" />

        <div className="relative p-12">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/95 shadow-lg">
              <Image
                src="/apes-logo-256.png"
                alt="APES Lab"
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
                priority
              />
            </div>
            <div className="leading-tight">
              <p className="text-xl font-bold text-white">APES Lab</p>
              <p className="text-sm text-white/75">Antenna &amp; Propagation</p>
            </div>
          </div>

          <h1 className="mt-16 max-w-md text-4xl font-bold leading-tight tracking-tight text-white">
            Hệ thống quản lý điểm danh
            <span className="block text-white/80">cho phòng thí nghiệm</span>
          </h1>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/80">
            Giải pháp toàn diện cho việc theo dõi thành viên, buổi họp và lịch
            hoạt động của Lab.
          </p>

          <div className="mt-12 space-y-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{f.title}</p>
                    <p className="text-[13px] text-white/70">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative p-12">
          <p className="text-xs text-white/60">
            © 2026 APES Lab. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex w-full items-center justify-center px-4 py-12 sm:px-8 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient shadow-brand-lg">
              <Image
                src="/apes-logo-256.png"
                alt="APES Lab"
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
                priority
              />
            </div>
            <p className="text-lg font-bold tracking-tight">APES Lab</p>
          </div>

          <div className="apes-card p-7 sm:p-8">
            <LoginForm />
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Truy cập dành cho Trưởng Lab &amp; Chủ nhiệm Lab
          </p>
        </div>
      </div>
    </div>
  );
}