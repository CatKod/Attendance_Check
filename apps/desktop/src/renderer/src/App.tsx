// ============================================================
// APES Lab - Personal App UI
// ============================================================
// Luồng màn hình (PHẦN MỚI - App cá nhân cố định theo SV):
//   1. LOADING    → đọc session từ Registry, kiểm tra MAC
//   2. MSSV       → nhập MSSV (lần đầu, hoặc khi session không hợp lệ)
//   3. QR         → sinh QR liên kết Mobile (chỉ hiện khi mobile chưa link)
//   4. HOME       → màn chính sau khi đăng nhập
//   5. RESULT     → kết quả điểm danh (5s → về HOME, không reset)
//
// Điểm khác biệt so với bản kiosk cũ:
//   - KHÔNG tự reset về màn MSSV sau điểm danh → ở lại HOME
//   - KHÔNG có nút đăng xuất: 1 máy chỉ liên kết 1 MSSV vĩnh viễn.
//     SV muốn đổi máy phải nhờ Trưởng Lab reset binding trên Supabase.
//   - Tự động đăng nhập nếu session hợp lệ (cùng MAC)
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
  LockState,
  NetworkAtLabResult,
  NetworkInfo,
  PersistentSession,
  QrResult,
  Student,
  UpdateStatus,
} from './types';

declare global {
  interface Window {
    kiosk: KioskBridge;
  }
}

type Screen = 'loading' | 'mssv' | 'qr' | 'home' | 'result' | 'settings' | 'locked';

