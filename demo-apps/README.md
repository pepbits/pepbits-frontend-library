# Demo apps

Applications that demonstrate and test the library. Phase 6a adds the independent showcase in the [library restructure plan](../docs/architecture/PACKAGE-RESTRUCTURE-PLAN.md).

- Each demo is `@pepbits-demo/<folder>` and `"private": true`. Demos are never published, and product repositories never use them.
- Demos import only the public exports of `@pepbits/*` packages from `packages/`, never another demo and never a `src/` path.
- Demo data is fictional. The showcase uses explicitly volatile in-memory adapters; later demos may use the mock API.

## Showcase

[Showcase](showcase/README.md) is the first standalone Next.js demo. Run `npm run dev -w @pepbits-demo/showcase` from the repository root (port 3300); build/start/typecheck/test scripts are in its guide. Eight routes cover foundations, primitives, components, patterns, page engines, policy, Shell and AI inside the full library workspace frame. The 55 source-backed examples include tabs/split/MDI, fictional detached windows, shell layers, preferences/login and browser-only AI simulation. AI starts off and is enabled in the policy playground; no provider or server endpoint is configured.

ERP is in progress below. Remaining app order: school, reports, tenant-admin, onboarding, settle, caregrid, allyvora-patients, desktop. Each is its own app and will be built one at a time.

## Healthcare

[Healthcare](healthcare/README.md) is the separate Next.js demo on port 3310. Phases 6b-1/6b-2 add the Healthcare Suite core, patient workspace, clinical screens and 55 LIS1/LIS2/RIS1 diagnostic destinations against the unchanged synthetic demo HTTP API, using the full shared shell and API-backed preferences. Its [source map](healthcare/source-mapping.md) and [release record](../docs/releases/unreleased/restructure-phase-6b-2-2026-10-23.md) distinguish completed scope, local verification and remaining healthcare runs. This is not clinical acceptance.

## ERP

[ERP](erp/README.md) is the independent Next.js demo on port 3320. Phase 6c-1 adds separate ERP1/ERP2 header modules with 57 catalogue destinations each, shared Keystone configuration, ERP1 in-page records and ERP2 record/create/edit URLs. Public engines render the unchanged fictional API data. Specialized source layouts remain explicitly deferred in the [source map](erp/source-mapping.md) and [local record](../docs/releases/unreleased/restructure-phase-6c-1-2026-10-23.md). Financial demonstration only, not accounting acceptance or deployment.

## Tenant Admin

[Tenant Admin](tenant-admin/README.md) is the independent Next.js demo on port 3360. Phase 6e-2 ports the Allyvora Tenant Admin reference: Overview, Approvals inbox, Activity log and all 30 configuration pages from the API registry, drawn by one resource workspace and record drawer with `?new=1`/`?open=<id>` deep links, on the shared host and the unchanged fictional demo API. Its [source map](tenant-admin/source-mapping.md) and [local record](../docs/releases/unreleased/restructure-phase-6e-2-2026-10-24.md) state verification and limits. Fictional configuration data only, not a deployment.
