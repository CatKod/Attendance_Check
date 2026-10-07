import { createClient } from '@/lib/supabase/server';
import {
  Settings,
  Building2,
  Timer,
  KeyRound,
  Clock,
  Download,
  Monitor,
  Smartphone,
  Apple,
  Github,
} from 'lucide-react';

export default async function SettingsPage() {
  const supabase = createClient();

  const { data: settings, error } = await supabase
    .from('lab_settings')
    .select('lab_name, late_threshold_minutes, kiosk_pin_hash, updated_at')
    .maybeSingle();

  const items = settings
    ? [
        {
          icon: Building2,
          label: 'Tên phòng lab',
          value: settings.lab_name,
          mono: false,
        },
        {
          icon: Timer,
          label: 'Ngưỡng đi trễ',
          value: `${settings.late_threshold_minutes} phút`,
          mono: false,
        },
        {
          icon: KeyRound,
          label: 'Kiosk PIN',
          value: settings.kiosk_pin_hash
            ? `${settings.kiosk_pin_hash.slice(0, 20)}...`
            : '(chưa thiết lập)',
          mono: true,
        },
        {
          icon: Clock,
          label: 'Cập nhật lần cuối',
          value: new Date(settings.updated_at).toLocaleString('vi-VN'),
          mono: false,
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="apes-section-title flex items-center gap-2 text-2xl">
          <Settings className="h-5 w-5 text-primary" />
          Cài đặt
        </h2>
        <p className="apes-section-desc">
          Thông tin cấu hình phòng thí nghiệm
        </p>
      </div>

      {error && (
        <div className="apes-card border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm font-medium text-destructive">
            Không thể tải cài đặt
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        </div>
      )}

      {!error && !settings && (
        <div className="apes-card flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
            <Settings className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            Chưa có cấu hình
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Chạy migration Supabase để khởi tạo cài đặt mặc định cho phòng thí
            nghiệm.
          </p>
        </div>
      )}

      {settings && (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="apes-card p-5">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {item.label}
                    </p>
                    <p
                      className={`mt-1.5 break-words text-base font-bold text-foreground ${
                        item.mono ? 'font-mono text-sm' : ''
                      }`}
                    >
                      {item.value}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tải ứng dụng */}
      <div>
        <h2 className="apes-section-title flex items-center gap-2 text-2xl">
          <Download className="h-5 w-5 text-primary" />
          Tải ứng dụng
        </h2>
        <p className="apes-section-desc">
          Tải về và cài đặt trên thiết bị cá nhân của bạn
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Desktop */}
        <div className="apes-card p-5">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
              <Monitor className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-foreground">
                APES Lab Desktop
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Dành cho Windows 10/11. Cài đặt trên laptop cá nhân.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                App sẽ tự động cập nhật khi có phiên bản mới.
              </p>
              <a
                href="https://github.com/apes-lab/attendance-check/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-1.5 text-xs font-bold text-white shadow-brand transition-transform hover:scale-105"
              >
                <Download className="h-3 w-3" />
                Tải về (Windows .exe)
              </a>
            </div>
          </div>
        </div>

        {/* Mobile */}
        <div className="apes-card p-5">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-foreground">
                APES Lab Mobile
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Dành cho Android. Quét QR từ Desktop để liên kết.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cài bằng file APK hoặc qua Expo Go (dev).
              </p>
              <a
                href="https://github.com/apes-lab/attendance-check/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-accent"
              >
                <Download className="h-3 w-3" />
                Tải về (Android .apk)
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Github className="h-3.5 w-3.5" />
        <span>
          Mã nguồn:{' '}
          <a
            href="https://github.com/apes-lab/attendance-check"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-foreground hover:underline"
          >
            github.com/apes-lab/attendance-check
          </a>
        </span>
      </div>
    </div>
  );
}