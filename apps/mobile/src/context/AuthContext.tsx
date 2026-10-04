// ============================================================
// AuthContext - quản lý session sinh viên trên Mobile
//
// Quy tắc quan trọng (F-MOB-AUTH):
//   - KHÔNG có đăng nhập bằng mật khẩu
//   - KHÔNG có nút đăng xuất
//   - Lần đầu: quét QR từ Desktop
//   - Từ lần 2: tự động vào màn hình chính
// ============================================================

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';
import { getConfig } from '../config';
import { claimMobileBinding, type ClaimResult } from '../api';
import { getNetworkInfo } from '../network';
import {
  clearSession,
  loadSession,
  saveSession,
  type StoredSession,
} from '../storage';
import type { CheckinWindow } from '@apes/shared-types';

interface AuthState {
  ready: boolean;
  session: StoredSession | null;
  supabase: SupabaseClient | null;
  windows: CheckinWindow[];
}

interface AuthContextValue extends AuthState {
  /** Quét QR lần đầu */
  claimFromQr(rawQr: string): Promise<ClaimResult>;
  /** Đăng xuất chỉ dành cho dev/reset — không có trong UI production */
  _reset(): Promise<void>;
  refresh(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    ready: false,
    session: null,
    supabase: null,
    windows: [],
  });

  // Khởi tạo: tạo Supabase client + khôi phục session từ secure storage
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cfg = getConfig();

      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
        if (!cancelled) setState((s) => ({ ...s, ready: true }));
        return;
      }

      const supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: true },
      });

      const stored = await loadSession();

      if (cancelled) return;

      if (stored) {
        // Khôi phục session Supabase từ token đã lưu
        try {
          await supabase.auth.setSession({
            access_token: stored.accessToken,
            refresh_token: stored.refreshToken,
          });
        } catch {
          // Token hết hạn → vẫn giữ session local để thử refresh
        }
      }

      setState({
        ready: true,
        session: stored,
        supabase,
        windows: [],
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Đồng bộ khi Supabase refresh token
  useEffect(() => {
    const { supabase, session } = state;
    if (!supabase || !session) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession: Session | null) => {
      if (newSession && newSession.access_token !== session.accessToken) {
        void (async () => {
          const latest = await loadSession();
          if (latest) {
            await saveSession({
              ...latest,
              accessToken: newSession.access_token,
              refreshToken: newSession.refresh_token,
            });
            setState((s) => ({
              ...s,
              session: { ...latest, accessToken: newSession.access_token, refreshToken: newSession.refresh_token },
            }));
          }
        })();
      }
    });

    return () => subscription.unsubscribe();
  }, [state.supabase, state.session]);

  // Lấy lịch điểm danh hôm nay khi có session
  const refresh = useCallback(async () => {
    const { session, supabase } = state;
    if (!session || !supabase) return;

    try {
      const vnNow = new Date(Date.now() + 7 * 3600 * 1000);
      const todayDow = vnNow.getUTCDay();

      // RPC trả sẵn các cửa sổ hợp lệ của đúng thứ hôm nay
      const { data: windows } = await supabase.rpc('get_checkin_windows', {
        for_day_of_week: todayDow,
      });

      if (!windows) return;

      const mapped: CheckinWindow[] = (windows as any[]).map((w) => ({
        start: String(w.checkin_start).slice(0, 5),
        end: String(w.checkin_end).slice(0, 5),
        label: `${String(w.checkin_start).slice(0, 5)} – ${String(w.checkin_end).slice(0, 5)}`,
        human: '',
      }));

      setState((s) => ({ ...s, windows: mapped }));
    } catch {
      /* im lặng - không chặn sử dụng app */
    }
  }, [state.session, state.supabase]);

  // Quét QR
  const claimFromQr = useCallback(
    async (rawQr: string): Promise<ClaimResult> => {
      const cfg = getConfig();
      const net = await getNetworkInfo();

      // 1) Đổi token lấy session
      const result = await claimMobileBinding(
        rawQr,
        net.deviceId,
        net.deviceModel
      );

      // 2) verifyOtp để lấy access/refresh token thật
      const supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: false },
      });

      const { data: authData, error: authErr } = await supabase.auth.verifyOtp({
        token_hash: result.token_hash,
        type: 'magiclink',
      });

      if (authErr || !authData.session) {
        throw new Error('Không lấy được phiên đăng nhập. Thử quét lại mã QR.');
      }

      // 3) Lưu vào secure storage
      const stored: StoredSession = {
        userId: result.user.id,
        mssv: result.user.mssv,
        fullName: result.user.full_name,
        khoa: result.user.khoa,
        groupName: result.user.group_name,
        role: result.user.role,
        deviceId: result.device_id,
        accessToken: authData.session.access_token,
        refreshToken: authData.session.refresh_token,
        linkedAt: new Date().toISOString(),
      };

      await saveSession(stored);

      setState((s) => ({
        ...s,
        session: stored,
        supabase,
        windows: result.today_windows ?? [],
      }));

      return result;
    },
    []
  );

  const _reset = useCallback(async () => {
    await clearSession();
    setState((s) => ({ ...s, session: null, windows: [] }));
  }, []);

  const value = useMemo(
    () => ({ ...state, claimFromQr, _reset, refresh }),
    [state, claimFromQr, _reset, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>');
  return ctx;
}
