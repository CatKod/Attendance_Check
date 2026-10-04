// ============================================================
// Lấy thông tin mạng của điện thoại
// (F-MOB-ATT-02, F-MOB-ATT-06: chỉ chấp nhận Wi-Fi)
// ============================================================

import * as Network from 'expo-network';
import * as Application from 'expo-application';
import * as Device from 'expo-device';

export interface PhoneNetworkInfo {
  /** true nếu đang dùng Wi-Fi */
  isWifi: boolean;
  /** true nếu đang dùng 4G/5G (cellular) */
  isCellular: boolean;
  ip: string | null;
  type: Network.NetworkStateType;
  /** Android ID — dùng làm device identifier */
  deviceId: string;
  deviceModel: string;
}

export async function getNetworkInfo(): Promise<PhoneNetworkInfo> {
  const state = await Network.getNetworkStateAsync();

  let ip: string | null = null;
  try {
    const raw = await Network.getIpAddressAsync();
    // SDK trả về string ở bản này; bản mới trả object { ipAddress }
    if (typeof raw === 'string') {
      ip = raw || null;
    } else if (raw && typeof raw === 'object' && 'ipAddress' in raw) {
      ip = (raw as { ipAddress?: string }).ipAddress ?? null;
    }
  } catch {
    ip = null;
  }

  // Android ID là ổn định hơn, iOS không có nên dùng vendor id fallback
  let deviceId: string;
  try {
    deviceId =
      Application.getAndroidId() ??
      `ios-${Application.applicationId ?? Date.now()}`;
  } catch {
    deviceId = `dev-${Date.now()}`;
  }

  const model =
    Device.manufacturer && Device.modelName
      ? `${Device.manufacturer} ${Device.modelName}`
      : (Device.modelName ?? 'Unknown');

  const type = state.type ?? Network.NetworkStateType.UNKNOWN;

  return {
    isWifi: type === Network.NetworkStateType.WIFI,
    isCellular: type === Network.NetworkStateType.CELLULAR,
    ip,
    type,
    deviceId,
    deviceModel: model,
  };
}
