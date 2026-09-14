# Caleb Bar + Bites workflow

Preserve the existing app, menu prices, artwork, icons, and Cloudflare Worker / Durable Object / WebSocket architecture. Never run `scripts/assets.mjs`, which overwrites artwork.

After every approved app, code, or configuration change:
1. Complete and verify the change.
2. Run `python3 scripts/release-zip.py` to rebuild the release ZIP from current project files.
3. Verify the ZIP and report that it was refreshed before declaring the change complete.

The ZIP version follows `package.json`; keep the root package version in `package-lock.json` consistent. Never package secrets, `.dev.vars`, dependencies, Git data, runtime state, caches, or test output. `.dev.vars.example` must contain empty placeholders only.

Preserve LICENSE terms and its intentional public contact address exactly. A digit substring shared with EMPLOYEE_CODE is not a credential leak in that approved public address. The scanners use scripts/public-contact-allowlist.json to exempt only that exact address in LICENSE from employee-code substring checks. Do not exempt other license content, API keys, encoded credentials, or private files; never modify LICENSE automatically to satisfy a scan.

Do not commit, push, tag, create a GitHub release, or deploy without explicit authorization for that action. Rebuilding a ZIP does not authorize any of these actions. Never print secret values.
