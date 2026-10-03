# Frontend test site on the rebuilt fleet — 3 October 2026

Status: deployed and publicly verified. Date UTC: 2026-10-03.
Source commit: `74c6d28` (application) on base `22a994c`; test-only follow-up `b8b5cad`. Tag: not created.
Release: `20261003174859147-af92ebb2`. Simulators: `pepbits-mocking-app` `5ced4f8b021aa317859e6999d7c96ef14af63ee1`.
Testing-guide version: [current testing guide](../../testing/README.md). Executor: Claude Code on the fleet hub; no remote CI run.

## Changes and user impact

The DEV fleet was reinstalled on 3 October 2026, which removed the previous `tools02` systemd deployment and its gateway
virtual host. `https://frontend.test.pepbits.com` now runs as Docker stack `frontend-test` on pb-srv5
(`148.135.138.193`) behind the shared pb-srv5 edge Caddy. Cloudflare `A frontend.test` was changed by the owner from
`145.223.23.91` to `148.135.138.193` (DNS only). Users see the current `main` application, including SurgiSuite and all
30 header modules; the demo API and the payment, insurance and collection simulators are available as before.

Two test-only source fixes were committed: the MedBand source-parity suite now skips cleanly when the original source
tree is absent (`74c6d28`), and the AI dispatch browser suite matches its configuration fixture behind an API prefix
such as `/api` (`b8b5cad`). No runtime behavior changed.

## Installation and compatibility

Stack source: `pepbits-shared-document` `common/deployment/config/stacks/pb-srv5/frontend-test/` (commit `f130192`),
deployed with the fleet `bin/deploy-stack.sh`. Operation, release layout and rollback are in the
[test site runbook](../../../desktop-clients/docs/frontend-test-deployment.md). The browser uses same-origin `/api`;
the API accepts browser origins only from `https://frontend.test.pepbits.com`.

## Data, errors and security

No schema migration. Demo state starts empty under `/data/docker/frontend-test/data/` on pb-srv5; earlier synthetic
writes from the removed deployment were not recoverable and were not migrated. Simulator API keys and webhook secrets
were newly generated and live only in the hub secret file and the server `.env`. No container port is published;
only the edge Caddy (80/443) is public. Shared Postgres, Kafka, Redis and OpenSearch are not used.

## Verification and limits

Run on the hub from a clean clone of `74c6d28` with Node 24.21.0, following `.github/workflows/ci.yml`:

| Scope | Result |
| --- | --- |
| Documentation contracts, typecheck (all packages) | passed |
| Unit tests (Vitest) | 229 files passed, 2 skipped; 2,557 tests passed, 7 skipped. The first run at `22a994c` failed one file (MedBand parity, missing source tree) — fixed by `74c6d28` |
| API, suite-registry and deployment lifecycle tests, both production builds, all `verify:*` gates | passed |
| `deploy:prepare` packaged-release smoke checks | passed |
| Browser group `browser` against the packaged web/desktop builds through same-origin `/api` routing, isolated API data | 9/9 (AI dispatch after `b8b5cad`; `workspace` run with the desktop origin) |
| Browser group `navigation` against the packaged web build, fresh fixture API per suite | 12/18 passed (MedSlot, SurgiSuite, RCM reference and localization, Tenant Admin/MedBand reference and localization, Pharmacy reference, Quality reference and localization, Teleconsult reference, School role header, Healthcare Suite) |
| Public HTTPS after cutover | Let's Encrypt certificate for the hostname (valid to 1 January 2027), HTTP→HTTPS 308, release identity, `/api/health`, login 200 |
| Public authenticated browser check | 30 header modules listed; RCM Workspace, SurgiSuite, Healthcare Suite, Pharmacy-1, School Administrator and Finance opened with content and no API errors |

Open failures, not caused by deployment: `pharmacy-localization` (Malayalam field label not found), `teleconsult-localization`
(state assertion), `diagnostic-reference` and `diagnostic-localization` (sidebar "Expand navigation" button not found),
`reference-modules` (width 384 vs expected 175) and `backend-navigation` (desktop step timeout). These suites had not
been browser-run on this source before; they need a separate fix. The CI feature-browser job does not set `E2E_BASE`,
so on GitHub those suites target port 3100, where nothing runs.

Not covered: native Tauri execution, Firefox/WebKit, live payer/payment/clinical integrations, native-language review
and production acceptance. The desktop-browser shell is not deployed publicly.

## Upgrade, rollback and publication

Commits `74c6d28` and `b8b5cad` are on local `main` and not yet pushed. No artifact was published to a registry. The
release bundle (checksum
`55b2deb230db753717495a94c942c741dbec8e3a2a6e6d9ccfd99806e94213e0`, zstd tar) is staged on pb-srv5 under
`releases/20261003174859147-af92ebb2/`. There is no earlier release on the new host to roll back to; a rollback is a
redeploy of a previous release folder (see runbook). The hub-local trial services used during verification were stopped
and disabled.
