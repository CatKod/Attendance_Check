import { createClient } from '@/lib/supabase/server';
import { Download, Monitor, Smartphone, ShieldCheck } from 'lucide-react';

export default async function DownloadsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null; // layout sẽ redirect về login
  }

  // Lấy thông tin version từ package.json
  // (trong thực tế có thể gọi GitHub API để lấy release mới nhất)
  // Tạm thời hard-code
  const DESKTOP_VERSION = '0.2.0';
  const DESKTOP_FILENAME = `APES-Lab-Setup-${DESKTOP_VERSION}.exe`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tải ứng dụng</h1>
        <p className="mt-1 text-slate-500">
          Cài đặt Desktop và Mobile App để điểm danh tự động
        </p>
      </div>

      {/* Desktop */}
      <div className="apes-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Monitor className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-900">
              APES Lab Desktop v{DESKTOP_VERSION}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Cài trên laptop cá nhân. Mỗi sinh viên chỉ đăng nhập được trên 1 máy
              (đã liên kết MAC). Tự động cập nhật khi có bản mới.
            </p>

            <ul className="mt-3 space-y-1 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Yêu cầu Windows 10/11 (64-bit)
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                File: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{DESKTOP_FILENAME}</code>
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Dung lượng: ~150 MB
              </li>
            </ul>

            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={`/downloads/${DESKTOP_FILENAME}`}
                download
                className="inline-flex items-center gap-2 rounded-xl bg-[#f04030] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#f04030]/25 transition-all hover:bg-[#d63324]"
              >
                <Download className="h-4 w-4" />
                Tải xuống Desktop ({DESKTOP_VERSION})
              </a>
              <a
                href={`https://github.com/apes-lab/attendance-check/releases/tag/v${DESKTOP_VERSION}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Xem lịch sử phiên bản
              </a>
            </div>

            <details className="mt-5 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <summary className="cursor-pointer font-semibold">
                Hướng dẫn cài đặt chi tiết
              </summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Tải file <code className="font-mono">{DESKTOP_FILENAME}</code></li>
                <li>Chạy file vừa tải, chọn thư mục cài đặt</li>
                <li>Mở app "APES Lab" từ Start Menu hoặc Desktop shortcut</li>
                <li>Nhập MSSV lần đầu → app tự động liên kết máy và sinh QR cho điện thoại</li>
                <li>Quét QR bằng Mobile App để liên kết điện thoại</li>
                <li>Từ lần sau: mở app là vào thẳng màn điểm danh</li>
              </ol>
              <p className="mt-2 text-amber-700">
                ⚠ Mỗi MSSV chỉ liên kết được 1 máy tính. Nếu muốn đổi máy, liên hệ Trưởng Lab để reset.
              </p>
            </details>
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div className="apes-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Smartphone className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-900">
              APES Lab Mobile (Android)
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Cài trên điện thoại Android. Mỗi sinh viên chỉ liên kết được 1 điện thoại.
            </p>

            <ul className="mt-3 space-y-1 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-500" />
                Yêu cầu Android 8.0 trở lên
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-500" />
                Cài qua file APK
              </li>
            </ul>

            <div className="mt-5">
              <a
                href="/downloads/app-release.apk"
                download
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700"
              >
                <Download className="h-4 w-4" />
                Tải xuống APK
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
