# LIS1, LIS2 and RIS1 reference modules

Status: deployed to [frontend.test.pepbits.com](https://frontend.test.pepbits.com), current release `20261001-sidebar-04`. The [shared sidebar correction](../../releases/unreleased/sidebar-navigation-2026-10-01.md) passed 80 public diagnostic checks and 183 local multilingual results. Initial import evidence below retains its original release scope. Native-speaker and clinical/domain approval remain pending.

The library header registers **LIS1**, **LIS2** and **RIS1** as separate reference modules, with 19, 22 and 14 menu destinations respectively. Imported detail, viewer and print routes stay inside the selected module. Existing Healthcare, ERP, School and Reports registrations remain separate.

## User flow

1. Sign in to the demo application and select the intended branch.
2. Choose LIS1, LIS2 or RIS1 in the module selector.
3. Expand the navigation rail and select a source page. All three use the shared hover/click/focus setting and an explicit toggle. The rail starts collapsed when unpinned, closes after navigation or an outside click, and keeps the header accessible. Saved or managed pinning wins over the default.
4. Open a patient, order or study using that page's links. Read and write actions go through the authenticated demo API. A missing service shows an error, rather than local business fixtures.
5. Check returned records after saving. On an ambiguous timeout, refresh before retrying a write. Unsaved forms are not durable saved documents.

The documentation API has source-reviewed guides for all 55 destinations in a new snapshot. Those guides distinguish verified page navigation from pending detailed workflow acceptance. Arabic, Hindi and Malayalam translations are complete for registered UI copy and all 55 guides; native-speaker approval and clinical workflow review remain pending.

## Shared implementation

- `reference-diagnostics` supplies host API access, scoped resources, actor context, barcode retrieval, route parameters, shared controls and preference-based formatting.
- `reference-lis1`, `reference-lis2` and `reference-ris1` contain the adapted source workspaces. Source layout classes are retained inside isolated, generated Tailwind 3 stylesheets. Existing host styles are not replaced.
- `ops-ui` adds native-layout SourceInput, SourceTextarea, SourceSelect and SourceButton and SourceDateInput for imported designs. These reuse localization and standard React accessibility/ref contracts without imposing another page layout.
- The existing module registry, sidebar, host navigation and document service own application integration.
- The existing authenticated demo API routes `/reference-modules/lis1/api`, `/reference-modules/lis2/api` and `/reference-modules/ris1/api` to private worker threads. No additional public API ports are opened.
- Each worker/database belongs to one module, tenant, application and branch. Source SQLite data persists under the configured demo data directory. User identity comes from the host; original standalone login and role switching are blocked.
- Server source seeds, sample integration messages and barcode generation remain on the server. Frontend business fixtures and global patient caches are not used. LIS2 worklist navigation is transient session context, cleared on scope changes.

These source services are demo/reference backends. Their schema synchronization and source clinical logic do not establish production safety or replace the Healthcare inventory/RCM services.

## Permissions and external integrations

The host authenticates the user and validates module and branch availability. Enterprise administrators can perform source administration commands, finance managers are restricted to billing mutations, and operations analysts are read-only. Source guards provide additional checks. These demo roles are not production clinical privileges.

Original analyzer listeners and automatic dispatch timers are disabled in embedded mode. External HTTP, MLLP, ASTM and DICOM delivery paths are blocked and report delivery failures; they do not claim a real provider accepted a message. Server-side source sample ingestion remains available to exercise supported parsers after runtime installation. No live patient data should be used in this demo service.

## Installation and verification

Use Node 24+ and npm on a host with registry access:

```sh
cd /home/pepadmin/pb/saas/lib/pepbits-frontend-library/desktop-clients
npm run prepare:diagnostics
```

This installs frontend workspace and backend dependencies, compiles the source backends, checks all three frontend packages, runs real service persistence/isolation tests and focused UI tests, then builds the library. It does not deploy. Reviewed lockfiles are included. npm 11 requires the committed better-sqlite3 install-script allowance to build the native backend dependency.

`diagnostics-runtime/integration.test.mjs` intentionally fails if dependencies are missing. It must not be counted as passed or skipped acceptance. The backend transpiler reports `typeChecked:false`; separate TypeScript checks for LIS1, LIS2 and RIS1 passed. The actual runtime suite passed eight policy/service tests, including restart persistence and branch isolation.

For style regeneration, install the dedicated tool manifest under `desktop-clients/scripts/diagnostics/style-tools` and run `node scripts/diagnostics/styles.mjs` from desktop-clients. Set `DIAGNOSTIC_REFERENCE_ROOT` if source references live elsewhere. Generated styles are checked in; the host does not adopt Tailwind 3 globally. Import/adaptation scripts are one-time provenance tools, not safe refresh commands over reviewed edits.

## Verification and remaining review

- All automated release gates passed, including localization, authored guide translation, component reuse, form controls, scoped-style parity, example consistency and bundle budgets.
- Final local browser acceptance passed all 55 destinations and the patient-write/branch-isolation flows. Arabic, Hindi and Malayalam passed all three dashboards, sidebar toggles, direction, stable filter codes and 165 complete guide translations. Screenshot review also corrected untranslated dashboard captions.
- Existing Healthcare Suite and School browser regressions passed. RCM core acceptance passed 46 checks; three provider flows were not run in the local unconfigured environment. This import does not establish new external provider acceptance.
- Public HTTPS acceptance passed 71 diagnostic checks, including every menu destination, sidebar toggle, actual API patient write and branch isolation. Public Healthcare Suite and School regression passed 49 and 28 checks respectively, with zero page errors. Diagnostics and Healthcare also reported zero console errors. The School test's navigation wait was corrected before its successful rerun; application runtime code did not change.
- Complete detailed viewer, print and clinical form workflows, source-image comparison, keyboard/theme/density coverage and native-speaker/domain approval remain separate acceptance items.
- The reference services retain their existing demo clinical logic. They must be validated independently before any production clinical use.

See the [release/deployment record](../../releases/unreleased/diagnostic-reference-2026-10-01.md) for initial-import source identity and acceptance. The [sidebar correction](../../releases/unreleased/sidebar-navigation-2026-10-01.md) is the current deployment record. No certification or real clinical-provider integration is asserted.

## Session recovery — 1 October 2026

Using Node v24.21.0 and npm 11.19.0 from `/home/pepadmin/.local/opt/node-v24.21.0-linux-x64/bin`, the session resolved registry.npmjs.org and npm ping returned PONG in 271 ms. An actual create/delete probe in `/home/pepadmin/.npm/_logs` passed. No server DNS or ownership changes were made. Installation no longer needs a separate terminal. The localization/content gaps were subsequently translated with Claude Code Sonnet and all automated gates passed.

Retained results: [validation receipt](../../releases/unreleased/evidence/diagnostic-reference-2026-10-01/validation.json). It separates local checks, deployment and public acceptance, and preserves the initial local receipt and failed School test attempt.

## Sidebar correction — 1 October 2026

A public browser probe found that the expanded rail blocked header selection and ignored hover preferences. The [shared sidebar correction](../../releases/unreleased/sidebar-navigation-2026-10-01.md) records the subsequent fix, stronger tests and deployment status separately from the initial import receipt.
