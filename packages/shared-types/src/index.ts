// TypeScript types dùng chung cho cả 3 nền tảng

export * from './attendance';

export type UserRole = 'student' | 'group_leader' | 'lab_leader' | 'lab_manager';

export interface User {
  id: string;
  mssv: string;
  full_name: string;
  email?: string;
  khoa: string;
  group_id: string | null;
  role: UserRole;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  leader_id: string | null;
  description?: string;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  address?: string;
  is_active: boolean;
  created_at: string;
}

export interface WifiNetwork {
  id: string;
  location_id: string;
  ssid: string;
  subnet: string; // CIDR notation: "192.168.1.0/24"
  gateway?: string;
  bssid?: string;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
}

export type DeviceKind = 'desktop' | 'mobile';
export type DeviceStatus = 'active' | 'reset' | 'revoked';

export interface DeviceBinding {
  id: string;
  user_id: string;
  kind: DeviceKind;
  device_identifier: string; // MAC for desktop, Android ID for mobile
  bound_at: string;
  last_seen_at: string | null;
  status: DeviceStatus;
  reset_by?: string;
  reset_at?: string;
  reset_reason?: string;
}

export type AttendanceMethod = 'desktop' | 'mobile_wifi' | 'manual_admin';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface Attendance {
  id: string;
  user_id: string;
  session_id?: string;
  check_in_time: string;
  method: AttendanceMethod;
  ip_address?: string;
  subnet_matched?: string;
  location_id?: string;
  status: AttendanceStatus;
  note?: string;
  approved_by?: string;
  created_at: string;
}

export interface Session {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location_id?: string;
  group_id?: string;
  status: 'open' | 'closed';
  created_at: string;
}

export interface LabSettings {
  id: string;
  lab_name: string;
  late_threshold_minutes: number;
  kiosk_pin_hash?: string;
  updated_at: string;
  /** Số lần điểm danh bắt buộc trong 1 tuần (mục tiêu) */
  required_checkins_per_week?: number;
}

/** Lịch mở/đóng cửa của lab theo thứ trong tuần */
export interface LabSchedule {
  id: string;
  /** 0 = Chủ nhật ... 6 = Thứ 7 (kiểu ISO) */
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  note?: string;
  /** Ca này có được phép điểm danh hay không */
  allow_checkin?: boolean;
  /** Bắt đầu được điểm danh (null = không dùng để điểm danh) */
  checkin_start_time?: string | null;
  /** Kết thúc được điểm danh (null = không dùng để điểm danh) */
  checkin_end_time?: string | null;
}