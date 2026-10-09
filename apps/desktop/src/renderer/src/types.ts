// Kiểu dữ liệu dùng trong renderer, khai báo lại vì preload chạy ở context riêng

export interface NetworkInfo {
  ip: string;
  mac: string;
  interface: string;
  allIps: string[];
}

export interface Student {
  id: string;
  mssv: string;
  full_name: string;
  khoa: string;
  role: string;
  group_name: string | null;
}

export interface CheckinWindow {
  start: string;
  end: string;
  label: string;
  human: string;
}

export interface VerifyResult {
  success?: boolean;
  error?: string;
  code?: string;
  binding?: 'created' | 'reused' | 'reset_rebind';
  user?: Student;
  mac_address?: string;
  /** MAC đã bind trong DB — dùng để client so sánh */
  bound_mac?: string;
  hostname?: string;
  /** Mobile đã liên kết hay chưa — true thì không hiện QR */
  mobile_linked?: boolean;
  today_windows?: CheckinWindow[];
  day_of_week?: number;
}

export interface QrResult {
  success?: boolean;
  error?: string;
  payload?: string;
  qr_uri?: string;
  expires_at?: string;
  ttl_seconds?: number;
  qr_data_url?: string;
  student?: { mssv: string; full_name: string };
}

export interface AttendanceResult {
  success?: boolean;
  error?: string;
  warning?: string;
  already_attended?: boolean;
  check_in_time?: string;
  time?: string;
  method?: string;
  wifi_ssid?: string;
  code?: string;
  today_windows?: CheckinWindow[];
}

/** Session lưu trong Windows Registry — giúp app auto-login */
export interface PersistentSession {
  mssv: string;
  userId: string;
  mac: string;
  fullName: string;
  boundAt: string;
  mobileLinked: boolean;
  hostname?: string;
  osInfo?: string;
}

export interface AppConfigInfo {
  labName: string;
  functionsUrl: string;
  supabaseUrl: string;
}

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateStatus {
  state: UpdateState;
  version?: string;
  releaseDate?: string;
  releaseNotes?: string;
  progress?: number;
  error?: string;
}

// Định nghĩa window.kiosk do preload expose
export interface KioskBridge {
  getNetworkInfo(): Promise<NetworkInfo>;
  getConfig(): Promise<AppConfigInfo>;
  testConnection(): Promise<{ ok: boolean; status?: number; error?: string }>;
  verifyMssv(mssv: string): Promise<{ status: number; data: VerifyResult }>;
  generateQr(userId: string): Promise<QrResult>;
  checkAttendance(userId: string): Promise<{ status: number; data: AttendanceResult }>;

  // Session
  loadSession(): Promise<PersistentSession | null>;
  saveSession(s: PersistentSession): Promise<{ ok: boolean }>;
  updateSession(
    partial: Partial<PersistentSession>
  ): Promise<{ ok: boolean; session: PersistentSession | null }>;
  clearSession(): Promise<{ ok: boolean }>;
  /** Đọc session để hiển thị trên LockScreen (không xoá khi MAC khác) */
  loadSessionForensic(): Promise<PersistentSession | null>;

  // Updater
  checkUpdate(): Promise<void>;
  getUpdateStatus(): Promise<UpdateStatus>;
  onUpdaterStatus(cb: (status: UpdateStatus) => void): void;

  // Mạng
  /** Kiểm tra IP hiện tại có thuộc subnet Wi-Fi lab hay không */
  isAtLab(): Promise<NetworkAtLabResult>;

  beep(): Promise<void>;
}

/** Kết quả kiểm tra IP có thuộc Wi-Fi lab hay không */
export interface NetworkAtLabResult {
  atLab: boolean;
  locationName?: string;
  ssid?: string;
  error?: string;
}

/** Trạng thái khóa app */
export type LockState = 'none' | 'mac_mismatch';
