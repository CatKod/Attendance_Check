// ============================================================
// Preload script - cầu nối an toàn giữa main process và renderer
// ============================================================

import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Thông tin mạng
  getNetworkInfo: () => ipcRenderer.invoke('network:info'),
  /**
   * Kiểm tra IP hiện tại có thuộc subnet Wi-Fi lab hay không.
   * Gọi RPC match_wifi_by_ip.
   */
  isAtLab: () => ipcRenderer.invoke('network:is-at-lab'),

  // Cấu hình app
  getConfig: () => ipcRenderer.invoke('app:config'),
  testConnection: () => ipcRenderer.invoke('app:test-connection'),

  // Xác thực MSSV
  verifyMssv: (mssv: string) => ipcRenderer.invoke('auth:verify-mssv', mssv),

  // QR liên kết Mobile
  generateQr: (userId: string) => ipcRenderer.invoke('link:generate-qr', userId),

  // Điểm danh
  checkAttendance: (userId: string) =>
    ipcRenderer.invoke('attendance:check', userId),

  // Session (lưu vào Windows Registry)
  loadSession: () => ipcRenderer.invoke('session:load'),
  saveSession: (s: unknown) => ipcRenderer.invoke('session:save', s),
  updateSession: (partial: unknown) =>
    ipcRenderer.invoke('session:update', partial),
  clearSession: () => ipcRenderer.invoke('session:clear'),
  /**
   * Đọc session CHỈ ĐỂ HIỂN THỊ trên LockScreen.
   * KHÔNG xoá session khi MAC khác (giữ để hiển thị thông tin + yêu cầu reset).
   */
  loadSessionForensic: () => ipcRenderer.invoke('session:read-forensic'),

  // Updater
  checkUpdate: () => ipcRenderer.invoke('updater:check'),
  getUpdateStatus: () => ipcRenderer.invoke('updater:status'),

  // Beep
  beep: () => ipcRenderer.invoke('app:beep'),

  // Lắng nghe sự kiện
  onUpdaterStatus: (cb: (status: unknown) => void) => {
    ipcRenderer.on('updater:status', (_e, status) => cb(status));
  },
};

contextBridge.exposeInMainWorld('kiosk', api);

export type KioskApi = typeof api;
