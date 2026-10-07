// ============================================================
// Auto-update từ GitHub Releases
// ============================================================
// Dùng electron-updater (đã có sẵn trong dependencies) để kiểm tra
// và cài đặt bản cập nhật mới khi user khởi động app.
//
// Cấu hình trong package.json → build → publish:
//   "publish": {
//     "provider": "github",
//     "owner": "<github-owner>",
//     "repo": "<github-repo>"
//   }
//
// Luồng:
//   1. App khởi động → checkForUpdate() ngay
//   2. Nếu có bản mới → hiện dialog thông báo + nút "Cập nhật"
//   3. User bấm → tải về (background)
//   4. Tải xong → dialog xác nhận khởi động lại
//   5. App khởi động lại → cài đặt
// ============================================================

import { autoUpdater, UpdateInfo } from 'electron-updater';
import { dialog, BrowserWindow, app } from 'electron';
import * as log from 'electron-log';

// electron-updater dùng electron-log để ghi log
// Khởi tạo log nếu chưa có
try {
  log.transports.file.level = 'info';
  autoUpdater.logger = log;
} catch {
  // ignore
}

let isChecking = false;
let isDownloading = false;

export interface UpdateStatus {
  state:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error';
  version?: string;
  releaseDate?: string;
  releaseNotes?: string;
  progress?: number;
  error?: string;
}

let currentStatus: UpdateStatus = { state: 'idle' };
let mainWindow: BrowserWindow | null = null;

/** Khởi tạo updater — gọi 1 lần khi app ready. */
export function initUpdater(win: BrowserWindow | null): void {
  mainWindow = win;

  // Tự động tải xuống (không cần user bấm) — tiết kiệm 1 bước
  autoUpdater.autoDownload = true;

  // Không tự động cài đặt — để user quyết định khi nào restart
  autoUpdater.autoInstallOnAppQuit = true;

  // ============================================
  // Sự kiện từ autoUpdater
  // ============================================
  autoUpdater.on('checking-for-update', () => {
    setStatus({ state: 'checking' });
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    setStatus({
      state: 'available',
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: typeof info.releaseNotes === 'string'
        ? info.releaseNotes
        : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map((n) => n.note).join('\n')
          : undefined,
    });
    // Thông báo cho user
    void notifyUpdateAvailable(info);
  });

  autoUpdater.on('update-not-available', () => {
    setStatus({ state: 'not-available' });
  });

  autoUpdater.on('download-progress', (progress) => {
    setStatus({
      state: 'downloading',
      progress: progress.percent,
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    isDownloading = false;
    setStatus({
      state: 'downloaded',
      version: info.version,
      releaseDate: info.releaseDate,
    });
    void notifyUpdateDownloaded(info);
  });

  autoUpdater.on('error', (err) => {
    isChecking = false;
    isDownloading = false;
    setStatus({ state: 'error', error: err.message });
    console.error('[updater] error:', err);
  });
}

/** Kiểm tra cập nhật ngay (silent). */
export async function checkForUpdate(): Promise<void> {
  if (isChecking || isDownloading) return;
  isChecking = true;
  try {
    await autoUpdater.checkForUpdates();
  } catch (e) {
    setStatus({ state: 'error', error: (e as Error).message });
  } finally {
    isChecking = false;
  }
}

/** Tải xuống ngay (nếu chưa tự động tải). */
export async function downloadUpdate(): Promise<void> {
  if (isDownloading) return;
  isDownloading = true;
  try {
    await autoUpdater.downloadUpdate();
  } catch (e) {
    isDownloading = false;
    setStatus({ state: 'error', error: (e as Error).message });
  }
}

/** Cài đặt và khởi động lại. */
export function installAndRestart(): void {
  autoUpdater.quitAndInstall();
}

/** Lấy trạng thái hiện tại. */
export function getStatus(): UpdateStatus {
  return currentStatus;
}

// ============================================================
// Internal helpers
// ============================================================
function setStatus(s: Partial<UpdateStatus>): void {
  currentStatus = { ...currentStatus, ...s };
  // Gửi xuống renderer để hiển thị
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status', currentStatus);
  }
}

async function notifyUpdateAvailable(info: UpdateInfo): Promise<void> {
  const { response } = await dialog.showMessageBox(mainWindow!, {
    type: 'info',
    title: 'Có bản cập nhật mới',
    message: `APES Lab Kiosk v${info.version} đã có`,
    detail:
      'Đang tải xuống nền. Bạn có thể tiếp tục điểm danh, app sẽ thông báo khi tải xong.',
    buttons: ['OK'],
    defaultId: 0,
  });
  void response;
}

async function notifyUpdateDownloaded(info: UpdateInfo): Promise<void> {
  const { response } = await dialog.showMessageBox(mainWindow!, {
    type: 'info',
    title: 'Cập nhật đã tải xong',
    message: `APES Lab Kiosk v${info.version} sẵn sàng cài đặt`,
    detail:
      'Bấm "Khởi động lại" để cài đặt ngay, hoặc "Để sau" để cài khi tắt app.',
    buttons: ['Khởi động lại ngay', 'Để sau'],
    defaultId: 0,
    cancelId: 1,
  });

  if (response === 0) {
    installAndRestart();
  }
}
