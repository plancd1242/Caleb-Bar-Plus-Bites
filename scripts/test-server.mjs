import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
// Synthetic credential used only in an isolated local test server. Never a restaurant secret.
const dir = await mkdtemp(join(tmpdir(), 'barn-tests-'));
const envFile = join(dir, 'test.env');
await writeFile(envFile, 'EMPLOYEE_CODE="synthetic-test-only"\n', { mode: 0o600 });
const child = spawn(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'dev',
    '--port',
    '8799',
    '--env-file',
    envFile,
    '--persist-to',
    join(dir, 'state'),
  ],
  { stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', async (code) => {
  await rm(dir, { recursive: true, force: true });
  process.exit(code ?? 0);
});
