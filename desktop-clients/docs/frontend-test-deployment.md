# Frontend public test site runbook

This runbook covers the isolated test site at [https://frontend.test.pepbits.com](https://frontend.test.pepbits.com).
Its current release is `20261003174859147-af92ebb2` from source `74c6d28`; see the
[3 October 2026 delivery record](../../docs/releases/unreleased/frontend-test-pb-srv5-2026-10-03.md).

The DEV fleet was reinstalled on 3 October 2026. The earlier layout (gateway Nginx → `tools02` systemd units under
`/home/pepadmin/pepbits/frontend-test-20260928`) no longer exists; records before that date describe it historically.
Fleet-wide facts (servers, access, firewall, edge) live in `pepbits-shared-document/common/deployment/`, and the
stack source with its operating README in `common/deployment/config/stacks/pb-srv5/frontend-test/`.

## Service layout

DNS: Cloudflare `A frontend.test → 148.135.138.193` (pb-srv5), DNS only. The pb-srv5 edge Caddy (healthcare stack)
terminates HTTPS with an automatically renewed Let's Encrypt certificate and reads
`/data/docker/edge/products/frontend-test.caddy`: `/api/*` goes to the demo API with the prefix stripped, everything
else to the web shell. Stack `/data/docker/frontend-test` runs five containers in one network namespace:

| Container | Port (inside the namespace) | Role |
| --- | ---: | --- |
| `frontend-test-net` | — | Namespace on the `pepbits-edge` network; nothing published |
| `frontend-test-web` | 33410 | Next.js standalone web shell |
| `frontend-test-api` | 33412 | Demo API (`dummy-api`) |
| `frontend-test-mockpay` | 33413 | Payment/refund simulator and MockIns insurance |
| `frontend-test-collection` | 33414 | Collection simulator |

The desktop-browser shell is not deployed publicly. The browser bundle uses same-origin `/api`, and the API accepts
browser origins only from `https://frontend.test.pepbits.com` (`NEXORA_ALLOWED_ORIGINS`); requests from any other
origin get 403.

## Operations

Run from the fleet hub (`/home/pepadmin/pb/tools/pepbits-dev-server`):

```bash
ssh pb-srv5 'cd /data/docker/frontend-test && docker compose ps'
ssh pb-srv5 'cd /data/docker/frontend-test && docker compose logs -f --tail 100 api'
ssh pb-srv5 'cd /data/docker/frontend-test && docker compose restart api web'
curl -s https://frontend.test.pepbits.com/__nexora-release.json
curl -s https://frontend.test.pepbits.com/api/health
```

Restarting the API resets sessions; users sign in again. Demo state is synthetic and stays under `data/`.

## Deploying a release

Every push to `main` deploys automatically through the repository [`Jenkinsfile`](../../Jenkinsfile) on
`jenkins.pepbits.com` (pb-srv2). Other branches and pull requests run the same gates without deploying:

1. The GitHub Actions `check` gates in `node:24-bookworm` containers (documentation, typecheck, unit, API with the
   pinned simulators, deployment lifecycle, build, `verify`).
2. `npm run deploy:prepare` with `deploy.config.json` = `{"webApiUrl":"/api","desktopApiUrl":"/api"}`.
3. [`scripts/ci/package-test-site.sh`](../scripts/ci/package-test-site.sh) bundles the runtime (`src/`, `web/`,
   `mock/`, `BUILD.json`) into `frontend-test-<release>.tar.gz` with a SHA-256 file.
4. The archive is streamed over SSH (credential `frontend-test-deploy`, host key pinned in
   [`deploy/pb-srv5/known_hosts`](../../deploy/pb-srv5/known_hosts)) to the pb-srv5 receiver, whose forced command
   verifies, activates and health-checks it, and restores the previous release on failure.
5. The pipeline waits until the public site reports the new release identity.

Builds run one at a time; pb-srv2 has two CPUs, so a full build takes considerably longer than on a workstation.
The receiver, its manual use and rollback are documented with the stack in `pepbits-shared-document`
(`common/deployment/config/stacks/pb-srv5/frontend-test/README.md`). Record browser acceptance for a release in a
delivery record; the pipeline's own checks do not replace the browser suites.

## Restricted material

Simulator keys and webhook secrets are in the hub's `secrets/` folder and the server `.env` only. Do not copy them,
TLS material or session tokens into this repository or into release evidence. The visible `admin` / `admin` sign-in
is a printed fixture credential. The site is not connected to any real clinical, financial or identity system.
