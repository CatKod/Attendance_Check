// ============================================================
// API client - gọi Edge Functions của Supabase
// ============================================================

import { getConfig } from './config';
import type { CheckinWindow } from '@apes/shared-types';

export class ApiError extends Error {
  readonly code?: string;
  readonly status: number;
  readonly todayWindows?: CheckinWindow[];

  constructor(
    message: string,
    code: string | undefined,
    status: number,
    todayWindows?: CheckinWindow[]
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.todayWindows = todayWindows;
  }
}

interface CallResult<T> {
  status: number;
  data: T;
}

export async function callFunction<T>(
  name: string,
  body: Record<string, unknown>
): Promise<CallResult<T>> {
  const cfg = getConfig();

  if (!cfg.functionsUrl) {
    throw new ApiError('Chưa cấu hình FUNCTIONS_URL trong .env', 'CONFIG', 0);
  }

  let res: Response;
  try {
    res = await fetch(`${cfg.functionsUrl}/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.supabaseAnonKey,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      'Không kết nối được máy chủ. Kiểm tra Internet rồi thử lại.',
      'NETWORK',
      0
    );
  }

  const data = (await res.json()) as T & {
    error?: string;
    code?: string;
    today_windows?: CheckinWindow[];
  };

  if (data.error) {
    throw new ApiError(data.error, data.code, res.status, data.today_windows);
  }

  return { status: res.status, data };
}

// ============================================================
// API theo nghiệp vụ
// ============================================================

export interface ClaimResult {
  success: boolean;
  binding: 'created' | 'reused' | 'reset_rebind';
  token_hash: string;
  email: string;
  user: {
    id: string;
    mssv: string;
    full_name: string;
    khoa: string;
    role: string;
    group_name: string | null;
  };
  device_id: string;
  today_windows: CheckinWindow[];
}

/** Đổi token từ QR lấy session (F-MOB-AUTH-03) */
export async function claimMobileBinding(
  token: string,
  deviceId: string,
  deviceModel?: string
): Promise<ClaimResult> {
  const { data } = await callFunction<ClaimResult>('claim-mobile-binding', {
    token,
    device_id: deviceId,
    device_model: deviceModel,
  });
  return data;
}

export interface AttendanceResponse {
  success?: boolean;
  warning?: string;
  already_attended?: boolean;
  check_in_time?: string;
  time?: string;
  method?: string;
  wifi_ssid?: string;
  code?: string;
  today_windows?: CheckinWindow[];
}

/** Ghi nhận điểm danh (F-MOB-ATT-02) */
export async function checkAttendance(params: {
  userId: string;
  ip: string;
  deviceId: string;
}): Promise<AttendanceResponse> {
  const { data } = await callFunction<AttendanceResponse>('check-attendance', {
    user_id: params.userId,
    ip_address: params.ip,
    method: 'mobile_wifi',
    device_id: params.deviceId,
  });
  return data;
}
