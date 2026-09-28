# Frontend public test site runbook

This runbook covers the isolated test site at [https://frontend.test.pepbits.com](https://frontend.test.pepbits.com). Its current release is `20260928121228378-07561b3d`, built from frontend/API source `9c3cea72e624dccb454cfd60fd2d0a34b774a69b`. The [School role-header deployment record](../../docs/releases/unreleased/school-role-header-2026-09-28.md) contains current verification evidence. The [first deployment record](../../docs/releases/unreleased/frontend-test-deployment-2026-09-28.md) remains the historical setup record.

## Service layout

The public DNS A record points to `145.223.23.91`, the development-server gateway. Nginx proxies to `tools02` at `148.135.138.193`. The public Nginx virtual host exposes only the web frontend over HTTPS and verifies upstream TLS using `frontend.test.pepbits.com` as SNI. The Let's Encrypt certificate was issued for the public hostname and expires on 27 December 2026.

Three new isolated systemd services use loopback ports on `tools02`:

| Process | Port | Exposure |
| --- | ---: | --- |
| Web frontend | 33410 | Gateway upstream only |
| Desktop-browser frontend | 33411 | Loopback only; not exposed publicly |
| Demo API | 33412 | Loopback only; reached through the web host's `/api` route |

The units are `pepbits-frontend-test-web.service`,
`pepbits-frontend-test-desktop.service` and
`pepbits-frontend-test-api.service`. Check or restart them on `tools02` with
the deployment operator account:

```bash
systemctl status pepbits-frontend-test-web.service
systemctl status pepbits-frontend-test-desktop.service
systemctl status pepbits-frontend-test-api.service

systemctl restart pepbits-frontend-test-api.service
systemctl restart pepbits-frontend-test-web.service
systemctl restart pepbits-frontend-test-desktop.service
```

The isolated deployment root is `/home/pepadmin/pepbits/frontend-test-20260928`;
the selected release pointer is
`/home/pepadmin/pepbits/frontend-test-20260928/releases/current`. Check the
pointer before an update and retain the prior package as a rollback target after
future deployments. The retained rollback target is `20260928110944214-b5bb610f`.
The School role-header update also retains its prior source, configuration and data
backups. Restore the matching source/configuration/data and release pointer together,
then restart only these three units and verify health. Preserve the isolated data
directory and the Nginx virtual host during an ordinary rollback.

Set `HOST=127.0.0.1` in the API service environment. The API's `HOST` setting is optional and otherwise retains its existing `0.0.0.0` default. The browser frontend must use same-origin `/api`; do not put the loopback API address into a public bundle. These processes and the virtual host are separate from ERP, School and healthcare services. The desktop-browser frontend remains a web app; this setup does not package or execute a native Tauri application.

Reference-module record mutations are held in memory and are cleared when the
isolated API restarts. Restarting the API also resets its active sessions. Other
stores and configuration for the new site are isolated from the existing demo
services.

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

Use the deployment host's private runtime notes to identify the active release and available rollback target before changing it. The private notes remain authoritative for exact host commands and unit names; this public runbook deliberately records no credentials or private server configuration. After activation or rollback, check the web release identity, assets, HTTPS certificate and API health through `/api`, then retain sanitized results under the evidence folder for that update; the current update uses `docs/releases/unreleased/evidence/school-role-header-2026-09-28/`.

Deployment and browser verification are separate from native executable checks, real-backend integration, security certification and domain/native-speaker review. See the [School role-header deployment record](../../docs/releases/unreleased/school-role-header-2026-09-28.md) for current evidence and the [first deployment record](../../docs/releases/unreleased/frontend-test-deployment-2026-09-28.md) for historical setup checks.
