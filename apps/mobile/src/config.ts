// ============================================================
// Cấu hình runtime cho Mobile App
// ============================================================

import Constants from 'expo-constants';
import { readConfig, type AppConfig } from '@apes/shared-types';

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;

  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

  const env: Record<string, string | undefined> = {
    EXPO_PUBLIC_SUPABASE_URL:
      process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl,
    EXPO_PUBLIC_SUPABASE_ANON_KEY:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey,
    FUNCTIONS_URL: process.env.EXPO_PUBLIC_FUNCTIONS_URL ?? extra.functionsUrl,
    LAB_NAME: process.env.EXPO_PUBLIC_LAB_NAME ?? extra.labName,
  };

  cached = readConfig(env);
  return cached;
}
