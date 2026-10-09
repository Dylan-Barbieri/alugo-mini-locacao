import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const functionUrl = 'http://127.0.0.1:54321/functions/v1/simulate-payment';
const edgeRuntimeContainer = 'supabase_edge_runtime_alugo-mini-locacao';

function runShell(command) {
  return execFileSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], shell: true });
}

async function waitForFunction() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 60_000) {
    try {
      const response = await fetch(functionUrl, { method: 'OPTIONS' });
      if (response.status === 204) return;
    } catch {
      // Aguarda o runtime local.
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
    // Processo pode já ter encerrado.
  }
}

function stopEdgeRuntime() {
  try {
    execFileSync('docker', ['stop', edgeRuntimeContainer], { stdio: 'ignore' });
  } catch {
    // Container pode não estar em execução; functions serve recria com o env-file do teste.
  }
}

async function main() {
  const env = Object.fromEntries(
    runShell('npx supabase status -o env')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [key, ...value] = line.split('=');
        return [key, value.join('=').replace(/^"|"$/g, '')];
      }),
  );
  const tmp = mkdtempSync(join(tmpdir(), 'alugo-simulation-disabled-'));
  const envFile = join(tmp, 'edge.env');
  writeFileSync(
    envFile,
    'ALUGO_WEBHOOK_SECRET=local-disabled-test\nALUGO_ENABLE_PAYMENT_SIMULATION=false\n',
  );

  stopEdgeRuntime();

  const serve = spawn(
    `npx supabase functions serve --no-verify-jwt --env-file "${envFile}" simulate-payment`,
    { stdio: ['ignore', 'pipe', 'pipe'], shell: true },
  );

  try {
    await waitForFunction();
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        apikey: env.ANON_KEY,
        authorization: `Bearer ${env.ANON_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ fatura_id: '30000000-0000-4000-8000-000000000001' }),
    });
    const body = await response.json();

    if (response.status !== 403 || body.error !== 'simulation_disabled') {
      throw new Error(
        `Esperado 403/simulation_disabled. Recebido: ${JSON.stringify({ status: response.status, body })}`,
      );
    }

    console.log('simulation-disabled smoke passed');
  } finally {
    stopProcessTree(serve);
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
