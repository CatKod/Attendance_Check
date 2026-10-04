// ============================================================
// Electron Main Process - APES Lab Kiosk
// ============================================================
// Chức năng chính:
//   - Đọc MAC + IP của card mạng đang dùng (F-DESK-CFG-03)
//   - Gọi Edge Function verify-mssv để xác thực MSSV (F-DESK-AUTH)
//   - Sinh QR liên kết Mobile (F-DESK-AUTH-05)
//   - Chế độ kiosk: fullscreen, khóa thoát bằng PIN (F-DESK-KIOSK)
// ============================================================

import { app, BrowserWindow, ipcMain, shell, dialog, globalShortcut } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import QRCode from 'qrcode';
import {
  readConfig,
  assertConfig,
  pickPrimaryIPv4,
  listIPv4s,
  normalizeMac,
  type AppConfig,
  type NetworkInterfaceInfo,
} from '@apes/shared-types';

/**
 * Chế độ chạy:
 *  - Mặc định: `!app.isPackaged` → dùng Vite dev server.
 *  - Đặt KIOSK_FORCE_PROD=1 để chạy thử bản build (load file tĩnh) mà
 *    không cần đóng gói. Hữu ích khi kiểm thử trên máy lab.
 */
const isDev =
  !app.isPackaged && process.env.KIOSK_FORCE_PROD !== '1';
const DEV_URL = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';

// ------------------------------------------------------------
// Config: đọc từ file env cạnh app (dễ chỉnh khi triển khai lab)
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
// Network helpers
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

  return {
    ip: primary?.ip ?? '',
    mac: primary?.mac ?? normalizeMac(os.hostname()) ?? '',
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
    width: 1280,
    height: 800,
    fullscreen: isDev ? false : true,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
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

  // Chặn mở link ra ngoài
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ------------------------------------------------------------
// Kiosk mode (F-DESK-KIOSK-01, F-DESK-KIOSK-06)
// ------------------------------------------------------------
let kioskPin = process.env.KIOSK_PIN ?? '1234';

function enterKioskMode(): void {
  mainWindow?.setFullScreen(true);
  mainWindow?.setMenu(null);
}

function exitKioskMode(): void {
  if (isDev) return;
  mainWindow?.setFullScreen(false);
  app.quit();
}

// ------------------------------------------------------------
// IPC Handlers
// ------------------------------------------------------------
function registerIpc(): void {
  // Lấy thông tin mạng của máy
  ipcMain.handle('network:info', () => getNetworkInfo());

  // Lấy cấu hình (không lộ service role key)
  ipcMain.handle('app:config', () => ({
    labName: config.labName,
    functionsUrl: config.functionsUrl,
    supabaseUrl: config.supabaseUrl,
  }));

  // Kiểm tra kết nối tới Supabase (F-DESK-CFG-04)
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

  // Xác thực MSSV
  ipcMain.handle('auth:verify-mssv', async (_e, mssv: string) => {
    const net = getNetworkInfo();
    if (!net.mac) {
      return { error: 'Không đọc được địa chỉ MAC của máy này.' };
    }
    return callFunction('verify-mssv', {
      mssv,
      mac_address: net.mac,
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

    // Render QR thành data URL để hiển thị
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

  // Thoát kiosk bằng PIN (F-DESK-KIOSK-06)
  ipcMain.handle('kiosk:exit', (_e, pin: string) => {
    if (pin === kioskPin) {
      exitKioskMode();
      return { ok: true };
    }
    return { ok: false, error: 'Mã PIN không đúng' };
  });

  // Đổi mã PIN (F-DESK-CFG-02)
  ipcMain.handle('kiosk:set-pin', (_e, pin: string) => {
    if (!/^\d{4,8}$/.test(pin)) {
      return { ok: false, error: 'PIN phải gồm 4-8 chữ số' };
    }
    kioskPin = pin;
    return { ok: true };
  });

  // Phát tiếng beep sau khi điểm danh (F-DESK-ATT-04)
  ipcMain.handle('app:beep', () => {
    mainWindow?.webContents.send('app:beep');
  });
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
  enterKioskMode();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Chặn đóng cửa sổ khi đang ở kiosk mode
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || !isDev) app.quit();
});

// Chặn Alt+F4 / Ctrl+Q khi ở kiosk mode
app.on('before-quit', (e) => {
  if (isDev) return;
  e.preventDefault();
  mainWindow?.webContents.send('kiosk:before-quit');
});

if (process.platform === 'win32') {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
