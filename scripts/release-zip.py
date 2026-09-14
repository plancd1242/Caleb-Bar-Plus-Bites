"""Build and verify a source release from current files, never from an old ZIP."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from urllib.parse import quote
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ROOT_FILES = {
    'AGENTS.md', 'LICENSE', 'README.md', 'TESTING.md', 'THIRD_PARTY.md',
    'package.json', 'package-lock.json', 'wrangler.jsonc', 'worker-configuration.d.ts',
    'vite.config.ts', 'vitest.config.ts', 'playwright.config.ts', 'svelte.config.js',
    'tsconfig.json', '.gitignore', '.prettierrc.json', '.prettierignore', '.dev.vars.example',
}
DIRS = ('src', 'worker', 'static', 'scripts', 'tests')
SKIP_DIRS = {'.git', 'node_modules', '__pycache__', '.wrangler', '.svelte-kit',
             'build', 'test-results', 'playwright-report', '.cache', '.idea', '.vscode'}
KEYS = {'EMPLOYEE_CODE', 'GIPHY_API_KEY', 'OPENWEATHER_API_KEY'}
PUBLIC_CONTACTS = json.loads((ROOT / 'scripts/public-contact-allowlist.json').read_text())

def employee_scan_content(name, data):
    # Only the exact owner-approved public email in LICENSE is exempt from
    # employee-code substring matching. API keys and encoded secrets are not exempt.
    allowed = PUBLIC_CONTACTS.get(name, []) if name == 'LICENSE' else []
    return re.sub(
        rb"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
        lambda m: b'' if hashlib.sha256(m[0]).hexdigest() in allowed else m[0], data,
    )

def has_secret(name, data, secrets):
    for key, value in secrets.items():
        if not value:
            continue
        raw = value.encode()
        literal_content = employee_scan_content(name, data) if key == 'EMPLOYEE_CODE' else data
        if raw in literal_content or quote(value, safe='').encode() in literal_content:
            return True
        if base64.b64encode(raw) in data or raw.hex().encode() in data:
            return True
    return False

def env_values(path):
    values = {}
    for line in path.read_text().splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        match = re.fullmatch(r'\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*', line)
        if not match:
            raise ValueError('Secret/template file has unsupported syntax; inspect privately.')
        value = match[2]
        if value.startswith(('"', "'")):
            if len(value) < 2 or value[-1] != value[0]:
                raise ValueError('Secret/template quoting needs private inspection.')
            value = value[1:-1]
        values[match[1]] = value
    return values

def main():
    version = json.loads((ROOT / 'package.json').read_text())['version']
    assert re.fullmatch(r'\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?', version)
    lock = json.loads((ROOT / 'package-lock.json').read_text())
    assert lock['version'] == lock['packages']['']['version'] == version
    template = env_values(ROOT / '.dev.vars.example')
    assert set(template) == KEYS and not any(template.values()), 'Template must be empty'
    local = ROOT / '.dev.vars'
    if not local.exists():
        raise ValueError('Private local secret source required for release comparison scan.')
    secrets = env_values(local)
    paths = [ROOT / name for name in sorted(ROOT_FILES)]
    for directory in DIRS:
        for current, dirs, names in os.walk(ROOT / directory, followlinks=False):
            assert not any((Path(current) / d).is_symlink() for d in dirs), 'Unexpected symlink'
            dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
            for name in sorted(names):
                if name == '.DS_Store' or name.startswith('._') or name.endswith(('.pyc', '.tmp', '.log', '.swp', '~')):
                    continue
                paths.append(Path(current) / name)
    payload = {}
    for path in paths:
        assert path.is_file() and not path.is_symlink(), 'Missing file or unexpected symlink'
        name = path.relative_to(ROOT).as_posix()
        if path.name != '.dev.vars.example':
            assert not re.search(r'(^|/)(\.env|\.dev\.vars|\.npmrc|credentials)([./]|$)|\.(pem|key|p12|pfx|zip)$', name, re.I), 'Unsafe release filename'
        data = path.read_bytes()
        assert not has_secret(name, data, secrets), 'Configured secret match in release input'
        assert not re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:sk-proj-|AKIA)[A-Za-z0-9_-]{16,}', data), 'Credential pattern in release input'
        payload[name] = data
    assert b'port: 1567' in payload['vite.config.ts']
    assert b"target: 'http://127.0.0.1:8787', ws: true" in payload['vite.config.ts']
    target = ROOT / f'Caleb-Bar-Plus-Bites-v{version}.zip'
    fd, temporary = tempfile.mkstemp(suffix='.zip', dir=ROOT)
    os.close(fd)
    try:
        with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name, data in sorted(payload.items()):
                archive.writestr(name, data)
        with zipfile.ZipFile(temporary) as archive:
            assert archive.testzip() is None
            assert set(archive.namelist()) == set(payload)
            for name, expected in payload.items():
                actual = archive.read(name)
                assert actual == expected
                assert not has_secret(name, actual, secrets)
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print(f'Verified {target.name}: {len(payload)} current files, {target.stat().st_size} bytes.')
    print('Excluded local secrets, dependencies, Git data, caches, old ZIPs and test output.')

if __name__ == '__main__':
    main()
