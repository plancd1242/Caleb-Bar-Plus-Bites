# 🧪 Caleb Bar + Bites — Test Report

Test date: September 7, 2026. Environment: macOS, Node 24.14.0, npm 11.9.0, SvelteKit 2.70.3, Wrangler 4.129.1, local Cloudflare workerd runtime, Playwright Chromium and WebKit.

This report records executed checks. No Cloudflare deployment, GitHub operation, physical iPad test, real payment, or real restaurant order was performed. Browser orders use an isolated temporary SQLite database and a synthetic employee credential, removed when the test server exits.

## Results

| Check                                                           | Result                                                                                          |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| SvelteKit development startup                                   | Passed                                                                                          |
| Development browser smoke and Vite → Worker API/WebSocket proxy | Passed                                                                                          |
| Production static build                                         | Passed                                                                                          |
| Svelte/TypeScript checking, including Worker bindings           | Passed — 0 errors, 0 warnings                                                                   |
| Central pricing tests                                           | Passed — 18 tests; includes 500 deterministic promotion combinations                            |
| Browser/API regression suite                                    | Passed — 39 scenarios; 1 explicit WebKit service-worker skip; 0 failed                          |
| Responsive screenshot and overflow checks                       | Passed at 1366×1024, 1024×768, 768×1024, and 390×844 in both engines                            |
| Worker/Durable Object packaging dry run                         | Passed — no deployment                                                                          |
| npm dependency audit                                            | Passed — 0 known vulnerabilities in the final audit                                             |
| Project source and public-build security scan                   | Passed — 50 files considered; no real authorization value or recognized credential values found |
| Source formatting                                               | Passed with Prettier                                                                            |
| Physical iPad, Home Screen install, actual Wi-Fi interruptions  | Not performed — manual checklist below                                                          |

No ESLint configuration is included. `npm run check` checks Svelte accessibility diagnostics and strict TypeScript; `npm run format:check` checks formatting. Neither is described as a complete accessibility or security audit.

## Executed commands

```sh
npm install
node scripts/assets.mjs
npm run types
npm run check
npm test
npm run build
npm run format
npm run format:check
npx playwright install chromium webkit
npm run test:e2e
npm run dev
node scripts/dev-smoke.mjs
npm audit --json
node scripts/security-check.mjs
npx wrangler deploy --dry-run --outdir /tmp/barn-worker-dry-run
```

Early diagnostics also ran `node scripts/test-server.mjs` directly and `BARN_TEST_EXTERNAL=1 npm run test:e2e` against that isolated server. Final regression runs use the normal self-starting test harness. The first sandboxed dependency, runtime, and audit attempts could not access the network or localhost; they were rerun with execution-tool approval. No real secrets were logged.

## Scenario coverage

### Startup, navigation, menus, and display

- Production app boots without page-level JavaScript errors in Chromium and WebKit.
- Development app boots, connects its proxied WebSocket, adds a menu item, and receives a server-priced quote. This smoke test creates no order.
- Welcome, Place Your Order, Main Menu, Kids Menu, Weather, Time, and employee authorization open correctly; welcome’s main-menu link works.
- Front/back/kids placeholder PNGs decode at their full 1000-pixel width.
- Flip to Back, Flip to Front, animation-time disabled state, and repeated flips work. Reduced motion removes rotation and shows the correct surface.
- Responsive tests verify no document horizontal overflow on Welcome and ordering, usable navigation/drawer, and the basket review control can scroll into view.
- Desktop, landscape, portrait, and narrow screenshots were captured. Welcome screenshots were visually inspected; this is not a pixel-perfect or universal-device certification.
- A deliberately missing menu resource produces an ordering fallback. A missing logo does not prevent ordering.

### Baskets, money, and special requests

- Empty basket, single item, multiple items, quantity increase/decrease, removal, menu visits, and reload persistence.
- Empty and short-name prevention, server-side name validation, customer receipt, order ID, zero tax, and payment instructions.
- Sweet/unsweet tea selection; kids milk/lemonade pricing and choices are validated by pricing tests.
- Custom requests require notes, stay `null`-priced, show a known total, and require employee pricing before preparation. Employee-confirmed prices update the customer receipt.
- Normal prices, cent-safe currency output, eligible/ineligible offers, odd/even BOGO quantities, repeated Sip & Share pairs, repeated Ultimate bundles, leftover items, kids/custom exclusions, and no stacking.
- Best promotion equals the greatest individual promotion saving across 500 deterministic baskets. Savings stay bounded and never make totals negative.
- Low edited prices cannot increase an Ultimate bundle price or let Sip & Share discount unrelated items.
- Unknown or sold-out items, invalid quantities, missing choices, oversized notes, and empty custom descriptions are rejected.

