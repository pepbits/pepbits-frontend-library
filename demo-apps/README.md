# Demo apps

Applications that demonstrate and test the library. Phase 6a adds the independent showcase in the [library restructure plan](../docs/architecture/PACKAGE-RESTRUCTURE-PLAN.md).

- Each demo is `@pepbits-demo/<folder>` and `"private": true`. Demos are never published, and product repositories never use them.
- Demos import only the public exports of `@pepbits/*` packages from `packages/`, never another demo and never a `src/` path.
- Demo data is fictional. The showcase uses explicitly volatile in-memory adapters; later demos may use the mock API.

## Showcase

[Showcase](showcase/README.md) is the first standalone Next.js demo. Run `npm run dev -w @pepbits-demo/showcase` from the repository root (port 3300); build/start/typecheck/test scripts are in its guide. Eight routes cover foundations, primitives, components, patterns, page engines, policy, Shell and AI inside the full library workspace frame. The 55 source-backed examples include tabs/split/MDI, fictional detached windows, shell layers, preferences/login and browser-only AI simulation. AI starts off and is enabled in the policy playground; no provider or server endpoint is configured.

ERP is in progress below. Remaining app order: reports, tenant-admin, onboarding, settle, caregrid, allyvora-patients, desktop. Each is its own app and will be built one at a time.

## Desktop

[Desktop](desktop/README.md) is the Vite + Tauri 2 demo on port 3410 that replaces `desktop-clients/apps/desktop` (phase 6e-7). The full shell runs as a document workspace (tabs, split, floating frames, unsaved-change guards, separate native windows through a Tauri window port) around demo-owned pages over the unchanged demo API. The [source map](desktop/source-mapping.md) and [local record](../docs/releases/unreleased/restructure-phase-6e-7-2026-10-24.md) state scope: resumed-source unit/typecheck/docs checks pass; final build/CI/browser verification is blocked by the shared heavy-check lock. The native executable is not built or tested.

## Healthcare

[Healthcare](healthcare/README.md) is the separate Next.js demo on port 3310. Phases 6b-1/6b-2 add the Healthcare Suite core, patient workspace, clinical screens and 55 LIS1/LIS2/RIS1 diagnostic destinations against the unchanged synthetic demo HTTP API, using the full shared shell and API-backed preferences. Its [source map](healthcare/source-mapping.md) and [release record](../docs/releases/unreleased/restructure-phase-6b-2-2026-10-23.md) distinguish completed scope, local verification and remaining healthcare runs. This is not clinical acceptance.

## ERP

[ERP](erp/README.md) is the independent Next.js demo on port 3320. Phase 6c-1 adds separate ERP1/ERP2 header modules with 57 catalogue destinations each, shared Keystone configuration, ERP1 in-page records and ERP2 record/create/edit URLs. Public engines render the unchanged fictional API data. Specialized source layouts remain explicitly deferred in the [source map](erp/source-mapping.md) and [local record](../docs/releases/unreleased/restructure-phase-6c-1-2026-10-23.md). Financial demonstration only, not accounting acceptance or deployment.

## School

[Scholaris](school/README.md) is the private Next.js demo on port 3340. Phase 6d ports 26 school routes, six scope-granted role dashboards and preferences through the public shared host and unchanged fictional HTTP API. The [source map](school/source-mapping.md), [feature guide](../docs/features/school-demo.md) and [local record](../docs/releases/unreleased/restructure-phase-6d-2026-10-24.md) distinguish route coverage from restricted-role/backend and visual parity limits. Academic demonstration only, not institutional acceptance or deployment.

## Tenant Admin

[Tenant Admin](tenant-admin/README.md) is the independent Next.js demo on port 3360. Phase 6e-2 ports the Allyvora Tenant Admin reference: Overview, Approvals inbox, Activity log and all 30 configuration pages from the API registry, drawn by one resource workspace and record drawer with `?new=1`/`?open=<id>` deep links, on the shared host and the unchanged fictional demo API. Its [source map](tenant-admin/source-mapping.md) and [local record](../docs/releases/unreleased/restructure-phase-6e-2-2026-10-24.md) state verification and limits. Fictional configuration data only, not a deployment.

## Reports

[Reports](reports/README.md) is the independent Next.js demo on port 3350. Phase 6e-1 ports the Lumen Reports reference module: all 19 source page routes (library, viewer, builder, dashboards, background jobs, schedules, email requests, API keys and administration) over the shared host and the unchanged demo API. Data, users, schedules and email are fictional; email is recorded, never sent. See its [source map](reports/source-mapping.md) and [local record](../docs/releases/unreleased/restructure-phase-6e-1-2026-10-24.md). Not a deployment.

## Onboarding

[Onboarding](onboarding/README.md) is the separate Next.js demo on port 3370. Phase 6e-3 ports the Orvia Health Cloud onboarding demo: landing page, workspace lookup, workspace sign-in with a 6-digit code and the six/seven-step organization registration, inside the shared shell against the unchanged demo API. Orvia's directory, registrations and sign-in are fictional device-local adapters behind an onboarding port because the API has no equivalent endpoints. Generic step state lives in `@pepbits/patterns/wizard` and code entry in `@pepbits/ui` `OtpInput`. See its [source map](onboarding/source-mapping.md) and [local record](../docs/releases/unreleased/restructure-phase-6e-3-2026-10-24.md). Fictional demonstration only, not a deployment.

## AllyVora patients

[AllyVora patients](allyvora-patients/README.md) is the separate Next.js demo on port 3400 (phase 6e-6). It ports AllyVora patient registration: the register, record view, registration and editing in five organisation layouts, and the administrator's form-layout designer. Patient data comes from AllyVora's own unchanged Express + SQLite API; sign-in, preferences and catalogs come from the shared demo API. The read-only source form package is consumed unchanged. Its [source map](allyvora-patients/source-mapping.md) and [release record](../docs/releases/unreleased/restructure-phase-6e-6-2026-10-24.md) list adaptations and local verification. Fictional data only; not clinical acceptance or deployment.

## Settle

[Settle](settle/README.md) is the independent Next.js demo on port 3380. Phase 6e-4 ports the Settle patient billing desk: desk, bills, bill workspace, patient accounts, receipts, approvals, day close, reports, audit, settings and bill/receipt print layouts. It uses the shared host (sign-in, preferences, policy, localization) against the demo API and the unchanged Settle Express + SQLite API for all billing data. Its [source map](settle/source-mapping.md) and [record](../docs/releases/unreleased/restructure-phase-6e-4-2026-10-24.md) state verification and deferrals. Fictional data; not billing acceptance or deployment.
