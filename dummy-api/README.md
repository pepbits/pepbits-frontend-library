# Enterprise demo API

The synthetic API supports both frontend shells: authentication, scoped preferences, navigation/localization, records, recovery, DCP forms, healthcare examples and device/printing demonstrations. It is not a production Spring Boot backend. Use Node.js 24+; the server imports TypeScript contracts and uses Node SQLite. Barcode rendering uses the dependency recorded in [package.json](package.json), so the old zero-dependency description no longer applies.

```bash
# From dummy-api, using Node 24:
npm ci
node server.mjs                  # default port 3200
# For a separate isolated instance:
PORT=3330 NEXORA_DATA_DIR=/tmp/enterprise-demo-api node server.mjs
```

Set `HOST=127.0.0.1` when a reverse proxy on the same server handles public access.
The default `HOST=0.0.0.0` preserves existing container and demo deployments.
Use a dedicated `NEXORA_DATA_DIR` for each test environment.

The frontend workspace also requires its own lockfile installation. Follow the [isolated browser testing guide](../docs/testing/v1.0.0/PRE-COMMIT.md) instead of running write tests against public demo data. `NEXORA_DATA_DIR` selects demo storage; feature stores supporting `RECORD_DATA_DIR` use that override. Do not point an isolated test at live data.

## Endpoint families

[server.mjs](server.mjs) and each feature store are the authoritative method, command and response contracts. This inventory groups routes; it is not an OpenAPI specification. The public reverse proxy exposes these under `/api`; the local server paths below omit that proxy prefix.

| Family | Paths | Guidance |
| --- | --- | --- |
| Session and health | `/auth/login`, `/auth/me`, `/auth/logout`, `/health` | Demo bearer sessions; health is not production readiness |
| Application configuration | `/navigation`, `/localization` | [Canonical configuration](config/README.md) |
| Preferences and presentation | `/preferences`, `/preference-policy`, `/layouts`, `/personal-views` | [Preference policies](../desktop-clients/docs/tenant-preference-policies.md) |
| Records and worklists | `/records`, `/worklists/search`, `/worklists/archive`, `/views`, `/reference` | [Record integration](../desktop-clients/docs/record-editing.md) |
| Related records, imports and approvals | `/record-panels`, `/imports`, `/approvals` | [Platform handbook](../desktop-clients/docs/handbook/frontend-platform-guide.md) |
| Draft recovery | `/drafts`, `/draft-policy`, `/draft-center` | [Shared draft service](../desktop-clients/docs/shared-draft-recovery.md) |
| DCP authoring and runtime demo | `/dcp-designer` | [Designer/runtime guide](../docs/features/dcp-designer.md), [backend handoff](../docs/development/DCP-LATEST-FORM-BACKEND-HANDOFF-2026-09-11.md) |
| Patient and care templates | `/clinical-templates`, `/clinic-billing`, `/clinical-triage`, `/clinical-consultation`, `/comprehensive-consultation`, `/op-registration`, `/care-pages` | [Feature catalog](../docs/features/README.md) identifies each synthetic workflow |
| Labels and workstation devices | `/label-printing`, `/device-integrations`, `/identity-devices` | [Labels](../docs/features/barcode-qr-printing.md), [devices](../docs/features/device-integrations.md), [identity](../docs/features/identity-devices.md) |
| Help and monitoring | `/documentation`, `/documentation/state`, `/monitoring/events`, `/monitoring/incidents` | [Documentation lifecycle](../docs/documentation/README.md), [Sentinel](../desktop-clients/docs/sentinel-monitoring.md) |
| Reporting and AI | `/exports`, `/report-schedules`, `/audit`, `/ai/policy`, `/ai/config`, `/ai/dispatch`, `/ai/usage` and related subroutes | [Workspace README](../desktop-clients/README.md); integration-specific readiness remains separate |

Feature command routes such as `/dcp-designer` accept POST commands and validate navigation access, authenticated scope and operation-specific permissions. Never infer a production endpoint from the demo command URL. Production DCP uses the frontend adapter's explicitly supplied host paths and backend v1 contract.

## Persistence and scope

Preferences now use `data/preferences.sqlite` through [preference-store.mjs](preference-store.mjs), with tenant/application policy, actor overrides, revisions and policy history. `data/preferences.json` is a legacy fallback source, not the current authoritative preference writer. GET/PUT response and expected-revision semantics are described in the preference policy guide; do not use the earlier unconditional `204` response assumption.

Other families have their own documented SQLite, CSV snapshot, file or in-memory boundaries. Clinical and DCP snapshot stores are demo persistence, not PostgreSQL domain transactions. Shared DCP recovery uses the existing draft service; it does not create a second browser-storage system. Seed/configuration files belong under `config`; runtime data and credentials must stay outside committed fixtures. Backups and restore must preserve the relevant store and its documented consistency boundary.

## Accounts and security boundary

The existing synthetic users are `user1`, `user2` and `admin`; their demo password matches their username. Real credentials and sensitive patient/customer data do not belong in this environment. Sessions are held in process memory and disappear on restart. Route-specific scope/permission checks exist, but demo login/session design is not production authentication or compliance certification.

Origins are checked against `NEXORA_ALLOWED_ORIGINS` or the server's configured defaults. The current server permits the `Pepbits-Contract-Version` header used by DCP. This replaces the outdated claim that CORS is unrestricted. Production hosts own authentication, authorization, tenancy, durable audit, transactions and accepted integrations.

## Validation and operations

Run `npm run test:api` from `desktop-clients` for the repository API suites. Consult the [current testing guide](../docs/testing/README.md) and [release evidence](../docs/releases/unreleased/README.md) for exact tested source and unresolved hosted failures. Deploying frontend shells does not restart this API automatically; see [deployment operations](../desktop-clients/docs/deployment.md).
