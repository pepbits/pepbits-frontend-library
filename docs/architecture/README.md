# Architecture index

Reviewed 13 September 2026. These links describe implemented contracts; historical plans remain labelled as plans.

- [Library restructure plan](PACKAGE-RESTRUCTURE-PLAN.md): **proposal, not approved**. Layered `packages/` library, `demo-apps/` built from public exports, registry publishing for product repositories and the port-one-by-one order.
- [Library, preference policy and component flows](library-preferences.md): current package boundaries, setting resolution, APIs, rendering and failure behavior.
- [Archived combined-shell architecture](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/docs/enterprise-workspace-framework-readme.md): records, tabs, split views and optional windows.
- [Page-template engine](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/docs/page-template-library.md): configurations, adapters and reusable engines.
- [Backend navigation and localization plan](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/docs/backend-navigation-localization-plan.md): menu IDs, message keys and backend configuration. This is a plan; use implementation guides and evidence for completion status.
- [Tenant policy contract](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/docs/tenant-preference-policies.md): stored preferences, policy endpoints and scope.

- [API-backed page families](library-preferences.md#api-backed-page-families): patient, billing, registration, care and device store boundaries.
- [Documentation lifecycle](../documentation/README.md): page help resolution, source-change receipts, version snapshots and translation review.
- [Generic device integration](../features/device-integrations.md): workstation routing, API jobs and injected production transports.
- [Identity devices](../features/identity-devices.md): scoped capture requests, assertion boundary and device-policy checks.

Architecture explains responsibility and intent. Release evidence establishes what was tested and delivered.

- [DCP designer and runtime](../features/dcp-designer.md#architecture-and-public-integration): shared renderer, typed authoring definition, adapters, catalog and recovery boundaries.
- [DCP backend handoff](../development/DCP-LATEST-FORM-BACKEND-HANDOFF-2026-09-11.md): current frontend expectations and the distinction between authoring and backend v1 contracts.
- [Demo API inventory](../../mock-api/README.md): current endpoint families, storage ownership and production boundaries.