### Orders, authorization, and realtime

- Separate customer and employee browser sessions exchange orders through the actual local Worker and Durable Object.
- Order status advances NEW → ACCEPTED → MAKING → READY → COMPLETED and updates the customer without a manual refresh.
- Completed orders appear in history. Customer receipts survive reload; Start another order clears the finished checkout.
- An unrelated customer session cannot see another customer’s orders.
- Empty/wrong employee codes fail. Correct synthetic code unlocks. Protected API calls without authorization fail. Relock removes employee access.
- The normal lower-left logo tap does not authorize or navigate. Holding for approximately two seconds opens authorization.
- Menu availability, fixed-price editing, restaurant open/closed, and custom-price confirmation work across connected screens.
- Employee Station Management, Display Settings, and System Settings screens render. Physical Wake Lock behavior is not claimed as verified.
- The development server with no `EMPLOYEE_CODE` returns a clear 503 setup message; it does not install a client-side fallback code.
- Tampered client totals, empty names, invalid quantities, and untrusted-origin mutations are rejected.
- Two simultaneous submissions with the same checkout ID create one receipt.
- A lost acknowledgment test forwards the POST to the real server, drops its response, and retries. The customer sees no premature confirmation, retains the basket, then receives the original order. Only one stored order exists.
- Failed requests that never reach the server retain their items and permit editing only after a backend receipt check.
- Failed submission survives full reload with editing locked until that check finishes.
- Clearing the customer cookie after acceptance cannot create a second order with the original checkout ID or expose the previous session’s order details.

### Offline, optional services, and damaged storage

- Denied geolocation and an unavailable weather endpoint produce fallback text without affecting ordering.
- Missing GIPHY configuration returns `{ url: null }`; no animation key is necessary for confirmation.
- Blocked browser storage is simulated by making all Storage accessors throw. The app still sends and displays a backend-acknowledged order with no page JavaScript errors.
- Malformed saved basket JSON and malformed checkout fields do not crash the app.
- Manifest standalone configuration, PNG icon responses, and Apple touch metadata are checked in both engines.
- Chromium verifies real service-worker activation, offline reload with decoded cached menu, offline cart persistence, Offline state, and reconnection.
- No real GIPHY key was available; a successful live GIPHY response was not tested. Weather denial/network failures were automated; real geolocation accuracy and provider availability are not guaranteed by these tests.

## Bugs and testing issues found and resolved

1. **Worker SPA fallback:** the initial adapter used `200.html`; Worker static SPA routing needs `index.html`. Fixed adapter output; the normal automated test-server startup now succeeds.
2. **Narrow ordering overflow:** a grid child’s minimum width allowed horizontal category tabs to expand the page. Added `min-width: 0`; portrait and narrow overflow checks pass.
3. **Request stream after early rejection:** unauthorized requests could leave a body stream crossing the Durable Object boundary after a response. The Worker now fully consumes a bounded body before forwarding it. Final browser runs are free of those server errors.
4. **Reserved WebSocket close code:** abrupt disconnect could echo code 1005, which cannot be sent. Close handling normalizes reserved codes to 1000.
5. **Duplicate bootstrap session:** two initial session calls could race. Bootstrap now owns the single session request and restores receipts afterward.
6. **Reconnect timer loop risk:** intentionally replacing a socket could schedule another reconnect. Old close handlers are cleared and connection setup is guarded.
7. **Storage failure on success:** a failed local cleanup could hide a received order. Storage cleanup is guarded independently of backend acknowledgment.
8. **Expired-session retry:** idempotency originally included the session ID. Checkout IDs are now checked across the restaurant, with a protected recovery endpoint that blocks reuse after session loss.
9. **Edited-price promotion edge case:** Sip & Share could consume unrelated-item value at unusually low prices. Each pair’s savings are capped at that pair’s value.
10. **Accessibility diagnostic:** replaced an inappropriate dialog element with a native modal dialog, including native focus management.
11. **Dependency advisory:** the initial dependency tree included a low-severity cookie advisory. A compatible patched override eliminated it; final audit reports zero vulnerabilities.
12. **Offline typography:** external font loading was replaced with locally bundled licensed fonts.
13. **Optional precache resources:** missing menu/icon assets no longer prevent installation of the core app shell; optional precaching settles failures separately.
14. **Test interception:** a cached menu correctly masked the first network-abort image test; the test now requests an actually missing file. Network-failure scenarios block service workers to avoid WebKit interception limitations.
15. **Test assertions:** SvelteKit normalizes an icon URL to absolute form, so the metadata test now validates its pathname suffix. The initial browser test attempt also required downloading the matching Playwright browser versions.

