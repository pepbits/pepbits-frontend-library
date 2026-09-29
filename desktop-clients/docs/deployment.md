# Deploying the shared frontend

Web and desktop production processes serve a selected release under `../.deploy`.
`npm run build` and browser-test builds write only to the workspace. They do not
select a release or restart a service.

Requires Node 24+, npm, Bash and the existing `run.sh` host tools (`curl` and
`lsof`, or `ss` on Linux). This launcher targets a host running Node behind a
reverse proxy; it does not package a native Tauri installer or provision a SaaS
backend.

## Configure once per product or environment

From `desktop-clients`:

```bash
cp deploy.config.example.json deploy.config.json
```

Set `webApiUrl` and `desktopApiUrl` to the URLs the **visitor's browser** should
call. These public values are explicitly supplied to both bundlers; a leftover
`NEXT_PUBLIC_API_URL` or `VITE_API_URL` in the terminal cannot override them.
Same-origin paths such as `/api` work when the reverse proxy routes that path to
the backend. The `.example` URL in the template must be replaced.

Loopback URLs are refused unless `allowLocalApi: true` is deliberately configured
for a local test. Deployment config is gitignored so each copied product can use
its own hosts. No source `.env` files or backend credential files are copied into
the isolated build or release.

## Prepare, inspect, activate

```bash
npm run deploy:prepare
npm run deploy -- --activate RELEASE_ID
```

Or build and activate in one command:

```bash
npm run deploy
```

The command:

1. Takes a deployment lock and snapshots the frontend source into a temporary directory.
2. Installs the lockfile with `npm ci`, including build dependencies.
3. Builds both shells with the API URLs from deployment config.
4. Runs strict `verify:deployable` checks and the stylesheet parity check.
5. Packages Next's standalone server, its static/public assets, and the desktop SPA with a dependency-free static server.
6. Deletes the temporary build and starts each package on an isolated loopback port, checking HTML, referenced assets, and release identity.
7. Stops only web and desktop, atomically changes the `current` symlink, restarts both shells, and checks their HTML, assets, and release identity again.

`--prepare-only` ends after step 6. It never changes `current` or running services.
Build, package, or candidate-check failures likewise leave running services alone.
There is a short interruption while activation restarts the two servers; this is
not a zero-downtime deployment.

On activation failure the command restores the previous release, restarts it and
checks it before reporting failure. A failed **first** activation has no previous
release to restore and leaves both shells stopped. The API and reference apps are
not restarted. Prepared releases are retained, including failed activation
candidates, for inspection; no automatic pruning removes a rollback target.

To roll back deliberately, activate the retained release ID printed by the last
deploy. Its API URLs must still match the deployment config:

```bash
npm run deploy -- --activate PREVIOUS_RELEASE_ID
```

## Current activation on the existing demo sites — DCP designer style, 12 September 2026

Release `20260912002147213-851cb66e`, application commit `6ec329f22e589dece2894ef5b12ad4961e5ff8b0`, is the latest recorded activation on both demo sites. The API was not restarted. Previous release `20260911145802227-397d1cf5` is retained for rollback. See the [deployment evidence and hosted-CI follow-up](../../docs/releases/unreleased/dcp-style-deployment-2026-09-12.md). Current state takes precedence over the dated historical entries below; those entries describe their original activation, not multiple simultaneously active releases.

## Current isolated frontend test site — 29 September 2026

