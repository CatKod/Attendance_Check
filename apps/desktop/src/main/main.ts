// ============================================================
// Electron Main Process - APES Lab Personal App
// ============================================================
// Thay đổi so với phiên bản kiosk cũ:
//   - BỎ: chế độ kiosk (fullscreen, PIN, chặn thoát)
//   - THÊM: đọc/ghi session vào Windows Registry
//   - THÊM: thu thập fingerprint (hostname, OS, disk serial)
//   - THÊM: auto-update từ GitHub Releases (electron-updater)
//   - THÊM: kiểm tra session hợp lệ trước khi vào app
// ============================================================

import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import QRCode from 'qrcode';
import {
  readConfig,
  assertConfig,
  pickPrimaryIPv4,
  listIPv4s,
  type AppConfig,
  type NetworkInterfaceInfo,
} from '@apes/shared-types';
import { session, type PersistentSession } from './session';
import { getMachineFingerprint } from './fingerprint';
import { initUpdater, checkForUpdate, getStatus } from './updater';

const isDev =
  !app.isPackaged && process.env.KIOSK_FORCE_PROD !== '1';
const DEV_URL = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';

// ------------------------------------------------------------
// Config loader
// ------------------------------------------------------------
function loadConfig(): AppConfig {
  const candidates = [
    path.join(process.cwd(), '.env'),
    path.join(app.getPath('userData'), '.env'),
    path.join(__dirname, '..', '.env'),
  ];

  const fileEnv: Record<string, string> = {};
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq === -1) continue;
        fileEnv[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
      }
      break;
    } catch {
      /* bỏ qua */
    }
  }

  return readConfig({ ...fileEnv, ...process.env });
}

let config: AppConfig;
let mainWindow: BrowserWindow | null = null;

// ------------------------------------------------------------
// Network info
// ------------------------------------------------------------
interface NetworkInfo {
  ip: string;
  mac: string;
  interface: string;
  allIps: string[];
}

function getNetworkInfo(): NetworkInfo {
  const ifaces = os.networkInterfaces() as unknown as NetworkInterfaceInfo;
  const primary = pickPrimaryIPv4(ifaces);

  // Normalize MAC về dạng aa:bb:cc:dd:ee:ff
  const rawMac = primary?.mac ?? '';
  const mac = rawMac
    .toLowerCase()
    .split(':')
    .map((p) => p.padStart(2, '0'))
    .join(':');

  return {
    ip: primary?.ip ?? '',
    mac,
    interface: primary?.iface ?? '',
    allIps: listIPv4s(ifaces),
  };
}

// ------------------------------------------------------------
// Edge Function client
// ------------------------------------------------------------
async function callFunction<T>(
  name: string,
  body: Record<string, unknown>
): Promise<{ status: number; data: T & { error?: string } }> {
  if (!config.functionsUrl) throw new Error('Chưa cấu hình functionsUrl');

  const res = await fetch(`${config.functionsUrl}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as T & { error?: string };
  return { status: res.status, data };
}

// ------------------------------------------------------------
// Window
// ------------------------------------------------------------
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    // KHÔNG fullscreen — app cá nhân, user tự quản lý cửa sổ
    fullscreen: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    title: 'APES Lab',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Mở link ngoài trong trình duyệt
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ------------------------------------------------------------
// IPC Handlers
// ------------------------------------------------------------
function registerIpc(): void {
  // Thông tin mạng
  ipcMain.handle('network:info', () => getNetworkInfo());

  // Cấu hình
  ipcMain.handle('app:config', () => ({
    labName: config.labName,
    functionsUrl: config.functionsUrl,
    supabaseUrl: config.supabaseUrl,
  }));

  // Kiểm tra kết nối Supabase
  ipcMain.handle('app:test-connection', async () => {
    try {
      assertConfig(config);
      const res = await fetch(`${config.supabaseUrl}/rest/v1/`, {
        headers: { apikey: config.supabaseAnonKey },
      });
      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  // Session management
  ipcMain.handle('session:load', () => session.read());
  ipcMain.handle('session:save', (_e, s: PersistentSession) => {
    session.write(s);
    return { ok: true };
  });
  ipcMain.handle('session:update', (_e, partial: Partial<PersistentSession>) => {
    const updated = session.update(partial);
    return { ok: !!updated, session: updated };
  });
  ipcMain.handle('session:clear', () => {
    session.clear();
    return { ok: true };
  });

  // Xác thực MSSV — gửi kèm fingerprint
  ipcMain.handle('auth:verify-mssv', async (_e, mssv: string) => {
    const net = getNetworkInfo();
    const fp = getMachineFingerprint();
    if (!net.mac) {
      return { error: 'Không đọc được địa chỉ MAC của máy này.' };
    }
    return callFunction('verify-mssv', {
      mssv,
      mac_address: net.mac,
      hostname: fp.hostname,
      os_info: fp.osInfo,
      disk_serial: fp.diskSerial,
    });
  });

  // Sinh QR liên kết Mobile
  ipcMain.handle('link:generate-qr', async (_e, userId: string) => {
    const net = getNetworkInfo();
    const { data } = await callFunction('generate-link-qr', {
      user_id: userId,
      kiosk_mac: net.mac,
      ttl_seconds: 60,
    });

    if (data.error || !(data as any).payload) {
      return { error: data.error ?? 'Không tạo được mã QR' };
    }

    const dataUrl = await QRCode.toDataURL((data as any).payload, {
      width: 420,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    });

    return { ...data, qr_data_url: dataUrl };
  });

  // Điểm danh
  ipcMain.handle('attendance:check', async (_e, userId: string) => {
    const net = getNetworkInfo();
    if (!net.ip) {
      return { error: 'Không lấy được địa chỉ IP của máy.' };
    }
    return callFunction('check-attendance', {
      user_id: userId,
      ip_address: net.ip,
      method: 'desktop',
      device_id: net.mac,
    });
  });

  // Phát beep
  ipcMain.handle('app:beep', () => {
    mainWindow?.webContents.send('app:beep');
  });

  // Updater
  ipcMain.handle('updater:check', () => checkForUpdate());
  ipcMain.handle('updater:status', () => getStatus());
}

// ------------------------------------------------------------
// App lifecycle
// ------------------------------------------------------------
app.whenReady().then(() => {
  try {
    config = loadConfig();
    assertConfig(config);
  } catch (e) {
    dialog.showErrorBox(
      'Cấu hình chưa đúng',
      `${(e as Error).message}\n\nHãy tạo file .env cạnh app hoặc trong thư mục dữ liệu người dùng.`
    );
  }

  registerIpc();
  createWindow();

  // Khởi tạo auto-update (chỉ khi đã đóng gói, không phải dev)
  if (!isDev) {
    initUpdater(mainWindow);
    // Kiểm tra cập nhật sau 5s (để app load trước)
    setTimeout(() => {
      void checkForUpdate();
    }, 5000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

// Đảm bảo chỉ chạy 1 instance (quan trọng cho Registry session)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}
