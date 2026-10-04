// ============================================================
// APES Lab Kiosk - UI chính
// ============================================================
// Luồng màn hình (F-DESK):
//   1. MỞ      → nhập MSSV  (F-DESK-AUTH-01)
//   2. QR      → sinh QR liên kết Mobile 60s (F-DESK-AUTH-05)
//   3. ĐIỂM DANH → nút lớn "Điểm danh hôm nay" (F-DESK-ATT-01)
//   4. KẾT QUẢ → ✓ tên + giờ, tự về màn 1 sau 5s (F-DESK-KIOSK-05)
//   5. CẤU HÌNH → PIN để quản trị (F-DESK-CFG-02/03/04)
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getCheckinStatus,
  normalizeMssv,
  isValidMssv,
  formatClock,
  formatDateVi,
  type CheckinWindow,
} from '@apes/shared-types';
import type {
  AttendanceResult,
  CheckinWindow as Win,
  KioskBridge,
  NetworkInfo,
  QrResult,
  Student,
} from './types';

declare global {
  interface Window {
    kiosk: KioskBridge;
  }
}

type Screen = 'mssv' | 'qr' | 'home' | 'result' | 'settings' | 'pin';

const ROLE_LABEL: Record<string, string> = {
  student: 'Sinh viên',
  group_leader: 'Trưởng nhóm',
  lab_leader: 'Trưởng Lab',
  lab_manager: 'Chủ nghiệm Lab',
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('mssv');
  const [clock, setClock] = useState(new Date());
  const [net, setNet] = useState<NetworkInfo | null>(null);
  const [labName, setLabName] = useState('APES Lab');

  const [mssv, setMssv] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const [student, setStudent] = useState<Student | null>(null);
  const [windows, setWindows] = useState<Win[]>([]);

  const [qr, setQr] = useState<QrResult | null>(null);
  const [qrSeconds, setQrSeconds] = useState(0);

  const [attending, setAttending] = useState(false);
  const [result, setResult] = useState<AttendanceResult | null>(null);

  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [connOk, setConnOk] = useState<boolean | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const resetTimer = useRef<number | null>(null);

  // ------------------------------------------------------------
  // Khởi tạo: lấy thông tin mạng + cấu hình
  // ------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const [info, cfg] = await Promise.all([
          window.kiosk.getNetworkInfo(),
          window.kiosk.getConfig(),
        ]);
        setNet(info);
        setLabName(cfg.labName);
      } catch (e) {
        console.error('init failed', e);
      }
    })();
  }, []);

  // Đồng hồ realtime (F-DESK-KIOSK-02)
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Focus ô nhập MSSV
  useEffect(() => {
    if (screen === 'mssv') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [screen]);

  // Đếm ngược QR 60s
  useEffect(() => {
    if (screen !== 'qr' || !qr?.expires_at) return;
    const tick = () => {
      const left = Math.max(
        0,
        Math.round((new Date(qr.expires_at!).getTime() - Date.now()) / 1000)
      );
      setQrSeconds(left);
      if (left === 0) {
        // Hết hạn → sinh mã mới
        void regenerateQr();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [screen, qr?.expires_at]);

  // Chặn thoát kiosk
  useEffect(() => {
    window.kiosk.onBeforeQuit(() => {
      setScreen('pin');
    });
  }, []);

  // ------------------------------------------------------------
  // Bước 1: Xác thực MSSV
  // ------------------------------------------------------------
  const submitMssv = useCallback(
    async (value: string) => {
      const code = normalizeMssv(value);
      if (!code) return;

      if (!isValidMssv(code)) {
        setError('MSSV không hợp lệ (cần 8-10 ký tự)');
        setShake(true);
        setTimeout(() => setShake(false), 400);
        return;
      }

      setVerifying(true);
      setError(null);

      try {
        const { data } = await window.kiosk.verifyMssv(code);

        if (!data.success || !data.user) {
          setError(data.error ?? 'Xác thực thất bại');
          setShake(true);
          setTimeout(() => setShake(false), 400);
          setVerifying(false);
          return;
        }

        setStudent(data.user);
        setWindows(data.today_windows ?? []);
        setMssv('');
        setVerifying(false);

        // Sinh QR liên kết Mobile ngay sau khi xác thực (F-DESK-AUTH-05)
        await regenerateQrFor(data.user.id);
      } catch (e) {
        setError((e as Error).message);
        setVerifying(false);
      }
    },
    []
  );

  // ------------------------------------------------------------
  // Bước 2: Sinh QR
  // ------------------------------------------------------------
  const regenerateQrFor = useCallback(async (userId: string) => {
    try {
      const res = await window.kiosk.generateQr(userId);
      if (res.error) {
        setError(res.error);
        setScreen('mssv');
        return;
      }
      setQr(res);
      setScreen('qr');
    } catch (e) {
      setError((e as Error).message);
      setScreen('mssv');
    }
  }, []);

  const regenerateQr = useCallback(async () => {
    if (student) await regenerateQrFor(student.id);
  }, [student, regenerateQrFor]);

  const skipQr = useCallback(() => {
    setScreen('home');
  }, []);

  // ------------------------------------------------------------
  // Bước 3: Điểm danh
  // ------------------------------------------------------------
  const doAttendance = useCallback(async () => {
    if (!student || attending) return;
    setAttending(true);
    setError(null);

    try {
      const { data } = await window.kiosk.checkAttendance(student.id);
      setResult(data);

      if (data.success) {
        await window.kiosk.beep();
        playBeep();
      }
      setScreen('result');

      // Tự về màn nhập MSSV sau 5s (F-DESK-KIOSK-05)
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => {
        setScreen('mssv');
        setStudent(null);
        setQr(null);
        setResult(null);
        setError(null);
      }, 5000);
    } catch (e) {
      setError((e as Error).message);
      setScreen('home');
    } finally {
      setAttending(false);
    }
  }, [student, attending]);

  // ------------------------------------------------------------
  // Bước 4: PIN quản trị
  // ------------------------------------------------------------
  const submitPin = useCallback(async () => {
    const res = await window.kiosk.exitKiosk(pinInput);
    if (res.ok) {
      setPinError(null);
      return; // app sẽ tự đóng
    }
    setPinError(res.error ?? 'Mã PIN không đúng');
    setPinInput('');
  }, [pinInput]);

  const checkConnection = useCallback(async () => {
    const res = await window.kiosk.testConnection();
    setConnOk(res.ok);
  }, []);

  const status = getCheckinStatus(windows as CheckinWindow[], clock);

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  return (
    <div className="flex h-screen flex-col">
      <Header
        labName={labName}
        clock={clock}
        net={net}
        onOpenSettings={() => {
          setScreen('settings');
          void checkConnection();
        }}
      />

      <main className="flex-1 overflow-hidden">
        {screen === 'mssv' && (
          <MssvScreen
            mssv={mssv}
            setMssv={setMssv}
            onSubmit={submitMssv}
            verifying={verifying}
            error={error}
            shake={shake}
            inputRef={inputRef}
            status={status}
          />
        )}

        {screen === 'qr' && student && (
          <QrScreen
            qr={qr}
            seconds={qrSeconds}
            student={student}
            onSkip={skipQr}
            onRegenerate={regenerateQr}
          />
        )}

        {screen === 'home' && student && (
          <HomeScreen
            student={student}
            net={net}
            status={status}
            attending={attending}
            onAttend={doAttendance}
            error={error}
            onNewQr={regenerateQr}
          />
        )}

        {screen === 'result' && student && (
          <ResultScreen
            student={student}
            result={result}
            onDone={() => {
              if (resetTimer.current) window.clearTimeout(resetTimer.current);
              setScreen('mssv');
              setStudent(null);
              setQr(null);
              setResult(null);
            }}
          />
        )}

        {screen === 'settings' && (
          <SettingsScreen
            net={net}
            labName={labName}
            connOk={connOk}
            onBack={() => setScreen('mssv')}
            onRecheck={checkConnection}
          />
        )}

        {screen === 'pin' && (
          <PinScreen
            value={pinInput}
            setValue={(v) => {
              setPinInput(v);
              setPinError(null);
            }}
            error={pinError}
            onSubmit={submitPin}
            onCancel={() => {
              setScreen('mssv');
              setPinInput('');
              setPinError(null);
            }}
          />
        )}
      </main>

      <Footer net={net} labName={labName} />
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function Header({
  labName,
  clock,
  net,
  onOpenSettings,
}: {
  labName: string;
  clock: Date;
  net: NetworkInfo | null;
  onOpenSettings: () => void;
}) {
  const time = clock.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const day = clock.toLocaleDateString('vi-VN', { weekday: 'long' });
  const date = clock.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f04030] text-sm font-bold text-white">
          A
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{labName}</p>
          <p className="text-[11px] text-slate-500">Điểm danh sinh viên</p>
        </div>
      </div>

      <div className="text-center">
        <p className="font-mono text-2xl font-bold tabular-nums text-slate-900">
          {time}
        </p>
        <p className="text-[11px] capitalize text-slate-500">
          {day}, {date}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p
            className={`text-xs font-semibold ${net?.ip ? 'text-emerald-600' : 'text-red-500'}`}
          >
            {net?.ip ? '● Đã kết nối' : '○ Mất mạng'}
          </p>
          <p className="font-mono text-[10px] text-slate-400">
            {net?.ip ?? '—'}
          </p>
        </div>
        <button
          onClick={onOpenSettings}
          className="rounded-lg border border-slate-200 p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
          title="Cấu hình"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.6.77 1 1.4 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </header>
  );
}

function MssvScreen({
  mssv,
  setMssv,
  onSubmit,
  verifying,
  error,
  shake,
  inputRef,
  status,
}: {
  mssv: string;
  setMssv: (v: string) => void;
  onSubmit: (v: string) => void;
  verifying: boolean;
  error: string | null;
  shake: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  status: ReturnType<typeof getCheckinStatus>;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-3xl font-bold text-slate-900">
          Nhập MSSV để bắt đầu
        </h1>
        <p className="mt-2 text-slate-500">
          Nhập mã số sinh viên của bạn để xác thực và điểm danh
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(mssv);
          }}
          className="mt-8"
        >
          <input
            ref={inputRef}
            value={mssv}
            onChange={(e) => setMssv(e.target.value.toUpperCase())}
            placeholder="VD: 20232276"
            disabled={verifying}
            autoComplete="off"
            className={`w-full rounded-2xl border-2 border-slate-200 bg-white px-6 py-5 text-center font-mono text-4xl font-bold tracking-widest text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-[#f04030] focus:ring-4 focus:ring-[#f04030]/10 disabled:opacity-50 ${
              shake ? 'animate-shake border-red-400' : ''
            }`}
          />

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={verifying || !mssv}
            className="mt-5 w-full rounded-2xl bg-[#f04030] px-6 py-4 text-lg font-bold text-white shadow-lg shadow-[#f04030]/25 transition-all hover:bg-[#d63324] disabled:opacity-40"
          >
            {verifying ? 'Đang xác thực...' : 'Tiếp tục'}
          </button>
        </form>

        <TodayStatus status={status} />
      </div>
    </div>
  );
}

