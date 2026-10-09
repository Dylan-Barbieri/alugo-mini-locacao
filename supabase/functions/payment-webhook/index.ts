import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.3';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type PaymentWebhookPayload = {
  fatura_id: string;
  valor_pago: number | string;
  evento: 'PAYMENT_RECEIVED';
};

type RpcResult = {
  ok?: boolean;
  status?: 'paid' | 'already_paid';
  error?: 'invalid_input' | 'invoice_not_found' | 'amount_mismatch' | 'invalid_status' | string;
  fatura_id?: string;
  pago_em?: string;
  pago_em_sao_paulo?: string;
};

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'authorization, x-client-info, apikey, content-type, x-alugo-webhook-secret',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  ...corsHeaders,
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const moneyPattern = /^\d+(\.\d{1,2})?$/;

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function timingSafeEqual(a: string, b: string) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return diff === 0;
}

function getBearerToken(header: string | null) {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

function authenticate(request: Request) {
  const expectedSecret = Deno.env.get('ALUGO_WEBHOOK_SECRET');
  if (!expectedSecret) {
    console.error('payment-webhook: ALUGO_WEBHOOK_SECRET não configurado');
    return { ok: false as const, status: 500, error: 'server_not_configured' };
  }

  const providedSecret =
    request.headers.get('x-alugo-webhook-secret') ??
    getBearerToken(request.headers.get('authorization'));

  if (!providedSecret) {
    return { ok: false as const, status: 401, error: 'missing_authentication' };
  }

  if (!timingSafeEqual(providedSecret, expectedSecret)) {
    return { ok: false as const, status: 401, error: 'invalid_authentication' };
  }

  return { ok: true as const };
}

function parseMoneyToCents(value: unknown) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    const cents = Math.round(value * 100);
    return Math.abs(value * 100 - cents) < 1e-9 ? cents : null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!moneyPattern.test(normalized)) return null;
    const [reais, centavos = ''] = normalized.split('.');
    return Number.parseInt(reais, 10) * 100 + Number.parseInt(centavos.padEnd(2, '0'), 10);
  }

  return null;
}

function centsToNumericString(cents: number) {
  const reais = Math.trunc(cents / 100);
  const centavos = String(cents % 100).padStart(2, '0');
  return `${reais}.${centavos}`;
}

function validatePayload(value: unknown) {
  if (!value || typeof value !== 'object') {
    return { ok: false as const, error: 'invalid_payload' };
  }

  const payload = value as Record<string, unknown>;

  if (
    payload.fatura_id === undefined ||
    payload.valor_pago === undefined ||
    payload.evento === undefined ||
    payload.fatura_id === null ||
    payload.valor_pago === null ||
    payload.evento === null
  ) {
    return { ok: false as const, error: 'missing_required_fields' };
  }

  if (typeof payload.fatura_id !== 'string' || !uuidPattern.test(payload.fatura_id)) {
    return { ok: false as const, error: 'invalid_invoice_id' };
  }

  if (payload.evento !== 'PAYMENT_RECEIVED') {
    return { ok: false as const, error: 'invalid_event' };
  }

  const cents = parseMoneyToCents(payload.valor_pago);
  if (!cents || cents <= 0) {
    return { ok: false as const, error: 'invalid_amount' };
  }

  return {
    ok: true as const,
    payload: {
      fatura_id: payload.fatura_id,
      valor_pago: centsToNumericString(cents),
      evento: payload.evento,
    } satisfies PaymentWebhookPayload,
  };
}

function rpcResultToResponse(result: RpcResult) {
  if (result.ok && result.status === 'paid') {
    return jsonResponse(200, {
      ok: true,
      status: 'paid',
      fatura_id: result.fatura_id,
      pago_em: result.pago_em,
      pago_em_sao_paulo: result.pago_em_sao_paulo,
    });
  }

  if (result.ok && result.status === 'already_paid') {
    return jsonResponse(200, {
      ok: true,
      status: 'already_paid',
      message: 'Pagamento já havia sido processado.',
      fatura_id: result.fatura_id,
      pago_em: result.pago_em,
      pago_em_sao_paulo: result.pago_em_sao_paulo,
    });
  }

  if (result.error === 'invoice_not_found') {
    return jsonResponse(404, { ok: false, error: 'invoice_not_found' });
  }

  if (result.error === 'amount_mismatch') {
    return jsonResponse(409, { ok: false, error: 'amount_mismatch' });
  }

  if (result.error === 'invalid_status') {
    return jsonResponse(409, { ok: false, error: 'invalid_invoice_status' });
  }

  return jsonResponse(400, { ok: false, error: 'invalid_payment_request' });
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'method_not_allowed' });
  }

  const auth = authenticate(request);
  if (!auth.ok) {
    return jsonResponse(auth.status, { ok: false, error: auth.error });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { ok: false, error: 'invalid_json' });
  }

  const validation = validatePayload(body);
  if (!validation.ok) {
    return jsonResponse(400, { ok: false, error: validation.error });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('payment-webhook: variáveis Supabase administrativas ausentes');
    return jsonResponse(500, { ok: false, error: 'server_not_configured' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc('liquidar_fatura', {
    p_fatura_id: validation.payload.fatura_id,
    p_valor_pago: validation.payload.valor_pago,
  });

  if (error) {
    console.error('payment-webhook: falha controlada na RPC', { code: error.code });
    return jsonResponse(500, { ok: false, error: 'internal_error' });
  }

  return rpcResultToResponse(data as RpcResult);
});
