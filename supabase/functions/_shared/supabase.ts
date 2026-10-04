// ============================================================
// Deno Edge Function: _shared/supabase.ts
// Khởi tạo Supabase client với service role (bypass RLS)
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function adminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
