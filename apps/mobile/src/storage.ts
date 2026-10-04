// ============================================================
// Secure storage - lưu session sau khi quét QR
// (F-MOB-AUTH-04: KHÔNG có nút đăng xuất)
// ============================================================

import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'apes_session_v1';
const DEVICE_KEY = 'apes_device_id';

export interface StoredSession {
  userId: string;
  mssv: string;
  fullName: string;
  khoa: string;
  groupName: string | null;
  role: string;
  deviceId: string;
  accessToken: string;
  refreshToken: string;
  linkedAt: string;
}

export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

/** Device ID để ghi audit log */
export async function getStoredDeviceId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(DEVICE_KEY);
  } catch {
    return null;
  }
}

export async function setStoredDeviceId(id: string): Promise<void> {
  await SecureStore.setItemAsync(DEVICE_KEY, id);
}
