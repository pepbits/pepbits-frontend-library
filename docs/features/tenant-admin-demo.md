# Independent Tenant Admin demo

Feature ID: TAD. State: Allyvora Tenant Admin reference ported to its own Next.js app (phase 6e-2): Overview, Approvals inbox, Activity log and all 30 registry-driven configuration pages. [Delivery record](../releases/unreleased/restructure-phase-6e-2-2026-10-24.md), [test guide 1.0.0](../testing/v1.0.0/PRE-COMMIT.md). Local verification only; all data is fictional and this is **not a production configuration service** or financial/regulatory acceptance.

## User problem and outcome

A tenant administrator configures billing access, catalogue and pricing, payers and coverage, billing policy and reimbursement models, exchange/payment providers, accounting and platform settings, with governed changes that need an independent approver. The [app guide](../../demo-apps/tenant-admin/README.md) explains setup and routes; the [source mapping](../../demo-apps/tenant-admin/source-mapping.md) lists every original file and its destination. The app uses the shared Pepbits shell, preferences and localization over the unchanged demo API.

## User and administrator flows

1. Start the synthetic API and the app, then sign in through the shared login with a Tenant Admin fixture role (`tenant-config-admin`, `-editor`, `-approver`, `-viewer`, or an enterprise administrator). The sidebar lists Workspace (Overview, Approvals inbox, Activity log) and, once `GET /meta` answers, every registry category with its configuration pages. A role without access sees a recoverable "not available for this account" state; there is no actor switcher.
2. Overview states whether billing is open, shows the activation path (each stage's checks link to the page that fixes them), changes waiting for a decision (marked "Yours" or "You can decide"), versions coming into effect and recent activity.
3. Open a configuration page. Filter by status, search, sort by code/name/status/effective/last change and page through results; the page size is the effective managed table size. "New <record>" opens the drawer; `?new=1` and `?open=<id>` deep links open it directly and survive reload.
4. Versioned pages: fill the registry fields (text, numbers, money/percent, dates, switches, selects, multi-selects, tags, references, line tables) and Save draft. Submit for approval with an optional reason; strict validation applies on submission and shows field errors on the fields while keeping the typed values. Submitted versions are locked; the submitter can withdraw. Another administrator approves (optional note) or returns (required reason) from the drawer or the Approvals inbox. Approved versions are immutable: retire them or start a new version (the old one stays in force until the new one is approved). Drafts can be discarded after confirmation.
5. Simple pages (items, categories, commercial parties, networks, GL accounts) apply when saved: create, edit, deactivate (with confirmation) and activate.
6. History and versions shows the record's audit trail and revisions. Activity log filters the append-only audit trail by page, action and person; record codes link to the record drawer.
7. Reimbursement routes offers Test route selection: choose an item, optional contract, care setting and service date; the server returns the winning model and every candidate with its reason.
8. Ctrl/Cmd+K (or the toolbar's Jump to a page) searches pages and "New …" entries. Ctrl/Cmd+S saves an editable record. Both are bound only while keyboard shortcuts are enabled.
9. Preferences uses the shared page and one serialized update path; tenant locks and allowed values disable conflicting choices.

## Integration and failure behaviour

ApplicationProviders composes session, API preferences/tenant policy, the runtime catalog and the shell. A small registry reader inside the authenticated host publishes `GET /meta` to the shell product, so navigation follows the server registry; signing out or another identity clears it. The public page-renderer registry renders every Tenant Admin route with one module renderer, which keeps the module's scope-keyed store across navigation. The module receives the public `@pepbits/shell/reference-host` contract built from the application ports.

The adapter maps module paths to `/reference-modules/tenant-admin/...` through the configured authenticated request, adding only module/branch routing metadata. The API resolves the actor from the session, enforces roles (viewer read-only, editor writes, approver decides), independent approval and row versions. Writes carry an `Idempotency-Key` and an ambiguous failure retries under the same key. Refusals keep the `{ error: { code, message, fieldErrors } }` shape; a stale version reloads the record. Reads abort on unmount/scope change and discard late answers; mutations refresh every mounted read and the pending count polls every 20 seconds. Unsaved drawer edits ask before closing; there is no durable draft store.

## Compatibility, localization and accessibility

All source wording uses generated English→catalog-key aliases that resolve in the unchanged `en/ar/hi/ml` canonical catalogs; registry labels use the canonical navigation keys where they exist. Arabic gets `dir="rtl"` from the host; the imported layout keeps physical left/right utilities. Dates, times and numbers use the effective formatters; native date inputs keep machine values. Theme and density reach the scoped stylesheet; reduced motion stops its animations. Chromium axe findings are corrected in the app (combobox names, compact line-cell names, label-in-name, scrollable panel focus, two contrast pairs). Automated checks are not assistive-technology or native-speaker acceptance.

## Acceptance and limitations

| ID | Contract and verification |
| --- | --- |
| TAD-01 | Shared sign-in, provider chain and registry-driven sidebar (30 configuration pages from `GET /meta`), cleared on identity change |
| TAD-02 | All 36 route patterns (three workspace pages, 30 configuration pages, `?new=1`, `?open=<id>`, not-found) render under default, Arabic RTL, reduced motion and locked density with jsdom axe; preferences route under the full host |
| TAD-03 | List search, status filter, sort and effective page size issue API queries |
| TAD-04 | Versioned lifecycle: draft, strict submission refusal with preserved values, submit, independent approval, history, new version, discard |
| TAD-05 | Simple lifecycle: create, edit, deactivate, activate |
| TAD-06 | Server refusals: self-approval, viewer write, write to an approved/stale version |
| TAD-07 | Approvals inbox filters and decisions; Activity log filters and record deep links |
| TAD-08 | Route tester, Ctrl/Cmd+K palette and deep-link reload |
| TAD-09 | All original source cases (routes, client/store, module, styles, copy) with public-provider adaptations and frozen provenance checks |
| TAD-10 | Forced root CI, production build, shell Chromium, documentation, protected paths and import/credential scans |

Remaining: exact source pixel comparison; mirrored RTL layout; long Hindi/Malayalam string review; durable drafts (not offered by this API); the original desktop generators for styles/aliases (frozen copies are verified by hash instead). Native executables, production identity providers and human accessibility/localization review are outside verification.

## Operations and support

Use Node 24 and the existing API runtime environment for the API. Integration compares API sources before reusing existing runtime artifacts and records their hashes; it owns temporary storage, services and browser cleanup, including failure and cancellation. Fixture credentials are read at run time and never written to receipts. Removing the app does not change the original desktop consumer or the backend.
