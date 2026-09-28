# Isolated frontend test site deployment — 28 September 2026

Status: deployed and verified. Date UTC: 28 September 2026. Site: [https://frontend.test.pepbits.com](https://frontend.test.pepbits.com). Frontend release `20260928110944214-b5bb610f`, frontend source `954bf19`, API source `3ac4e922`. This is an isolated test site and does not supersede the existing demo-site deployment records.

## Scope and service layout

The new Nginx site exposes only the web frontend publicly over HTTPS. Public DNS for the hostname points to `145.223.23.91`, the development-server gateway. The gateway proxies to `tools02` at `148.135.138.193`; upstream TLS verification uses the frontend hostname as SNI. The public API route is same-origin `/api`.

Three isolated services use loopback ports on `tools02`: web on `33410`, desktop-browser frontend on `33411`, and API on `33412`. The API launcher accepts an optional `HOST`; its default remains `0.0.0.0`, and this instance sets `HOST=127.0.0.1`. Existing ERP, School and healthcare service definitions were not changed. The desktop-browser shell is served as a web application; no native Tauri executable was built or tested.

The site's API and data are synthetic fixtures. Its printed `admin` / `admin` login is a fixture credential, not a real account. No external production backend, real clinical or financial data, or clinical/financial certification is part of this deployment.

This was the first activation, so no earlier release was available for rollback. The selected package is under `/home/pepadmin/pepbits/frontend-test-20260928/releases/current`; preserve it as a rollback target during future updates. Removing this first deployment means stopping/removing only the three new frontend-test services and its Nginx virtual host while preserving the isolated data directory. Reference-module record mutations are in memory and are cleared by an API restart; the restart also resets active sessions. Other site stores and configuration remain isolated from existing demo services.

## Deployment and verification status

Release `20260928110944214-b5bb610f` is active on the new hostname. The same 35 route/runtime smoke checks passed directly against `tools02` and through the public HTTPS gateway using an explicit hostname-to-address mapping because the host-provider resolver retained an NXDOMAIN cache; the mapping preserved normal TLS certificate verification. These are two network-path checks of the same 35 cases, not 70 unique cases. Cloudflare authoritative DNS and public resolvers `1.1.1.1` and `8.8.8.8` returned the expected address `145.223.23.91`. The web gateway HTTPS path verifies the upstream certificate with frontend-hostname SNI.

The public HTTPS browser run passed all 152 static destinations, six dynamic URLs, four representative rendered pages and four module-header choices, with no page errors. Three read-only checks on the two existing healthcare pages also passed (Patient Query, new-patient editor and Patient 360 selector/overview); they made no writes and reported no API or page errors. The 35 route/runtime smoke checks passed directly against `tools02` and through the public HTTPS gateway. This checks the same 35 cases over two network paths, not 70 unique cases. Public browser verification used an explicit hostname-to-address mapping to bypass the host-provider resolver's cached NXDOMAIN response; normal certificate verification remained enabled.

The Let's Encrypt certificate was issued and expires **27 December 2026**. The automatic ACME renewal schedule is installed. The deploy hook `/usr/local/sbin/pepbits-frontend-test-renew.py` filters for the site lineage, securely copies certificate material to `tools02` and reloads the gateway and frontend TLS services. The manual hook/synchronization and reload check passed. No simulated 90-day renewal is claimed.

No native Tauri execution, real backend integration, clinical or financial certification, or native-speaker/domain acceptance is established by this deployment. The repository's 1,572 pending native-human reviews are unchanged.

## Evidence

Sanitized [public browser results](evidence/frontend-test-deployment-2026-09-28/public-browser/results.json), [public browser log](evidence/frontend-test-deployment-2026-09-28/public-browser.log), [healthcare read-check results](evidence/frontend-test-deployment-2026-09-28/healthcare-browser/results.json), [gateway DNS/TLS and renewal metadata](evidence/frontend-test-deployment-2026-09-28/gateway-verification.json), [direct runtime checks](evidence/frontend-test-deployment-2026-09-28/tools02-runtime-check.json), [public gateway runtime checks](evidence/frontend-test-deployment-2026-09-28/public-runtime-check.json), [gateway activation and renewal-hook result](evidence/frontend-test-deployment-2026-09-28/gateway-activation-renewal.log) and [portable browser check](evidence/frontend-test-deployment-2026-09-28/public-browser.mjs) are retained in the [evidence directory](evidence/frontend-test-deployment-2026-09-28/README.md). Private credentials, TLS keys, raw private host files and session tokens are excluded. Additional private operator facts remain in `.confg/server/frontend-test-20260928/runtime-operations.md`; that file is not release evidence and must not be copied to the repository.

The operator runbook is [Frontend public test site](../../../desktop-clients/docs/frontend-test-deployment.md). This deployment does not restart or configure the other demo services.
