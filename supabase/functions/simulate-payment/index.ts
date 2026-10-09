import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.3';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', ...corsHeaders };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function getBearerToken(header: string | null) {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'method_not_allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const webhookSecret = Deno.env.get('ALUGO_WEBHOOK_SECRET');
  const simulationEnabled = Deno.env.get('ALUGO_ENABLE_PAYMENT_SIMULATION') === 'true';

  if (!simulationEnabled) {
    return jsonResponse(403, { ok: false, error: 'simulation_disabled' });
  }

  if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
    console.error('simulate-payment: configuração obrigatória ausente');
    return jsonResponse(500, { ok: false, error: 'server_not_configured' });
  }

  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) {
    return jsonResponse(401, { ok: false, error: 'missing_authentication' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return jsonResponse(401, { ok: false, error: 'invalid_session' });
  }

  const { data: admin, error: adminError } = await supabase
    .from('app_admins')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (adminError) {
    console.error('simulate-payment: falha ao verificar admin', { code: adminError.code });
    return jsonResponse(500, { ok: false, error: 'internal_error' });
  }

  if (!admin) {
    return jsonResponse(403, { ok: false, error: 'admin_required' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { ok: false, error: 'invalid_json' });
  }

  const faturaId = (body as { fatura_id?: unknown })?.fatura_id;
  if (typeof faturaId !== 'string' || !uuidPattern.test(faturaId)) {
    return jsonResponse(400, { ok: false, error: 'invalid_invoice_id' });
  }

  const { data: fatura, error: faturaError } = await supabase
    .from('faturas')
    .select('id, valor, status')
    .eq('id', faturaId)
    .maybeSingle();

  if (faturaError) {
    console.error('simulate-payment: falha ao buscar fatura', { code: faturaError.code });
    return jsonResponse(500, { ok: false, error: 'internal_error' });
  }

  if (!fatura) {
    return jsonResponse(404, { ok: false, error: 'invoice_not_found' });
  }

  if (fatura.status !== 'aberta' && fatura.status !== 'paga') {
    return jsonResponse(409, { ok: false, error: 'invalid_invoice_status' });
  }

  const webhookUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/payment-webhook`;
  const webhookResponse = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-alugo-webhook-secret': webhookSecret,
    },
    body: JSON.stringify({
      fatura_id: fatura.id,
      valor_pago: fatura.valor,
      evento: 'PAYMENT_RECEIVED',
    }),
  });

  const webhookBody = await webhookResponse
    .json()
    .catch(() => ({ ok: false, error: 'invalid_webhook_response' }));

  return jsonResponse(webhookResponse.status, {
    ok: webhookResponse.ok,
    source: 'simulate-payment',
    webhook: webhookBody,
  });
});
