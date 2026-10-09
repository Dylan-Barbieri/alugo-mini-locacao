import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const projectRef = 'alugo-mini-locacao';
const dbContainer = `supabase_db_${projectRef}`;
const edgeRuntimeContainer = `supabase_edge_runtime_${projectRef}`;
let webhookSecret = `test-secret-${Date.now()}`;
const functionUrl = 'http://127.0.0.1:54321/functions/v1/payment-webhook';

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options,
  });
}

function runShell(command) {
  return execFileSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], shell: true });
}

function dockerPsql(sql) {
  return run('docker', [
    'exec',
    '-i',
    dbContainer,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-At',
    '-c',
    sql,
  ]).trim();
}

function stopEdgeRuntime() {
  try {
    run('docker', ['stop', edgeRuntimeContainer], { stdio: 'ignore' });
  } catch {
    // Container pode não estar em execução; functions serve recria com o env-file do teste.
  }
}

function parseSupabaseStatusEnv() {
  const output = runShell('npx supabase status -o env');
  const env = Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [key, ...value] = line.split('=');
        return [key, value.join('=').replace(/^"|"$/g, '')];
      }),
  );

  if (!env.API_URL || !env.SERVICE_ROLE_KEY) {
    throw new Error('Não foi possível obter API_URL e SERVICE_ROLE_KEY do Supabase local.');
  }

  return env;
}

async function waitForFunction() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 60_000) {
    try {
      const response = await fetch(functionUrl, { method: 'GET' });
      if (response.status === 405) return;
    } catch {
      // Aguarda o Edge Runtime inicializar.
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error('Timeout aguardando payment-webhook local.');
}

async function callWebhook(body, options = {}) {
  const headers = { 'content-type': 'application/json', ...(options.headers ?? {}) };
  if (options.auth !== false) {
    headers['x-alugo-webhook-secret'] = options.secret ?? webhookSecret;
  }

  const method = options.method ?? 'POST';

  const response = await fetch(functionUrl, {
    method,
    headers,
    body:
      method === 'GET' || method === 'HEAD' ? undefined : (options.rawBody ?? JSON.stringify(body)),
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { status: response.status, data };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stopProcessTree(processToStop) {
  if (!processToStop.pid) return;

  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/pid', String(processToStop.pid), '/T', '/F'], {
        stdio: 'ignore',
      });
      return;
    }

    processToStop.kill('SIGTERM');
  } catch {
    // Processo pode já ter sido encerrado pelo runtime local.
  }
}

function prepareFixture() {
  const suffix = String(Date.now()).slice(-10);
  const clientId = '20000000-0000-4000-8000-' + suffix.padStart(12, '0');
  const vehicleId = '20000000-0000-4000-8001-' + suffix.padStart(12, '0');
  const contractId = '20000000-0000-4000-8002-' + suffix.padStart(12, '0');
  const missingInvoiceId = '29999999-9999-4999-8999-999999999999';
  const document = `TST${suffix}`;
  const plate = `W${suffix.slice(-6)}`.slice(0, 7).toUpperCase();

  dockerPsql(`
    insert into public.clientes (id, nome, documento, email, telefone)
    values ('${clientId}', 'Cliente Webhook Teste', '${document}', 'webhook.test@example.com', '+55 11 90000-9999');

    insert into public.veiculos (id, marca, modelo, placa, cor, status)
    values ('${vehicleId}', 'Haojue', 'DK 160', '${plate}', 'Preta', 'locado');

    insert into public.contratos (
      id, cliente_id, veiculo_id, valor_semanal, quantidade_semanas, data_inicio, inicio_em, fim_em, status
    ) values (
      '${contractId}', '${clientId}', '${vehicleId}', 400.00, 3, date '2026-10-10', date '2026-10-10', date '2026-10-31', 'ativo'
    );
  `);

  const invoiceId = dockerPsql(`
    select id from public.faturas
    where contrato_id = '${contractId}' and numero_parcela = 1;
  `);

  const secondInvoiceId = dockerPsql(`
    select id from public.faturas
    where contrato_id = '${contractId}' and numero_parcela = 2;
  `);

  const thirdInvoiceId = dockerPsql(`
    select id from public.faturas
    where contrato_id = '${contractId}' and numero_parcela = 3;
  `);

  return { invoiceId, secondInvoiceId, thirdInvoiceId, missingInvoiceId };
}

function getPaidAt(invoiceId) {
  return dockerPsql(
    `select coalesce(pago_em::text, '') from public.faturas where id = '${invoiceId}';`,
  );
}