16. **Narrow welcome typography:** hiding a line break joined “to” and “Caleb’s” on the phone layout. Retained the break and adjusted the narrow heading size; reran the narrow viewport checks in both engines.

## Explicit automation limitation

Playwright documents service-worker automation as supported only on Chromium-based browsers: [Playwright service workers](https://playwright.dev/docs/service-workers). Attempting offline reload in its WebKit engine produced an internal automation error. The WebKit service-worker/offline test is explicitly skipped, not counted as passed. WebKit still runs ordering, realtime, failure recovery with intercepted requests, layout, menus, authorization, and manifest/icon checks.

These tests do not prove iPad Home Screen installation, Safari storage retention, physical gesture behavior, or real network recovery. The skipped check must be completed on the intended iPads.

## 📱 Manual acceptance checklist

1. Replace all three placeholder menus with the original high-resolution PNGs and remove the placeholder notice. Verify the front, back, and kids pages match the printed prices and are readable with pinch zoom.
2. Privately configure the real employee code. On two iPads at the same HTTPS app address, verify unauthorized access, unlock, relock, and station roles.
3. Use Add to Home Screen on both devices. Check the logo, standalone display, safe areas, keyboard, portrait/landscape rotation, scrolling, drawer, and menu flip.
4. Send an order on the customer iPad. Confirm its number, name, items, price, and every status on the employee iPad. Discuss and confirm a custom request price before preparation.
5. Disable and restore Wi-Fi while browsing, before sending, and immediately after sending. Verify cached menus, saved cart, honest connection state, and no duplicate order after retry.
6. Close and reopen the installed app offline after a successful online visit. This is the key unverified Safari service-worker scenario.
7. Verify Screen Wake Lock where supported, background/foreground reconnect, device sleep/wake, and reduced-motion behavior.
8. Verify live location permission denial and approval; enable a real GIPHY key only if desired and test its failure and success.
9. Confirm the documented one-promotion policy and main-menu-only eligibility with Caleb before real service.

## Remaining product limits

- Original illustrated menu attachments still need to be copied into the documented paths.
- The real employee secret is not configured; tests do not use the requested real value.
- No Cloudflare account, domain, deployment, real TLS connection, or production storage restart was exercised. SQLite-backed persistence is implemented and used by the local runtime; production restart/hibernation behavior needs deployment acceptance.
- Order history currently reads retained orders without pagination, archival, or retention cleanup. This is appropriate for a first small-restaurant build, not validated for large long-running workloads.
- Shared employee access is not an individual staff account or audit-identity system. Login throttling is implemented, but a public-service abuse/load test was not performed.
- The application does not collect online payments or track whether cash was received.
- The custom source-available license is included as requested; third-party components retain their own licenses.

See [README.md](README.md) for the architecture, secret configuration, exact replacement assets, and local commands.

## September 8, 2026 — Supplied logo replacement

Used the supplied 1254 × 1254 PNG directly. `static/icons/logo.png` is byte-for-byte identical to the source attachment. Generated full-composition, uncropped PNGs at 512 × 512, 192 × 192, 180 × 180 (Apple), and 48 × 48 (favicon). Removed the previous SVG and changed both in-app logo references to PNG. Manifest icons use `purpose: any` so the detailed border is not advertised as safe for arbitrary masks.

Checks performed for this branding-only change:

- `npm run build`: passed, including the final header aspect-ratio correction.
- `npm run check`: passed, zero errors and warnings.
- Chromium and WebKit production-preview checks: both logo locations decoded the new image; favicon and Apple links pointed to the new assets; no page JavaScript errors.
- Both engines verified square, undistorted header rendering at 1024px and 1366px widths.
- All five PNG URLs returned HTTP 200, the PNG content type, and bytes matching their files. Image dimensions and manifest declarations matched.
- Chromium service-worker cache contained the new logo, favicon, and three app icons, without the removed SVG.
- Visually inspected the 512px icon and the in-app screenshot. The complete illustrated composition and neon border are retained.
- Searched application source, static assets, scripts, documentation, and production output: no old logo path or serving-dome branding references remained.
- SHA-256 comparison verified menu images, ordering, employee controls, menu data, pricing, and backend files were unchanged. GitHub was not accessed.

Only the icon generator was run (`node scripts/icons.mjs`); the menu-generating asset script was not executed. Physical Home Screen icon refresh on an already-installed iPad remains a device check; this change was verified in local browser previews.
