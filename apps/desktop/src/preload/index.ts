// ============================================================
// Preload script - cầu nối an toàn giữa main process và renderer
// ============================================================

import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Thông tin mạng của máy kiosk
  getNetworkInfo: () => ipcRenderer.invoke('network:info'),

  // Cấu hình app
  getConfig: () => ipcRenderer.invoke('app:config'),
  testConnection: () => ipcRenderer.invoke('app:test-connection'),

  // Xác thực MSSV
  verifyMssv: (mssv: string) => ipcRenderer.invoke('auth:verify-mssv', mssv),

  // QR liên kết Mobile
  generateQr: (userId: string) => ipcRenderer.invoke('link:generate-qr', userId),

  // Điểm danh
  checkAttendance: (userId: string) => ipcRenderer.invoke('attendance:check', userId),

  // Kiosk
  exitKiosk: (pin: string) => ipcRenderer.invoke('kiosk:exit', pin),
  setKioskPin: (pin: string) => ipcRenderer.invoke('kiosk:set-pin', pin),

  // Beep
  beep: () => ipcRenderer.invoke('app:beep'),

  // Lắng nghe sự kiện từ main
  onBeforeQuit: (cb: () => void) => {
    ipcRenderer.on('kiosk:before-quit', cb);
  },
};

contextBridge.exposeInMainWorld('kiosk', api);

export type KioskApi = typeof api;