The isolated test site is [https://frontend.test.pepbits.com](https://frontend.test.pepbits.com), release `20260929080313644-1b17b579`, built from source `cb679bea5171bbc6b4c440534a3f8cf8fc27fa3c`. This release adds the separate Healthcare Suite header module. Its local frontend/API tests passed (1,903/265); targeted public checks passed 40/40 workflow and 19/19 language/preferences cases; the public web-only sweep passed 175 static and six dynamic destinations, and four local desktop-browser checks passed separately. The three isolated services are active on web port 33410, desktop-browser port 33411 and API port 33412. The previous School role-header release `20260928121228378-07561b3d` remains the rollback target, with protected source/configuration/data retained at `base/backups/healthcare-suite-20260929-cb679be`. See the [deployment record](../../docs/releases/unreleased/healthcare-suite-2026-09-29.md) and [test-site runbook](frontend-test-deployment.md). This update does not change either existing demo host or the ERP, School or healthcare services.

## First isolated frontend test site deployment — 28 September 2026

The separate test site is [https://frontend.test.pepbits.com](https://frontend.test.pepbits.com), release `20260928110944214-b5bb610f`, built from frontend source `954bf19` with API source `3ac4e922`. See the dedicated [test-site deployment runbook](frontend-test-deployment.md) and [deployment record](../../docs/releases/unreleased/frontend-test-deployment-2026-09-28.md). This site uses isolated services and an Nginx virtual host; it does not replace either existing demo site or change ERP, School or healthcare service configuration.

## Historical activation — Component Library, 9 September 2026

Release `20260909012454211-3a549a4a`, from application commit `6796689`, is active
on both demo hosts. All six CI jobs and public Library, localization, asset and
API checks passed. Previous API source and data are retained under
`.deploy/api-backups/20260909012454211-3a549a4a/`; previous frontend release
`20260908194545473-e14bcece` remains available for rollback. The API restart
invalidated existing demo sessions. See [Component Library verification](component-library.md#verified-deployment--9-september-2026).

## Earlier activation — Draft Recovery Center, 8 September 2026

Release `20260908194545473-e14bcece`, from application commit `c9fa329`, is active
on both demo hosts. All six CI jobs and public recovery-center, localization,
asset and API checks passed. The API source/data backup is
`.deploy/api-backups/20260908194545473-e14bcece/`; the previous frontend release
is `20260908185346517-40b515a2`. The API restart invalidated existing demo sessions.
See [Draft Recovery Center verification](draft-recovery-center.md#verified-deployment--8-september-2026)
for complete evidence and integration limits.

## Earlier activation — preference policies, 8 September 2026

Release `20260908132518280-e399b58e`, from application commit `6e7ad75`, is active
on both public hosts. All remote CI jobs passed before activation, including
browser and native Linux checks. The API was stopped for a consistent data
backup and restarted to enable tenant/application preference policies. Existing
demo sessions must sign in again.

Public health, login, navigation, Arabic catalogs and policy permission checks
passed. Both administrator editors displayed all 53 settings without runtime
errors; an initial desktop login timeout passed on an isolated rerun. No tenant
policy values were changed during live verification.

API data and the previous API source are retained under
`.deploy/api-backups/20260908132518280-e399b58e`. Previous frontend release
`20260908123426077-75c38ac1` remains available for rollback. See
[tenant preference policies](tenant-preference-policies.md) for the user and
integration guide, and [the previous server guide](server-completion-2026-09-08.md)
for the earlier release's production integration boundaries.

## Current host

On 7 September 2026, release `20260907163215381-b9dabe79` was activated for
`front-design.pepbits.com` and `desktop.front-design.pepbits.com`. Both public
hosts passed release-identity, HTML, asset and API-health checks. The Docker
reverse proxy keeps its existing host-bridge upstreams on ports 3100 and 3101.
The API was restarted first to enable the versioned record and recovery-draft
routes; this invalidated existing demo sessions. Public authenticated record-load
checks passed for both shells. API data and pre-record server source were backed
up under `.deploy/api-backups/20260907163215381-b9dabe79`; the previous frontend
release `20260907152207170-63028a2b` remains available for rollback.
This coordinated API restart was performed separately from the frontend deploy
command, which continues to restart only web and desktop.

## First migration of an existing host

An already-running process continues serving its old directory until it is
restarted. Preparing a release alone does **not** migrate that process. After
reviewing a prepared release, activate it to move ports 3100 and 3101 to the new
launchers. The existing reverse proxy can keep those upstreams. If it directly
serves files from `.next` or `dist`, change those file-serving rules as part of the
host migration; the application scripts cannot change an external proxy config.

After migration `./run.sh start web desktop` uses the selected release and
refuses to fall back to workspace output. `./run.sh build web desktop` still
builds locally but cannot change the selected release. `run_all.sh` delegates to
`run.sh` so the launchers cannot drift.

`MODE=dev` remains an explicit source-tree development mode. Its configured ports
must not replace public production listeners.

## Paths and isolated integration tests

```text
.deploy/
  releases/<release-id>/
    web/                  standalone Next runtime and assets
    desktop/              compiled SPA
    desktop-server.mjs    standalone static server
    release.json          release ID, build date, public API URLs
  current -> releases/<selected-release-id>
  .lock/owner.json         present only during a deployment
```

Processes resolve `current` once at startup. Changing the link cannot make an
existing process read another release's assets.

Host settings (keep identical for `deploy` and `run.sh`):

| Environment variable | Default |
|---|---|
| `NEXORA_DEPLOY_ROOT` | `.deploy` at the repository root |
| `NEXORA_WEB_PORT` | `3100` |
| `NEXORA_DESKTOP_PORT` | `3101` |
| `NEXORA_BIND_HOST` | `0.0.0.0` (also reachable by a container reverse proxy) |
| `NEXORA_RUN_DIR` | `.run` at the repository root |

For a parallel deployment test, use **both different ports and a different
`NEXORA_RUN_DIR`**. PID files from the production launcher must never be shared
with a test launcher. Deployment root must be outside `desktop-clients`.

If a process was forcibly killed and `.lock` remains, inspect its owner PID and
confirm it is no longer deploying before removing that lock directory. Ordinary
errors and handled termination signals clean up temporary builds and the lock.

## Verification

```bash
npm run test:deployment
```

These tests cover packaging without build-tree dependencies, API URL refusal,
missing/mismatched artifacts, successful activation, failed-start and failed-health
rollback, first-deploy failure, interrupted activation, partial-stop recovery, and
static-server routing/file isolation. They run in CI without starting the public
stack. `deploy:prepare` additionally runs the actual built servers.
