import { readdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
async function files(dir) {
  const all = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = dir + '/' + item.name;
    if (item.isDirectory()) all.push(...(await files(path)));
    else all.push(path);
  }
  return all;
}
// Check only project-owned source and public build output; dependencies, test traces,
// local runtime state are excluded. Local secret values are read only for comparison and never printed.
const paths = [
  ...(await files('src')),
  ...(await files('worker')),
  ...(await files('build')),
  'README.md',
  '.dev.vars.example',
  'wrangler.jsonc',
];
const problems = [];
const localSecrets = [];
try {
  const localEnv = await readFile('.dev.vars', 'utf8');
  for (const line of localEnv.split(/\r?\n/)) {
    const match = line.match(/^(?:EMPLOYEE_CODE|GIPHY_API_KEY|OPENWEATHER_API_KEY)\s*=\s*(.*)$/);
    if (!match) continue;
    const value = match[1].trim().replace(/^(["'])(.*)\1$/, '$2');
    if (value) localSecrets.push(value);
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
for (const path of paths) {
  if (!/\.(ts|svelte|js|css|json|jsonc|html|md|example|webmanifest)$/.test(path)) continue;
  const content = await readFile(path, 'utf8');
  if (localSecrets.some((value) => content.includes(value)))
    problems.push(path + ': local secret value found');
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content))
    problems.push(path + ': private key found');
  if (/(?:sk-proj-|AKIA)[A-Za-z0-9_-]{16,}/.test(content))
    problems.push(path + ': credential pattern found');
  if (
    path.startsWith('build/') &&
    /(EMPLOYEE_CODE|GIPHY_API_KEY|OPENWEATHER_API_KEY|synthetic-test-only)/.test(content)
  )
    problems.push(path + ': server secret identifier or test fixture in client bundle');
}
assert.deepEqual(problems, []);
const ignore = await readFile('.gitignore', 'utf8');
assert.ok(ignore.includes('.dev.vars'));
assert.ok(ignore.includes('.env'));
console.log(
  `Security scan passed: ${paths.length} source/build/config files checked; no configured local secret matches, private keys, recognized credential values, or server-only secret identifiers in client output.`,
);
