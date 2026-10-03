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

1. Build from a clean checkout with Node 24: the CI steps, then `npm run deploy:prepare` with
   `deploy.config.json` set to `{"webApiUrl":"/api","desktopApiUrl":"/api"}` and `NEXORA_DEPLOY_ROOT` outside the checkout.
2. Bundle the runtime as the stack README describes (`src/`, `web/`, `mock/`, `BUILD.json`), copy it to
   `releases/<release>/` on pb-srv5 through a staging folder, and record its checksum.
3. Set `FT_RELEASE=<release>` in hub `secrets/pb-srv5.frontend-test.env` and run
   `bin/deploy-stack.sh pb-srv5 frontend-test`.
4. Check release identity, `/api/health`, login and representative modules through public HTTPS, then record the
   evidence in a delivery record.

Rollback: set `FT_RELEASE` to the previous release folder and deploy again. Keep the previous folder until the new
release has been checked. Do not edit files on the server by hand; change the stack source and redeploy.

## Restricted material

Simulator keys and webhook secrets are in the hub's `secrets/` folder and the server `.env` only. Do not copy them,
TLS material or session tokens into this repository or into release evidence. The visible `admin` / `admin` sign-in
is a printed fixture credential. The site is not connected to any real clinical, financial or identity system.
