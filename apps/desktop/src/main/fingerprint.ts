// ============================================================
// Machine Fingerprint
// ============================================================
// Lấy thông tin định danh máy vật lý để gửi kèm khi verify-mssv.
// Giúp admin biết SV đang dùng máy nào + chống clone VM.
//
// - hostname: tên máy (vd: "DESKTOP-ABC123")
// - osInfo: phiên bản Windows
// - diskSerial: serial ổ cứng (Windows: wmic, macOS: ioreg, Linux: hdparm)
// ============================================================

import * as os from 'os';
import { execFileSync } from 'child_process';

export interface MachineFingerprint {
  hostname: string;
  osInfo: string;
  diskSerial: string | null;
}

export function getMachineFingerprint(): MachineFingerprint {
  return {
    hostname: os.hostname(),
    osInfo: getOsInfo(),
    diskSerial: getDiskSerial(),
  };
}

function getOsInfo(): string {
  const platform = os.platform();
  const release = os.release();
  const type = os.type();
  // Ví dụ: "Windows_NT 10.0.26200" hoặc "Darwin 23.0.0" hoặc "Linux 5.15.0"
  return `${type} ${release} (${platform})`;
}

function getDiskSerial(): string | null {
  try {
    if (process.platform === 'win32') {
      // Windows: wmic lấy serial ổ C:
      const out = execFileSync(
        'wmic.exe',
        ['diskdrive', 'where', 'Index=0', 'get', 'SerialNumber', '/value'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      );
      const m = out.match(/SerialNumber=(.+)/);
      return m ? m[1].trim() : null;
    }
    if (process.platform === 'darwin') {
      // macOS: ioreg lấy serial ổ đĩa
      const out = execFileSync(
        'ioreg',
        ['-rd1', '-c', 'IOMedia'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      );
      // Trên macOS serial ổ thường nằm trong "DeviceCharacteristics" hoặc IOProviderClass
      // Đơn giản: lấy "IORegistryEntryName" của disk0s1
      const m = out.match(/IORegistryEntryName\s*=\s*"([^"]+)"/);
      return m ? m[1] : null;
    }
    // Linux: root disk thường là /dev/sda, dùng hdparm hoặc lsblk
    try {
      const out = execFileSync(
        'lsblk',
        ['-nodeps', '-no', 'serial', '/dev/sda'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      );
      const s = out.trim();
      return s || null;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}