async function runTests() {
  const env = parseSupabaseStatusEnv();
  const tmp = mkdtempSync(join(tmpdir(), 'alugo-webhook-'));
  const envFile = join(tmp, 'edge.env');

  stopEdgeRuntime();
  writeFileSync(
    envFile,
    [
      `ALUGO_WEBHOOK_SECRET=${webhookSecret}`,
      `SUPABASE_URL=${env.API_URL}`,
      `SUPABASE_SERVICE_ROLE_KEY=${env.SERVICE_ROLE_KEY}`,
    ].join('\n'),
  );

  const serveCommand = `npx supabase functions serve payment-webhook --no-verify-jwt --env-file "${envFile}"`;
  const serve = spawn(serveCommand, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
    shell: true,
  });

  let stderr = '';
  serve?.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForFunction();
    const fixture = prepareFixture();

    const valid = await callWebhook({
      fatura_id: fixture.invoiceId,
      valor_pago: '400.00',
      evento: 'PAYMENT_RECEIVED',
    });
    assert(
      valid.status === 200 && valid.data?.status === 'paid',
      `Pagamento válido deveria retornar 200/paid. Resultado: ${JSON.stringify(valid)}`,
    );
    const paidAt = getPaidAt(fixture.invoiceId);
    assert(Boolean(paidAt), 'pago_em deveria ser registrado');

    const duplicated = await callWebhook({
      fatura_id: fixture.invoiceId,
      valor_pago: '400.00',
      evento: 'PAYMENT_RECEIVED',
    });
    assert(
      duplicated.status === 200 && duplicated.data?.status === 'already_paid',
      'Webhook duplicado deveria retornar 200/already_paid',
    );
    assert(
      getPaidAt(fixture.invoiceId) === paidAt,
      'Webhook duplicado não deve sobrescrever pago_em',
    );

    const mismatch = await callWebhook({
      fatura_id: fixture.secondInvoiceId,
      valor_pago: '399.99',
      evento: 'PAYMENT_RECEIVED',
    });
    assert(
      mismatch.status === 409 && mismatch.data?.error === 'amount_mismatch',
      'Valor divergente deveria retornar 409',
    );

    const missing = await callWebhook({
      fatura_id: fixture.missingInvoiceId,
      valor_pago: '400.00',
      evento: 'PAYMENT_RECEIVED',
    });
    assert(missing.status === 404, 'Fatura inexistente deveria retornar 404');

    const invalidUuid = await callWebhook({
      fatura_id: 'uuid-invalido',
      valor_pago: '400.00',
      evento: 'PAYMENT_RECEIVED',
    });
    assert(
      invalidUuid.status === 400 && invalidUuid.data?.error === 'invalid_invoice_id',
      'UUID inválido deveria retornar 400',
    );

    const invalidEvent = await callWebhook({
      fatura_id: fixture.secondInvoiceId,
      valor_pago: '400.00',
      evento: 'PAYMENT_FAILED',
    });
    assert(
      invalidEvent.status === 400 && invalidEvent.data?.error === 'invalid_event',
      'Evento inválido deveria retornar 400',
    );

    const incomplete = await callWebhook({
      fatura_id: fixture.secondInvoiceId,
      evento: 'PAYMENT_RECEIVED',
    });
    assert(
      incomplete.status === 400 && incomplete.data?.error === 'missing_required_fields',
      'Payload incompleto deveria retornar 400',
    );

    const wrongMethod = await callWebhook(null, { method: 'GET', rawBody: undefined, auth: false });
    assert(wrongMethod.status === 405, 'Método incorreto deveria retornar 405');

    const missingAuth = await callWebhook(
      {
        fatura_id: fixture.secondInvoiceId,
        valor_pago: '400.00',
        evento: 'PAYMENT_RECEIVED',
      },
      { auth: false },
    );
    assert(missingAuth.status === 401, 'Requisição sem autenticação deveria retornar 401');

    const invalidAuth = await callWebhook(
      {
        fatura_id: fixture.secondInvoiceId,
        valor_pago: '400.00',
        evento: 'PAYMENT_RECEIVED',
      },
      { secret: 'segredo-incorreto' },
    );
    assert(invalidAuth.status === 401, 'Segredo inválido deveria retornar 401');

    const concurrent = await Promise.all([
      callWebhook({
        fatura_id: fixture.thirdInvoiceId,
        valor_pago: '400.00',
        evento: 'PAYMENT_RECEIVED',
      }),
      callWebhook({
        fatura_id: fixture.thirdInvoiceId,
        valor_pago: '400.00',
        evento: 'PAYMENT_RECEIVED',
      }),
    ]);
    assert(
      concurrent.every((result) => result.status === 200),
      'Notificações concorrentes deveriam retornar 200',
    );
    assert(
      concurrent.some((result) => result.data?.status === 'paid') &&
        concurrent.some((result) => result.data?.status === 'already_paid'),
      'Concorrência deveria produzir paid e already_paid',
    );

    const definition = dockerPsql(
      `select pg_get_functiondef('public.liquidar_fatura(uuid,numeric)'::regprocedure);`,
    );
    assert(definition.toLowerCase().includes('for update'), 'RPC deve manter FOR UPDATE');

    const serviceOnly = dockerPsql(`
      select has_function_privilege('authenticated', 'public.liquidar_fatura(uuid,numeric)', 'EXECUTE');
    `);
    assert(serviceOnly === 'f', 'authenticated não deve executar a RPC diretamente');

    const functionSource = readFileSync('supabase/functions/payment-webhook/index.ts', 'utf8');
    assert(
      functionSource.includes("error: 'server_not_configured'") &&
        functionSource.includes("error: 'internal_error'"),
      'A função deve manter respostas 500 controladas sem expor detalhes internos',
    );

    console.log('payment-webhook integration tests passed');
  } catch (error) {
    console.error(stderr.replace(/(SERVICE_ROLE_KEY|ALUGO_WEBHOOK_SECRET)=\S+/g, '$1=[redacted]'));
    throw error;
  } finally {
    if (serve) stopProcessTree(serve);
    rmSync(tmp, { recursive: true, force: true });
  }
}

runTests().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
