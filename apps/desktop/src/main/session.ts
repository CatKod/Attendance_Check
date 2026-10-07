// ============================================================
// Persistent Session Storage
// ============================================================
// Lưu phiên đăng nhập của SV vào Windows Registry (HKCU).
// Mục đích: sau khi SV nhập MSSV lần đầu, app sẽ tự động nhận diện
// ở các lần mở sau, miễn là cùng máy (cùng MAC).
//
// Windows: HKCU\Software\APES-Lab\Kiosk
// macOS/Linux (dev): file trong app.getPath('userData')/session.json
// ============================================================

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { execFileSync } from 'child_process';

const REG_PATH = 'HKCU\\Software\\APES-Lab\\Kiosk';
const REG_KEYS = {
  mssv: 'BoundMssv',
  userId: 'BoundUserId',
  mac: 'BoundMac',
  fullName: 'BoundFullName',
  boundAt: 'BoundAt',
  mobileLinked: 'MobileLinked',
  hostname: 'Hostname',
  osInfo: 'OsInfo',
} as const;

export interface PersistentSession {
  mssv: string;
  userId: string;
  mac: string;
  fullName: string;
  boundAt: string;
  mobileLinked: boolean;
  hostname?: string;
  osInfo?: string;
}

export const session = {
  /**
   * Đọc session từ Registry (Windows) hoặc file (macOS/Linux).
   * Trả về null nếu chưa có hoặc lỗi.
   */
  read(): PersistentSession | null {
    if (process.platform === 'win32') {
      return readFromRegistry();
    }
    return readFromFile();
  },

  /**
   * Ghi session vào Registry / file.
   * Ghi đè nếu đã tồn tại.
   */
  write(s: PersistentSession): void {
    if (process.platform === 'win32') {
      writeToRegistry(s);
    } else {
      writeToFile(s);
    }
  },

  /**
   * Xoá session (khi SV đăng xuất).
   */
  clear(): void {
    if (process.platform === 'win32') {
      clearRegistry();
    } else {
      clearFile();
    }
  },

  /**
   * Cập nhật 1 trường (vd: đánh dấu mobile đã link).
   * Đọc lại → sửa → ghi đè.
   */
  update(partial: Partial<PersistentSession>): PersistentSession | null {
    const current = this.read();
    if (!current) return null;
    const next = { ...current, ...partial };
    this.write(next);
    return next;
  },
};

// ============================================================
// Windows Registry (HKCU)
// ============================================================
function regQuery(): Record<string, string> {
  try {
    // Query toàn bộ key trong 1 lần
    const out = execFileSync('reg.exe', ['query', REG_PATH], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const result: Record<string, string> = {};
    for (const line of out.split(/\r?\n/)) {
      // Format: "    KeyName    REG_SZ    value"
      const m = line.match(/^\s*(\S+)\s+REG_SZ\s+(.*)$/);
      if (m) result[m[1]] = m[2].trim();
    }
    return result;
  } catch {
    return {};
  }
}

function regAdd(key: string, value: string): void {
  try {
    execFileSync(
      'reg.exe',
      ['add', REG_PATH, '/v', key, '/t', 'REG_SZ', '/d', value, '/f'],
      { stdio: 'ignore' }
    );
  } catch (e) {
    console.error(`[session] reg add ${key} failed:`, e);
  }
}

function readFromRegistry(): PersistentSession | null {
  const all = regQuery();
  if (!all[REG_KEYS.mssv] || !all[REG_KEYS.mac] || !all[REG_KEYS.userId]) {
    return null;
  }
  return {
    mssv: all[REG_KEYS.mssv],
    userId: all[REG_KEYS.userId],
    mac: all[REG_KEYS.mac],
    fullName: all[REG_KEYS.fullName] ?? '',
    boundAt: all[REG_KEYS.boundAt] ?? '',
    mobileLinked: all[REG_KEYS.mobileLinked] === '1',
    hostname: all[REG_KEYS.hostname] || undefined,
    osInfo: all[REG_KEYS.osInfo] || undefined,
  };
}

function writeToRegistry(s: PersistentSession): void {
  regAdd(REG_KEYS.mssv, s.mssv);
  regAdd(REG_KEYS.userId, s.userId);
  regAdd(REG_KEYS.mac, s.mac);
  regAdd(REG_KEYS.fullName, s.fullName);
  regAdd(REG_KEYS.boundAt, s.boundAt);
  regAdd(REG_KEYS.mobileLinked, s.mobileLinked ? '1' : '0');
  if (s.hostname) regAdd(REG_KEYS.hostname, s.hostname);
  if (s.osInfo) regAdd(REG_KEYS.osInfo, s.osInfo);
}

function clearRegistry(): void {
  try {
    execFileSync('reg.exe', ['delete', REG_PATH, '/f'], { stdio: 'ignore' });
  } catch {
    // ignore — key có thể chưa tồn tại
  }
}

// ============================================================
// File-based fallback (macOS / Linux — chỉ dùng khi dev)
// ============================================================
function sessionPath(): string {
  return path.join(app.getPath('userData'), 'session.json');
}

function readFromFile(): PersistentSession | null {
  try {
    const raw = fs.readFileSync(sessionPath(), 'utf8');
    return JSON.parse(raw) as PersistentSession;
  } catch {
    return null;
  }
}

function writeToFile(s: PersistentSession): void {
  try {
    fs.mkdirSync(path.dirname(sessionPath()), { recursive: true });
    fs.writeFileSync(sessionPath(), JSON.stringify(s, null, 2), 'utf8');
  } catch (e) {
    console.error('[session] write file failed:', e);
  }
}

function clearFile(): void {
  try {
    fs.unlinkSync(sessionPath());
  } catch {
    // ignore
  }
}
