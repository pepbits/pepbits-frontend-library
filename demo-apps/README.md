# Demo apps

Applications that demonstrate and test the library. Phase 6a adds the independent showcase in the [library restructure plan](../docs/architecture/PACKAGE-RESTRUCTURE-PLAN.md).

- Each demo is `@pepbits-demo/<folder>` and `"private": true`. Demos are never published, and product repositories never use them.
- Demos import only the public exports of `@pepbits/*` packages from `packages/`, never another demo and never a `src/` path.
- Demo data is fictional. The showcase uses explicitly volatile in-memory adapters; later demos may use the mock API.

## Showcase

[Showcase](showcase/README.md) is the first standalone Next.js demo. Run `npm run dev -w @pepbits-demo/showcase` from the repository root (port 3300); build/start/typecheck/test scripts are in its guide. Foundations, primitives, components, patterns, page engines and a policy playground are implemented. The temporary app frame is isolated in one component. Full shell and AI examples await the parallel phase 5 part 2 / 5b merge.

Remaining order: healthcare, erp, school, reports, tenant-admin, onboarding, settle, caregrid, allyvora-patients, desktop. Each is its own app and will be built one at a time.
