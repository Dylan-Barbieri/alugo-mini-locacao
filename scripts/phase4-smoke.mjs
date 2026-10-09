import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const projectRef = 'alugo-mini-locacao';
const dbContainer = `supabase_db_${projectRef}`;
const webhookSecret = `phase4-secret-${Date.now()}`;

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options,
  });
}

function statusEnv() {
  const output = execFileSync('npx supabase status -o env', { encoding: 'utf8', shell: true });
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
      const response = await fetch(`${apiUrl}/functions/v1/simulate-payment`, { method: 'GET' });
      if (response.status === 405 || response.status === 401) return;
    } catch {
      // Aguarda runtime local.
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error('Timeout aguardando simulate-payment local.');
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
    // Pode já estar encerrado.
  }
}

async function main() {
  const env = statusEnv();
  const tmp = mkdtempSync(join(tmpdir(), 'alugo-phase4-'));
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
    const email = `admin-${Date.now()}@example.com`;
    const password = 'SenhaDemo123!';

    const signup = await fetch(`${env.API_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: env.ANON_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const signupBody = await signup.json();
    if (!signup.ok) throw new Error(`signup failed: ${JSON.stringify(signupBody)}`);

    run('docker', [
      'exec',
      dbContainer,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-c',
      `insert into public.app_admins (user_id) values ('${signupBody.user.id}')`,
    ]);

    const invoice = run('docker', [
      'exec',
      dbContainer,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-At',
      '-c',
      "select id from public.faturas where status = 'aberta' limit 1",
    ]).trim();

    const response = await fetch(`${env.API_URL}/functions/v1/simulate-payment`, {
      method: 'POST',
      headers: {
        apikey: env.ANON_KEY,
        authorization: `Bearer ${signupBody.access_token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ fatura_id: invoice }),
    });
    const body = await response.json();

    if (response.status !== 200 || body.webhook?.status !== 'paid') {
      throw new Error(
        `simulate-payment failed: ${JSON.stringify({ status: response.status, body })}`,
      );
    }

    console.log('phase4 smoke passed');
  } finally {
    stopProcessTree(serve);
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
