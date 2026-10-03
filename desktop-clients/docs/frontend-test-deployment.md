# Frontend public test site runbook

This runbook covers the isolated test site at [https://frontend.test.pepbits.com](https://frontend.test.pepbits.com). Its current release is `20261001-rcm-01`; see the [RCM Workspace and MedBand correction](../../docs/releases/unreleased/rcm-reference-2026-10-01.md), [973-file source manifest](../../docs/releases/unreleased/rcm-reference-source-2026-10-01.json) and [server verification](../../docs/releases/unreleased/evidence/rcm-reference-2026-10-01/server-verification.json). The immediately previous rollback release is `20261001-access-01`; its [Access record](../../docs/releases/unreleased/access-reference-2026-10-01.md) remains historical evidence. Earlier Pharmacy, Quality, Teleconsult, diagnostics and Healthcare Suite records retain their original acceptance scopes. All eight public module suites passed on the current release; an additional legacy provider-flow fixture guard is recorded separately and not counted as completed acceptance.

## Service layout

The public DNS A record points to `145.223.23.91`, the development-server gateway. Nginx proxies to `tools02` at `148.135.138.193`. The public Nginx virtual host exposes only the web frontend over HTTPS and verifies upstream TLS using `frontend.test.pepbits.com` as SNI. The Let's Encrypt certificate was issued for the public hostname and expires on 27 December 2026.

Five isolated systemd services use loopback ports on `tools02`:

| Process | Port | Exposure |
| --- | ---: | --- |
| Web frontend | 33410 | Gateway upstream only |
| Desktop-browser frontend | 33411 | Loopback only; not exposed publicly |
| Demo API | 33412 | Loopback only; reached through the web host's `/api` route |
| Insurance/payment provider simulator | 33413 | Loopback only |
| Collection provider simulator | 33414 | Loopback only |

The frontend/API units are `pepbits-frontend-test-web.service`,
`pepbits-frontend-test-desktop.service` and
`pepbits-frontend-test-api.service`. Check or restart them on `tools02` with
the deployment operator account. Provider unit names and commands are recorded in the private runtime notes:

```bash
systemctl status pepbits-frontend-test-web.service
systemctl status pepbits-frontend-test-desktop.service
systemctl status pepbits-frontend-test-api.service

systemctl restart pepbits-frontend-test-api.service
systemctl restart pepbits-frontend-test-web.service
systemctl restart pepbits-frontend-test-desktop.service
```

The isolated deployment root is `/home/pepadmin/pepbits/frontend-test-20260928`; the selected release pointer is `/home/pepadmin/pepbits/frontend-test-20260928/releases/current`. Check the pointer before an update and retain the prior package as a rollback target. The current rollback target is `20261001-access-01`. The accepted RCM stage retains a private backup of matching prior source, configuration and data. Restore matching source/configuration and the release pointer together, then restart only the isolated units and verify health. Preserve current data during an ordinary rollback; restoring the pre-cutover data archive is a separate recovery decision that can discard later synthetic writes. Preserve the Nginx virtual host.

Set `HOST=127.0.0.1` in the API service environment. The API's `HOST` setting is optional and otherwise retains its existing `0.0.0.0` default. The browser frontend must use same-origin `/api`; do not put the loopback API address into a public bundle. These processes and the virtual host are separate from ERP, School and healthcare services. The desktop-browser frontend remains a web app; this setup does not package or execute a native Tauri application.

Healthcare Suite source mutations and retry records persist alongside a separate RCM state file. Atomic file replacement and a single-writer lease protect the synthetic service; verify that no writer is live before recovering an unrecognized writer lock. Six authenticated HQ/Dubai workspace, patient and invoice hashes were preserved during the earlier RCM restart check; three existing clinical/financial data files were preserved during diagnostic activation. LIS1/LIS2/RIS1 use persistent SQLite databases isolated by module, tenant, application and branch under the demo data directory. Quality uses the same trusted partition pattern with its own persistent SQLite store, transactional commands/audit and retry evidence. Authority transmissions are simulated. Teleconsult Provider and Patient share durable JSON state isolated by trusted tenant/application/branch. Other reference-module mutations retain their existing memory-only behavior. Restarting the API resets active sessions, so operators must sign in again. The provider simulators configure a maximum of five payers and AED flows; their services and private configuration were not replaced during the diagnostic and sidebar updates.

## DNS and HTTPS checks

Verify the A record from authoritative DNS and at independent public resolvers when the site appears unreachable. At deployment time, Cloudflare authoritative nameservers, `1.1.1.1` and `8.8.8.8` returned `145.223.23.91`; the host provider resolver still cached NXDOMAIN. A resolver-specific stale negative result should be recorded as a DNS propagation/cache issue, not treated as evidence that the site points at a different server. Public browser verification can use an explicit hostname-to-address mapping while still validating the real hostname and TLS certificate; never disable certificate validation to work around DNS.

Check the public HTTPS certificate, the Nginx upstream certificate verification/SNI configuration and the same-origin `/api` response after changes. Only the web site is a public service; the API and desktop-browser server must remain loopback-bound.

## Certificate renewal

Certbot has an automatic ACME renewal schedule. Its deploy hook is `/usr/local/sbin/pepbits-frontend-test-renew.py`; the hook filters for this site's certificate lineage, copies renewed certificate material securely to `tools02`, then reloads the gateway and frontend TLS services. A manual hook/synchronization check and both proxy reloads passed during setup. That verifies hook behavior only; no 90-day renewal was simulated.

For a renewal investigation, check the Certbot timer/logs on the gateway, confirm the hook matched this lineage, verify the renewed certificate reached `tools02`, and inspect the gateway and upstream TLS service reload results. Then validate the public certificate and HTTPS route. Do not place private keys or raw private host files in repository evidence.

## Restricted operations material and demo data

The private deployment notes at `.confg/server/frontend-test-20260928/runtime-operations.md` contain additional host-specific checks. Keep that operator file on the deployment host. Sanitized runtime summaries are retained under `docs/releases/unreleased/evidence/frontend-test-deployment-2026-09-28/`. Do not copy private credentials, TLS keys, raw private files or session tokens into this runbook, Git or release evidence.

The API and its data are synthetic demo fixtures. The visible `admin` / `admin` login is a printed fixture credential and does not identify a real account. The test site is not connected to a real clinical or financial backend and has no clinical or financial certification.

## Deployment and rollback

Record frontend and API source identities, release identity and the isolated service configuration whenever deploying an update. Keep the public route on HTTPS, preserve `/api` as the browser-facing API prefix, and verify the deployed release identity and assets before running browser checks. Do not restart or reconfigure the existing ERP, School or healthcare services as part of this site's maintenance.

Use the deployment host's private runtime notes to identify the active release and available rollback target before changing it. The private notes remain authoritative for exact host commands and unit names; this public runbook deliberately records no credentials or private server configuration. After activation or rollback, check release identity, assets, HTTPS and API health through `/api`, then retain sanitized results under the evidence folder linked from the [current deployment record](../../docs/releases/unreleased/rcm-reference-2026-10-01.md). Retain navigation abort records as well as errors: current diagnostic/original Suite acceptance retained 8/0, while the earlier RCM/original runs retained 12/6.

Deployment and browser verification are separate from native executable checks, real-backend integration, security certification and domain/native-speaker review. See the [RCM Workspace/MedBand delivery record](../../docs/releases/unreleased/rcm-reference-2026-10-01.md) for current evidence and the [sidebar correction record](../../docs/releases/unreleased/sidebar-navigation-2026-10-01.md) for historical sidebar evidence, the [RCM record](../../docs/releases/unreleased/healthcare-suite-rcm-2026-09-29.md) and [School role-header record](../../docs/releases/unreleased/school-role-header-2026-09-28.md) for prior-release evidence, and the [first deployment record](../../docs/releases/unreleased/frontend-test-deployment-2026-09-28.md) for historical setup checks.
## Access modules deployment — 1 October 2026

That historical deployment selected release `20261001-access-01`; web and desktop-browser release markers agree. The 858-file source snapshot and eleven configuration overlays were verified on the server before public acceptance. Backend runtime dependencies are packaged separately; staging must also carry the exact pinned TypeScript compiler needed for source-to-generated verification. A deployment host is not expected to contain build dependencies. Check this before maintenance; never skip a failed source check or install an unpinned compiler into the active release.

Stage with synthetic temporary data, check all embedded services, retain the matching prior source/config/release and a guarded data backup, activate only the isolated test units, and verify HTTPS identity and actual authenticated module workflows. The [validation receipt](../../docs/releases/unreleased/evidence/access-reference-2026-10-01/validation.json) retains the accepted results and the first staging failure. No server DNS changes or package downloads were required. Native execution and live clinical/financial integrations remain separate.

## RCM Workspace deployment — 1 October 2026

The current release `20261001-rcm-01` verified all 973 frozen source files and eleven configuration overlays. Include the pinned TypeScript compiler in staging before maintenance; it is a deterministic source-verification dependency. Stage and exercise embedded APIs with temporary synthetic data before stopping only the three isolated frontend-test units. Retain matching prior source/config/release and a guarded data backup. Activate, check both release markers and API health, then execute authenticated public acceptance.

RCM Workspace data is durable SQLite isolated by trusted tenant/application/branch. Source operational/currency filters do not supply ownership. Preserve both these stores and existing Healthcare Suite JSON during updates; three Healthcare files remained unchanged at this cutover. Provider-simulator services and other application deployments were untouched. Post-cutover evidence documents are finalized separately from the immutable deployed source manifest. Current receipts and all eight public module results are linked from the delivery record. Native execution, live provider integration and native/domain approval remain separate.