const ROLE_LABEL: Record<string, string> = {
  student: 'Sinh viên',
  group_leader: 'Trưởng nhóm',
  lab_leader: 'Trưởng Lab',
  lab_manager: 'Chủ nghiệm Lab',
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [clock, setClock] = useState(new Date());
  const [net, setNet] = useState<NetworkInfo | null>(null);
  const [labName, setLabName] = useState('APES Lab');

  const [mssv, setMssv] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const [student, setStudent] = useState<Student | null>(null);
  const [session, setSession] = useState<PersistentSession | null>(null);
  const [windows, setWindows] = useState<Win[]>([]);

  const [qr, setQr] = useState<QrResult | null>(null);
  const [qrSeconds, setQrSeconds] = useState(0);

  const [attending, setAttending] = useState(false);
  const [result, setResult] = useState<AttendanceResult | null>(null);

  // Trạng thái khóa app (khi MAC không khớp)
  const [lockState, setLockState] = useState<LockState>('none');

  // Trạng thái IP có thuộc Wi-Fi lab hay không
  const [atLab, setAtLab] = useState<boolean | null>(null);
  const [labLocation, setLabLocation] = useState<string>('');

  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [connOk, setConnOk] = useState<boolean | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const resetTimer = useRef<number | null>(null);

  // ------------------------------------------------------------
  // Khởi tạo: load session, network info, config
  // ------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const [info, cfg, sess] = await Promise.all([
          window.kiosk.getNetworkInfo(),
          window.kiosk.getConfig(),
          window.kiosk.loadSession(),
        ]);
        setNet(info);
        setLabName(cfg.labName);

        if (sess) {
          // So sánh MAC của session với MAC hiện tại
          if (sess.mac === info.mac) {
            // Hợp lệ → auto-login
            setSession(sess);
            setStudent({
              id: sess.userId,
              mssv: sess.mssv,
              full_name: sess.fullName,
              khoa: '',
              role: 'student',
              group_name: null,
            });
            // Gọi lại verify để lấy windows + check mobile_linked
            await refreshUserInfo(sess);
            setScreen('home');
            return;
          } else {
            // MAC khác → KHÔNG xoá session, KHÔNG cho nhập lại MSSV.
            // Hiện LockScreen với thông báo yêu cầu Trưởng Lab reset.
            // Dùng loadSessionForensic để đọc session mà không clear.
            const forensicSess = await window.kiosk.loadSessionForensic();
            if (forensicSess) {
              setSession(forensicSess);
              setStudent({
                id: forensicSess.userId,
                mssv: forensicSess.mssv,
                full_name: forensicSess.fullName,
                khoa: '',
                role: 'student',
                group_name: null,
              });
            }
            setLockState('mac_mismatch');
            setScreen('locked');
            return;
          }
        }
        setScreen('mssv');
      } catch (e) {
        console.error('init failed', e);
        setError('Không khởi tạo được ứng dụng: ' + (e as Error).message);
        setScreen('mssv');
      }
    })();

    // Lắng nghe updater status
    window.kiosk.onUpdaterStatus(setUpdateStatus);
  }, []);

  /**
   * Refresh thông tin user từ server: lấy lại windows hôm nay,
   * check mobile đã liên kết chưa.
   * Không cần truyền password — server chỉ cần user_id.
   */
  const refreshUserInfo = useCallback(async (sess: PersistentSession) => {
    try {
      // Gọi verify-mssv với mssv của session để lấy lại windows + mobile_linked
      // (Edge Function sẽ trả về vì MAC khớp, không tạo binding mới)
      const { data } = await window.kiosk.verifyMssv(sess.mssv);
      if (data.success && data.user) {
        setStudent(data.user);
        setWindows(data.today_windows ?? []);
        if (data.mobile_linked !== undefined) {
          const updated: PersistentSession = {
            ...sess,
            mobileLinked: data.mobile_linked,
          };
          await window.kiosk.saveSession(updated);
          setSession(updated);
        }
      }
    } catch (e) {
      console.error('refresh failed', e);
    }
  }, []);

  /**
   * Kiểm tra IP hiện tại có thuộc Wi-Fi lab hay không.
   * Gọi khi vào Home và mỗi 30 giây để tự động enable/disable nút Điểm danh.
   */
  const checkAtLab = useCallback(async () => {
    try {
      const result: NetworkAtLabResult = await window.kiosk.isAtLab();
      setAtLab(result.atLab);
      setLabLocation(result.locationName ?? result.ssid ?? '');
    } catch (e) {
      console.error('checkAtLab failed', e);
      setAtLab(false);
    }
  }, []);

  // Kiểm tra IP lab khi vào Home và định kỳ mỗi 30 giây
  useEffect(() => {
    if (screen !== 'home') return;
    void checkAtLab();
    const t = setInterval(() => {
      void checkAtLab();
    }, 30000);
    return () => clearInterval(t);
  }, [screen, checkAtLab]);

  // Đồng hồ realtime
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
        void regenerateQr();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [screen, qr?.expires_at]);

  // ------------------------------------------------------------
  // Bước 1: Xác thực MSSV (lần đầu)
  // ------------------------------------------------------------
  const submitMssv = useCallback(async (value: string) => {
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

      // Lưu session vào Registry
      const newSession: PersistentSession = {
        mssv: code,
        userId: data.user.id,
        mac: data.mac_address ?? net?.mac ?? '',
        fullName: data.user.full_name,
        boundAt: new Date().toISOString(),
        mobileLinked: data.mobile_linked ?? false,
        hostname: data.hostname ?? undefined,
      };
      await window.kiosk.saveSession(newSession);
      setSession(newSession);
      setStudent(data.user);
      setWindows(data.today_windows ?? []);
      setMssv('');
      setVerifying(false);

      // Nếu mobile chưa liên kết → sinh QR; ngược lại vào Home luôn
      if (!newSession.mobileLinked) {
        await regenerateQrFor(data.user.id);
      } else {
        setScreen('home');
      }
    } catch (e) {
      setError((e as Error).message);
      setVerifying(false);
    }
  }, [net?.mac]);

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

      // Sau 5s → về HOME (giữ nguyên session), KHÔNG reset về MSSV
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => {
        setScreen('home');
        setResult(null);
      }, 5000);
    } catch (e) {
      setError((e as Error).message);
      setScreen('home');
    } finally {
      setAttending(false);
    }
  }, [student, attending]);

  const checkConnection = useCallback(async () => {
    const res = await window.kiosk.testConnection();
    setConnOk(res.ok);
  }, []);

  const checkUpdate = useCallback(async () => {
    await window.kiosk.checkUpdate();
    const status = await window.kiosk.getUpdateStatus();
    setUpdateStatus(status);
  }, []);

  const status = getCheckinStatus(windows as CheckinWindow[], clock);

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  if (screen === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[#f04030]" />
          <p className="mt-4 text-sm text-slate-500">Đang tải…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <Header
        labName={labName}
        clock={clock}
        net={net}
        student={student}
        updateStatus={updateStatus}
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
            onLinked={async () => {
              // Mobile đã claim QR thành công → cập nhật session, vào Home
              if (session) {
                const updated: PersistentSession = {
                  ...session,
                  mobileLinked: true,
                };
                await window.kiosk.saveSession(updated);
                setSession(updated);
              }
              setScreen('home');
            }}
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
            mobileLinked={session?.mobileLinked ?? false}
            atLab={atLab}
            labLocation={labLocation}
            onNewQr={async () => {
              if (session?.mobileLinked) {
                // Mobile đã link → xác nhận với user trước khi sinh QR mới
                if (
                  window.confirm(
                    'Điện thoại đã được liên kết. Bạn có chắc muốn tạo lại mã QR? (Chỉ dùng khi muốn đổi điện thoại — cần liên hệ Trưởng Lab trước).'
                  )
                ) {
                  await regenerateQrFor(student.id);
                }
              } else {
                await regenerateQrFor(student.id);
              }
            }}
            onCheckUpdate={checkUpdate}
          />
        )}

        {screen === 'locked' && lockState === 'mac_mismatch' && student && (
          <LockedScreen
            student={student}
            net={net}
            session={session}
            onRetry={async () => {
              // Thử lại: re-check MAC và IP
              setLockState('none');
              const info = await window.kiosk.getNetworkInfo();
              setNet(info);
              const forensicSess = await window.kiosk.loadSessionForensic();
              if (forensicSess && forensicSess.mac === info.mac) {
                // MAC khớp → vào Home
                setSession(forensicSess);
                setStudent({
                  id: forensicSess.userId,
                  mssv: forensicSess.mssv,
                  full_name: forensicSess.fullName,
                  khoa: '',
                  role: 'student',
                  group_name: null,
                });
                await refreshUserInfo(forensicSess);
                setScreen('home');
              } else {
                // Vẫn không khớp → ở lại locked
                setLockState('mac_mismatch');
                setScreen('locked');
              }
            }}
          />
        )}

        {screen === 'result' && student && (
          <ResultScreen
            student={student}
            result={result}
            onDone={() => {
              if (resetTimer.current) window.clearTimeout(resetTimer.current);
              setScreen('home');
              setResult(null);
            }}
          />
        )}

        {screen === 'settings' && (
          <SettingsScreen
            net={net}
            labName={labName}
            session={session}
            updateStatus={updateStatus}
            connOk={connOk}
            onBack={() => setScreen(session ? 'home' : 'mssv')}
            onRecheck={checkConnection}
            onCheckUpdate={checkUpdate}
          />
        )}
      </main>

      <Footer net={net} labName={labName} student={student} />
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
  student,
  updateStatus,
  onOpenSettings,
}: {
  labName: string;
  clock: Date;
  net: NetworkInfo | null;
  student: Student | null;
  updateStatus: UpdateStatus | null;
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
          <p className="text-[11px] text-slate-500">
            {student ? `${student.full_name} · ${student.mssv}` : 'Điểm danh sinh viên'}
          </p>
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
        {updateStatus?.state === 'downloaded' && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
            ● Có bản cập nhật mới
          </span>
        )}
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
          Sau lần đầu, máy này sẽ tự động đăng nhập cho bạn.
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
  onLinked,
}: {
  qr: QrResult | null;
  seconds: number;
  student: Student;
  onSkip: () => void;
  onRegenerate: () => void;
  onLinked: () => void;
}) {
  // Tự động quay về home sau khi mobile claim (poll mỗi 3s)
  useEffect(() => {
    if (!student) return;
    const t = setInterval(async () => {
      // Gọi lại verify-mssv để check mobile_linked
      const { data } = await window.kiosk.verifyMssv(student.mssv);
      if (data.mobile_linked) {
        onLinked();
      }
    }, 3000);
    return () => clearInterval(t);
  }, [student, onLinked]);

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
          Mở app APES Lab trên điện thoại và quét mã này để liên kết. QR sẽ tự ẩn sau khi điện thoại liên kết thành công.
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
  mobileLinked,
  onNewQr,
  onCheckUpdate,
  atLab,
  labLocation,
}: {
  student: Student;
  net: NetworkInfo | null;
  status: ReturnType<typeof getCheckinStatus>;
  attending: boolean;
  onAttend: () => void;
  error: string | null;
  mobileLinked: boolean;
  onNewQr: () => void;
  onCheckUpdate: () => void;
  atLab: boolean | null;
  labLocation: string;
}) {
  const canAttend = status.state === 'open' && atLab === true;

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

        {atLab === false && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-5 py-3">
            <p className="text-sm font-medium text-red-700">
              Bạn đang không ở lab. Kết nối Wi-Fi lab để điểm danh.
            </p>
            {labLocation && (
              <p className="mt-1 text-xs text-red-600">
                Wi-Fi hiện tại: {labLocation}
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

        <div className="mt-4 flex flex-col items-center gap-2">
          <button
            onClick={onNewQr}
            className="text-xs font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
          >
            {mobileLinked ? 'Đã liên kết điện thoại ✓' : 'Hiện mã QR liên kết điện thoại'}
          </button>
          <button
            onClick={onCheckUpdate}
            className="text-xs font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
          >
            Kiểm tra cập nhật
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * LockedScreen — hiển thị khi MAC không khớp với session.
 * SV không thể nhập lại MSSV — chỉ có thể yêu cầu Trưởng Lab reset binding.
 */
function LockedScreen({
  student,
  net,
  session,
  onRetry,
}: {
  student: Student;
  net: NetworkInfo | null;
  session: { hostname?: string; mac?: string } | null;
  onRetry: () => void;
}) {
  const handleRequestReset = () => {
    const subject = encodeURIComponent('Yêu cầu reset Desktop Binding');
    const body = encodeURIComponent(
      `Xin chào Trưởng Lab,\n\n` +
        `Tôi cần được reset liên kết Desktop App.\n\n` +
        `Thông tin tài khoản:\n` +
        `- MSSV: ${student.mssv}\n` +
        `- Họ tên: ${student.full_name}\n` +
        `- Hostname máy đã bind: ${session?.hostname ?? '—'}\n` +
        `- MAC đã bind: ${session?.mac ?? '—'}\n` +
        `- MAC hiện tại: ${net?.mac ?? '—'}\n` +
        `- Máy hiện tại: ${net?.ip ?? '—'}\n\n` +
        `Vui lòng reset binding để tôi có thể sử dụng app trên máy mới.\n\n` +
        `Trân trọng.`
    );
    window.location.href = `mailto:apes-lab@ptit.edu.vn?subject=${subject}&body=${body}`;
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className="w-full max-w-lg text-center">
        {/* Icon khóa */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h1 className="mt-6 text-2xl font-bold text-slate-900">
          App chỉ sử dụng được tại Lab
        </h1>

        <p className="mt-3 text-slate-500">
          Tài khoản này đã được liên kết với một máy khác.
        </p>

        {/* Thông tin tài khoản */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-left">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Thông tin tài khoản
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Họ tên</span>
              <span className="text-sm font-semibold text-slate-700">{student.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">MSSV</span>
              <span className="font-mono text-sm font-semibold text-slate-700">{student.mssv}</span>
            </div>
            {session?.hostname && (
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Máy đã bind</span>
                <span className="font-mono text-xs text-slate-600">{session.hostname}</span>
              </div>
            )}
            {session?.mac && (
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">MAC đã bind</span>
                <span className="font-mono text-xs text-slate-600">{session.mac}</span>
              </div>
            )}
            {net?.mac && (
              <div className="flex justify-between border-t border-slate-100 pt-2">
                <span className="text-sm text-slate-500">MAC hiện tại</span>
                <span className="font-mono text-xs text-red-500">{net.mac}</span>
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 rounded-xl bg-red-50 px-5 py-3 text-sm text-red-700">
          Địa chỉ MAC của máy này không khớp với máy đã liên kết. App sẽ không hoạt động trên máy khác nếu chưa được Trưởng Lab reset.
        </p>

        {/* Nút hành động */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={handleRequestReset}
            className="w-full rounded-2xl bg-[#f04030] px-6 py-4 text-base font-bold text-white shadow-lg shadow-[#f04030]/25 transition-all hover:bg-[#d63324]"
          >
            Yêu cầu Trưởng Lab reset binding
          </button>
          <button
            onClick={onRetry}
            className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-3 text-base font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Thử lại (khi đã về lab)
          </button>
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Sau khi Trưởng Lab reset, bạn sẽ được quay lại nhập MSSV trên máy mới.
        </p>
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
          Tự động quay về màn hình chính sau 5 giây
        </p>
        <button
          onClick={onDone}
          className="mt-4 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          Về màn hình chính
        </button>
      </div>
    </div>
  );
}

function SettingsScreen({
  net,
  labName,
  session,
  updateStatus,
  connOk,
  onBack,
  onRecheck,
  onCheckUpdate,
}: {
  net: NetworkInfo | null;
  labName: string;
  session: PersistentSession | null;
  updateStatus: UpdateStatus | null;
  connOk: boolean | null;
  onBack: () => void;
  onRecheck: () => void;
  onCheckUpdate: () => void;
}) {
  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-900">Cài đặt</h1>
        <p className="mt-1 text-slate-500">Thông tin máy và tài khoản</p>

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

          {session && (
            <Card title="Phiên đăng nhập">
              <Row label="MSSV" value={session.mssv} mono />
              <Row label="Họ tên" value={session.fullName} />
              <Row label="MAC" value={session.mac} mono />
              {session.hostname && (
                <Row label="Hostname" value={session.hostname} mono />
              )}
              <Row
                label="Điện thoại đã liên kết"
                value={session.mobileLinked ? '✓ Rồi' : '✗ Chưa'}
                tone={session.mobileLinked ? 'success' : 'default'}
              />
              <Row
                label="Ngày liên kết"
                value={new Date(session.boundAt).toLocaleString('vi-VN')}
              />
              <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Phiên đăng nhập cố định trên máy này. Để đổi MSSV, liên hệ
                Trưởng Lab để reset binding trên hệ thống.
              </p>
            </Card>
          )}

          <Card title="Định danh máy">
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

          <Card title="Cập nhật ứng dụng">
            <Row
              label="Trạng thái"
              value={
                updateStatus?.state === 'checking'
                  ? 'Đang kiểm tra…'
                  : updateStatus?.state === 'available'
                    ? `Có bản mới v${updateStatus.version}`
                    : updateStatus?.state === 'downloading'
                      ? `Đang tải… ${Math.round(updateStatus.progress ?? 0)}%`
                      : updateStatus?.state === 'downloaded'
                        ? `Đã tải xong v${updateStatus.version}`
                        : updateStatus?.state === 'not-available'
                          ? 'Đang ở bản mới nhất'
                          : updateStatus?.state === 'error'
                            ? `Lỗi: ${updateStatus.error}`
                            : 'Chưa kiểm tra'
              }
              tone={updateStatus?.state === 'downloaded' ? 'success' : 'default'}
            />
            <button
              onClick={onCheckUpdate}
              className="mt-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Kiểm tra cập nhật
            </button>
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

function Footer({
  net,
  labName,
  student,
}: {
  net: NetworkInfo | null;
  labName: string;
  student: Student | null;
}) {
  return (
    <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-2 text-[11px] text-slate-400">
      <span>
        {labName} v0.2{student ? ` · ${student.mssv}` : ''}
      </span>
      <span className="font-mono">
        {net?.mac ? `MAC ${net.mac}` : 'MAC —'}
      </span>
    </footer>
  );
}

/** Tiếng beep bằng Web Audio API */
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
