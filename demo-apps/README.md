# Demo apps

Applications that demonstrate and test the library. Phase 6a adds the independent showcase in the [library restructure plan](../docs/architecture/PACKAGE-RESTRUCTURE-PLAN.md).

- Each demo is `@pepbits-demo/<folder>` and `"private": true`. Demos are never published, and product repositories never use them.
- Demos import only the public exports of `@pepbits/*` packages from `packages/`, never another demo and never a `src/` path.
- Demo data is fictional. The showcase uses explicitly volatile in-memory adapters; later demos may use the mock API.

## Showcase

[Showcase](showcase/README.md) is the first standalone Next.js demo. Run `npm run dev -w @pepbits-demo/showcase` from the repository root (port 3300); build/start/typecheck/test scripts are in its guide. Eight routes cover foundations, primitives, components, patterns, page engines, policy, Shell and AI inside the full library workspace frame. The 55 source-backed examples include tabs/split/MDI, fictional detached windows, shell layers, preferences/login and browser-only AI simulation. AI starts off and is enabled in the policy playground; no provider or server endpoint is configured.

ERP and desktop are described below. Other demo ports are coordinated in separate worktrees; this branch does not incorporate their later merges.

## Desktop

[Desktop](desktop/README.md) is the Vite + Tauri 2 demo on port 3410 that replaces `desktop-clients/apps/desktop` (phase 6e-7). The full shell runs as a document workspace (tabs, split, floating frames, unsaved-change guards, separate native windows through a Tauri window port) around demo-owned pages over the unchanged demo API. The [source map](desktop/source-mapping.md) and [local record](../docs/releases/unreleased/restructure-phase-6e-7-2026-10-24.md) state scope: resumed-source unit/typecheck/docs checks pass; final build/CI/browser verification is blocked by the shared heavy-check lock. The native executable is not built or tested.

## Healthcare

[Healthcare](healthcare/README.md) is the separate Next.js demo on port 3310. Phases 6b-1/6b-2 add the Healthcare Suite core, patient workspace, clinical screens and 55 LIS1/LIS2/RIS1 diagnostic destinations against the unchanged synthetic demo HTTP API, using the full shared shell and API-backed preferences. Its [source map](healthcare/source-mapping.md) and [release record](../docs/releases/unreleased/restructure-phase-6b-2-2026-10-23.md) distinguish completed scope, local verification and remaining healthcare runs. This is not clinical acceptance.

## ERP

[ERP](erp/README.md) is the independent Next.js demo on port 3320. Phase 6c-1 adds separate ERP1/ERP2 header modules with 57 catalogue destinations each, shared Keystone configuration, ERP1 in-page records and ERP2 record/create/edit URLs. Public engines render the unchanged fictional API data. Specialized source layouts remain explicitly deferred in the [source map](erp/source-mapping.md) and [local record](../docs/releases/unreleased/restructure-phase-6c-1-2026-10-23.md). Financial demonstration only, not accounting acceptance or deployment.
