// ============================================================
// Deno Edge Function: _shared/cors.ts
// CORS cho các Edge Function của APES Lab
// ============================================================

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

// ============================================================
// Khai báo `serve` để typecheck được ngoài môi trường Deno Edge Runtime.
//
// Runtime của Supabase cung cấp sẵn global `serve`. Ta khai báo lại ở đây
// để `deno check` chạy được trên máy dev (JSR bị chặn trong một số môi
// trường mạng). Khai báo này KHÔNG thay đổi hành vi lúc chạy.
// ============================================================
export type EdgeHandler = (req: Request) => Response | Promise<Response>;

declare global {
  // eslint-disable-next-line no-var
  var serve: (handler: EdgeHandler) => void;
}