function TodayStatus({ status }: { status: ReturnType<typeof getCheckinStatus> }) {
  const tone =
    status.state === 'open'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status.state === 'upcoming'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-slate-50 text-slate-600 border-slate-200';

  return (
    <div className={`mt-8 rounded-xl border px-5 py-3 ${tone}`}>
      <p className="text-sm font-semibold">{status.message}</p>
      {status.all.length > 0 && (
        <p className="mt-1 text-xs opacity-80">
          {status.all.map((w) => w.label).join(' · ')}
        </p>
      )}
    </div>
  );
}

function QrScreen({
  qr,
  seconds,
  student,
  onSkip,
  onRegenerate,
}: {
  qr: QrResult | null;
  seconds: number;
  student: Student;
  onSkip: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <path d="M14 14h3v3h-3zM19 19h2v2h-2z" />
          </svg>
        </div>

        <h1 className="mt-4 text-2xl font-bold text-slate-900">
          Quét mã để liên kết điện thoại
        </h1>
        <p className="mt-1 text-slate-500">
          Chào <span className="font-semibold text-slate-800">{student.full_name}</span> ({student.mssv})
        </p>

        <div className="mt-6 flex justify-center">
          {qr?.qr_data_url ? (
            <img
              src={qr.qr_data_url}
              alt="QR liên kết"
              className="h-64 w-64 rounded-2xl border-4 border-slate-100 bg-white p-2 shadow-lg"
            />
          ) : (
            <div className="flex h-64 w-64 items-center justify-center rounded-2xl border-4 border-slate-100 bg-white">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#f04030]" />
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-center gap-2">
          <span
            className={`font-mono text-2xl font-bold tabular-nums ${
              seconds <= 10 ? 'text-red-500' : 'text-slate-700'
            }`}
          >
            {seconds}s
          </span>
          <span className="text-sm text-slate-400">để quét</span>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Mở app APES Lab trên điện thoại và quét mã này để liên kết
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={onRegenerate}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Tạo mã mới
          </button>
          <button
            onClick={onSkip}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            Bỏ qua, điểm danh ngay
          </button>
        </div>
      </div>
    </div>
  );
}

function HomeScreen({
  student,
  net,
  status,
  attending,
  onAttend,
  error,
  onNewQr,
}: {
  student: Student;
  net: NetworkInfo | null;
  status: ReturnType<typeof getCheckinStatus>;
  attending: boolean;
  onAttend: () => void;
  error: string | null;
  onNewQr: () => void;
}) {
  const canAttend = status.state === 'open';

  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-2xl font-bold text-slate-600">
          {student.full_name.charAt(0)}
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">
          {student.full_name}
        </h1>
        <p className="mt-1 text-slate-500">
          {student.mssv} · {student.khoa}
          {student.group_name ? ` · ${student.group_name}` : ''}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          {ROLE_LABEL[student.role] ?? student.role}
        </p>

        {canAttend ? (
          <button
            onClick={onAttend}
            disabled={attending}
            className="animate-pulse-ring mt-8 w-full rounded-3xl bg-emerald-500 px-8 py-8 text-2xl font-bold text-white shadow-2xl shadow-emerald-500/30 transition-all hover:bg-emerald-600 disabled:opacity-50"
          >
            {attending ? 'Đang ghi nhận...' : 'ĐIỂM DANH HÔM NAY'}
          </button>
        ) : (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5">
            <p className="text-sm font-semibold text-slate-700">
              {status.message}
            </p>
            {status.all.length > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                Hôm nay mở điểm danh: {status.all.map((w) => w.label).join(' · ')}
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-slate-400">
          <span className="font-mono">IP: {net?.ip ?? '—'}</span>
          <span className="font-mono">MAC: {net?.mac ?? '—'}</span>
        </div>

        <button
          onClick={onNewQr}
          className="mt-4 text-xs font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
        >
          Hiện lại mã QR liên kết điện thoại
        </button>
      </div>
    </div>
  );
}

function ResultScreen({
  student,
  result,
  onDone,
}: {
  student: Student;
  result: AttendanceResult | null;
  onDone: () => void;
}) {
  const ok = result?.success;
  const already = result?.already_attended;

  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className="w-full max-w-lg text-center">
        <div
          className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full ${
            ok || already
              ? 'bg-emerald-100 text-emerald-600'
              : 'bg-red-100 text-red-600'
          }`}
        >
          {ok || already ? (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          )}
        </div>

        <h1 className="mt-6 text-3xl font-bold text-slate-900">
          {ok
            ? 'Điểm danh thành công!'
            : already
              ? 'Đã điểm danh hôm nay'
              : 'Điểm danh thất bại'}
        </h1>

        {ok && (
          <>
            <p className="mt-2 text-lg font-semibold text-slate-700">
              {student.full_name}
            </p>
            <p className="font-mono text-3xl font-bold tabular-nums text-emerald-600">
              {result?.time}
            </p>
            {result?.wifi_ssid && (
              <p className="mt-1 text-xs text-slate-400">
                Wi-Fi: {result.wifi_ssid}
              </p>
            )}
          </>
        )}

        {already && (
          <p className="mt-2 text-slate-600">{result?.warning}</p>
        )}

        {!ok && !already && (
          <div className="mt-4 rounded-xl bg-red-50 px-5 py-3">
            <p className="text-sm font-medium text-red-700">{result?.error}</p>
            {result?.today_windows && result.today_windows.length > 0 && (
              <p className="mt-1 text-xs text-red-600">
                Hôm nay điểm danh:{' '}
                {result.today_windows.map((w) => w.label).join(' · ')}
              </p>
            )}
          </div>
        )}

        <p className="mt-6 text-xs text-slate-400">
          Tự động quay về màn hình nhập MSSV sau 5 giây
        </p>
        <button
          onClick={onDone}
          className="mt-4 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          Xong ngay
        </button>
      </div>
    </div>
  );
}

function SettingsScreen({
  net,
  labName,
  connOk,
  onBack,
  onRecheck,
}: {
  net: NetworkInfo | null;
  labName: string;
  connOk: boolean | null;
  onBack: () => void;
  onRecheck: () => void;
}) {
  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-900">Cấu hình kiosk</h1>
        <p className="mt-1 text-slate-500">Thông tin máy và kết nối</p>

        <div className="mt-6 space-y-4">
          <Card title="Thông tin phòng Lab">
            <Row label="Tên Lab" value={labName} />
            <Row
              label="Kết nối Supabase"
              value={
                connOk === null
                  ? 'Đang kiểm tra...'
                  : connOk
                    ? '✓ Thành công'
                    : '✗ Thất bại'
              }
              tone={connOk === null ? 'default' : connOk ? 'success' : 'danger'}
            />
            <button
              onClick={onRecheck}
              className="mt-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Kiểm tra lại
            </button>
          </Card>

          <Card title="Định danh máy (F-DESK-CFG-03)">
            <Row label="IP hiện tại" value={net?.ip ?? 'Không có'} mono />
            <Row label="MAC address" value={net?.mac ?? 'Không có'} mono />
            <Row label="Card mạng" value={net?.interface ?? '—'} mono />
            {net?.allIps && net.allIps.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Tất cả interface
                </p>
                <ul className="mt-1 space-y-0.5 font-mono text-xs text-slate-500">
                  {net.allIps.map((ip) => (
                    <li key={ip}>{ip}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card title="Thoát kiosk">
            <p className="text-sm text-slate-500">
              Dùng mã PIN 4-8 chữ số. Liên hệ Trưởng Lab nếu quên mã.
            </p>
            <p className="mt-2 font-mono text-xs text-slate-400">
              Đặt mặc định qua biến môi trường KIOSK_PIN
            </p>
          </Card>
        </div>

        <button
          onClick={onBack}
          className="mt-6 rounded-xl bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800"
        >
          Quay lại
        </button>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  tone = 'default',
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: 'default' | 'success' | 'danger';
}) {
  const color =
    tone === 'success'
      ? 'text-emerald-600'
      : tone === 'danger'
        ? 'text-red-600'
        : 'text-slate-700';
  return (
    <div className="flex items-center justify-between border-b border-slate-50 py-1.5 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-medium ${color} ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function PinScreen({
  value,
  setValue,
  error,
  onSubmit,
  onCancel,
}: {
  value: string;
  setValue: (v: string) => void;
  error: string | null;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-slate-900">Thoát chế độ kiosk</h1>
        <p className="mt-1 text-sm text-slate-500">Nhập mã PIN quản trị</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="mt-6"
        >
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            maxLength={8}
            className="w-full rounded-2xl border-2 border-slate-200 px-6 py-4 text-center font-mono text-3xl tracking-[0.5em] text-slate-900 outline-none focus:border-[#f04030] focus:ring-4 focus:ring-[#f04030]/10"
          />
          {error && (
            <p className="mt-2 text-sm font-medium text-red-600">{error}</p>
          )}
          <button
            type="submit"
            className="mt-4 w-full rounded-2xl bg-slate-900 px-6 py-3.5 text-base font-bold text-white hover:bg-slate-800"
          >
            Xác nhận
          </button>
        </form>

        <button
          onClick={onCancel}
          className="mt-3 text-sm text-slate-400 hover:text-slate-600"
        >
          Quay lại
        </button>
      </div>
    </div>
  );
}

function Footer({ net, labName }: { net: NetworkInfo | null; labName: string }) {
  return (
    <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-2 text-[11px] text-slate-400">
      <span>{labName} Kiosk v0.1</span>
      <span className="font-mono">
        {net?.mac ? `MAC ${net.mac}` : 'MAC —'}
      </span>
    </footer>
  );
}

/** Tiếng beep bằng Web Audio API (F-DESK-ATT-04) */
function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    setTimeout(() => ctx.close(), 500);
  } catch {
    /* im lặng nếu không phát được âm thanh */
  }
}

export { formatClock, formatDateVi };
