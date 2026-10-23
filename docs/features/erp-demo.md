# Independent ERP demo

Feature ID: ERD. State: implemented catalogue/data-flow subset; specialized source views remain deferred. [Delivery record](../releases/unreleased/restructure-phase-6c-1-2026-10-23.md), [test guide 1.0.0](../testing/v1.0.0/PRE-COMMIT.md). Local verification only; fictional financial behaviour is **not accounting acceptance**.

## User problem and outcome

ERP1 and ERP2 now run in a separate Next.js app using public library engines and the unchanged demo API. Each has 57 catalogue destinations across 20 original template families. ERP1 opens an in-page editor; ERP2 gives records and creation their own URLs. The [app guide](../../demo-apps/erp/README.md) explains setup and supported routes; the [source mapping](../../demo-apps/erp/source-mapping.md) distinguishes engine reuse from specialized presentation still pending.

## User and administrator flows

1. Start the synthetic API and app, then sign in with a local fixture account through the shared login screen. Choose ERP1 or ERP2 in the shell header. Branch and role come from the authenticated session.
2. Open Customers, search the worklist and select a row. ERP1 retains its page URL; ERP2 navigates to the record URL. Edit and save fictional data. The accepted server row appears immediately; refresh an ERP2 record to confirm persistence.
3. Use New on a supported worklist. Required fields are checked, source lookups come from the API and an accepted response identifies the new record. ERP2 creation routes end at the created record. Previous/next follows the last worklist result page; direct links without that memory disable these actions.
4. Use Columns to choose or reset displayed fields. Storage follows the browser/account preference; account layouts use the current user/branch/module API scope. Pending Approvals expose approve/reject commands; server authority and versions remain decisive.
5. Open Preferences. Language, presentation, formatting, motion and shortcuts follow one accepted update path. Tenant locks and allowed values disable conflicting changes. Failed preference saves retain accepted settings until reload; policy refresh can replace effective values.

## Integration and failure behaviour

The public renderer registry receives app-owned navigation. ApplicationProviders composes session, preferences, runtime localization and shell. Public WorklistPage, RecordPage, TemplateFields, FieldRows, EditableMatrix, TemplateReport and charts supply generic rendering. Only ERP field definitions, calculations and command composition remain in the app.

The adapter receives the configured authenticated transport and maps to `/reference-modules/{erp1,erp2}/api/...`. There is no component origin, second token store, another-demo import or frontend data fallback. Scoped resource state separates tenant, user, role, branch and module. The API owns validation, versions, authorization and synthetic persistence. Save failures retain values, and an identical ambiguous retry retains its operation ID. Conflicts require explicit reload; durable drafts and recovery after leaving an editor are deferred.

## Compatibility, localization and accessibility

Canonical localization comes from the protected API catalogs at runtime. Literal aliases are generated from those catalogs; missing terminology stays in source English and needs backend authoring/human review. Four-profile tests cover default, Arabic RTL, reduced motion and locked density. Jsdom axe does not measure contrast; browser axe is separate and includes the full shell. Automated checks do not establish assistive-technology, language or accounting acceptance. Original source packages and API/deployment files remain unchanged.

## Acceptance and limitations

| ID | Contract and verification |
| --- | --- |
| ERD-01 | Shared sign-in/provider chain, header module selection, own navigation and API scope |
| ERD-02 | All 114 catalogue pages and 132 ERP2 record/create/edit patterns render through public engines; four-profile route/axe matrix |
| ERD-03 | Search → record → edit → save for both modules; ERP2 deep-link refresh and create navigation |
| ERD-04 | Previous/next list memory and shared column reset/persistence; original source contracts retained |
| ERD-05 | Pending approval commands, transient failed-save retention and version/operation identity |
| ERD-06 | Preferences with serialized revisions, policy locks and mounted language changes; actual runtime catalog |
| ERD-07 | Forced root CI, production builds, shell Chromium, documentation, source identity and protected-path scans |

All destinations are available as data views. Specialized tree/calendar/board/profile layouts, invoice print geometry, report period/pivot controls and full source dashboard composition remain deferred. The richer personal-view protocol is unavailable from this API and is hidden. These limitations prevent a claim of complete source workflow/visual parity. No physical printing, accounting certification, deployment or native executable is tested.

## Operations and support

Use Node 24 and the existing API runtime environment. Integration checks compare API sources before reusing existing runtime artifacts and record their hashes. The launcher owns temporary storage, services and browser cleanup, including failures and cancellation. Keep credentials and headers out of receipts. Runtime errors and rejected writes should be diagnosed from the source-scoped response evidence. Removing the new app from use does not change the original desktop consumers or backend.

Finance-specific entity-grant presentation remains deferred: the app enables writes for the API's admin/enterprise-admin/operations/operations-analyst roles; finance/accountant sessions currently receive read-only controls. The server still enforces every command. Live write evidence uses the fixture administrator.
