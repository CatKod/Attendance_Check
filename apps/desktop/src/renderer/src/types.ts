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

export interface AppConfigInfo {
  labName: string;
  functionsUrl: string;
  supabaseUrl: string;
}

// Định nghĩa window.kiosk do preload expose
export interface KioskBridge {
  getNetworkInfo(): Promise<NetworkInfo>;
  getConfig(): Promise<AppConfigInfo>;
  testConnection(): Promise<{ ok: boolean; status?: number; error?: string }>;
  verifyMssv(mssv: string): Promise<{ status: number; data: VerifyResult }>;
  generateQr(userId: string): Promise<QrResult>;
  checkAttendance(userId: string): Promise<{ status: number; data: AttendanceResult }>;
  exitKiosk(pin: string): Promise<{ ok: boolean; error?: string }>;
  setKioskPin(pin: string): Promise<{ ok: boolean; error?: string }>;
  beep(): Promise<void>;
  onBeforeQuit(cb: () => void): void;
}
