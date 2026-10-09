import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const projectRef = 'alugo-mini-locacao';
const webhookSecret = `e2e-secret-${Date.now()}`;

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options,
  });
}

function runShell(command, options = {}) {
  return execFileSync(command, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
    ...options,
  });
}

function parseStatusEnv() {
  const output = runShell('npx supabase status -o env');
  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [key, ...value] = line.split('=');
        return [key, value.join('=').replace(/^"|"$/g, '')];
      }),
  );
}

async function waitForFunction(apiUrl) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 60_000) {
    try {
      const response = await fetch(`${apiUrl}/functions/v1/simulate-payment`, {
        method: 'OPTIONS',
      });
      if (response.status === 204) return;
    } catch {
      // Aguarda runtime.
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error('Timeout aguardando funções locais.');
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
    // Processo pode já ter encerrado.
  }
}

async function main() {
  runShell('npx supabase db reset');
  const env = parseStatusEnv();
  writeFileSync(
    '.env.e2e',
    `VITE_SUPABASE_URL=${env.API_URL}\nVITE_SUPABASE_ANON_KEY=${env.ANON_KEY}\n`,
  );

  const tmp = mkdtempSync(join(tmpdir(), 'alugo-e2e-'));
  const envFile = join(tmp, 'edge.env');
  writeFileSync(
    envFile,
    `ALUGO_WEBHOOK_SECRET=${webhookSecret}\nALUGO_ENABLE_PAYMENT_SIMULATION=true\n`,
  );

  const serve = spawn(
    `npx supabase functions serve payment-webhook simulate-payment --no-verify-jwt --env-file "${envFile}"`,
    { stdio: ['ignore', 'pipe', 'pipe'], shell: true },
  );

  try {
    await waitForFunction(env.API_URL);
    const email = `admin-e2e-${Date.now()}@example.com`;
    const password = 'SenhaDemo123!';
    const signup = await fetch(`${env.API_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: env.ANON_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = await signup.json();
    if (!signup.ok) throw new Error(`Falha ao criar admin E2E: ${JSON.stringify(body)}`);

    run('docker', [
      'exec',
      `supabase_db_${projectRef}`,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-c',
      `insert into public.app_admins (user_id) values ('${body.user.id}')`,
    ]);

    execFileSync('npx playwright test', {
      encoding: 'utf8',
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, E2E_ADMIN_EMAIL: email, E2E_ADMIN_PASSWORD: password },
    });
  } finally {
    stopProcessTree(serve);
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
