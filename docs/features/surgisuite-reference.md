# SurgiSuite reference module

Select **SurgiSuite** in the shared header. The sidebar loads the eight original destinations: Theatre board, Schedule, Cases, Approvals, Patients, Inventory, Analytics and Masters & coding. Opening a case loads its original twelve-section workspace, preserving the actual case identifier across navigation and refresh.

The imported source is `reference/frontend/surgisuite/surgisuite`. The frontend is `desktop-clients/packages/reference-surgisuite`; original Express services are under `dummy-api/surgisuite-source`. This is a separate Library demonstration module. Healthcare Enterprise application source, its patient registry and its inventory ledger are not replaced by this import.

## User flow

1. Sign into the Library with a role entitled to SurgiSuite and select the effective branch.
2. Select SurgiSuite in the header; use the sidebar collapse/expand controls already supplied by the host.
3. Review the Theatre board or Schedule. Open a case, or select Book case to use the original patient/procedure/team/equipment/schedule wizard.
4. Review conflicts and readiness before booking or advancing a milestone. The API enforces permissions, required data and workflow guards.
5. Open the case sections: Overview; Team & equipment; Diagnosis & CPT; Approvals & consent; Checklist & counts; Anesthesia record; Imaging, lab & blood; Materials & implants; Risk scores; Operative report; Charges & claim; Activity & audit.
6. Record source actions in their corresponding section. Signed reports retain their original version and require the source amendment workflow for changes.

In-app guides in English, Arabic, Hindi and Malayalam describe all nine routes in the immutable `2026-10-02-surgisuite-reference-import` help patch. Earlier guides and review records are preserved. Authored source-flow instructions are not browser, facility or native-language approval.

## Shared integration

The host owns identity, module/sidebar navigation, branch selection, preferences and tenant locks. Imported pages use shared source form controls, managed tables, links and accessible dialog mechanics. Original default palette, compact controls, spacing, charts, tabs, booking wizard and overlay frames remain scoped to SurgiSuite. The host header/sidebar replaces the duplicate source shell intentionally. Original IBM Plex Sans and Condensed font families use the source Google Fonts stylesheet; offline font parity has not been verified.

Theme, font and radius overrides, independent shell/form/result scaling, table presentation, reduced motion, keyboard-shortcut enablement and toast position/duration use effective host preferences. Display dates/times use host formatters. Monetary values retain the source backend's **USD denomination**; formatting is not a currency conversion. Native date/time input and API code values remain machine-readable.

`/reference-modules/surgisuite/api` delegates to the original source services inside the existing demo API. Stores partition by trusted tenant, application and branch. Business records are seeded only on a new owned database. Reset, source login and directory impersonation are unavailable. Client caches/controllers are scope-owned and discarded on scope change; changing a master invalidates affected consumers.

Synthetic roles cover administrator, coordinator, surgeon, anesthesia, nurse, approver, coder and viewer. The server maps authenticated host roles; it does not accept a caller-supplied source role. Viewers cannot write; master writes require administrator authority. The demo PIN is a source simulation, not production MFA or a real clinical electronic signature.

Commands use the shared transactional worker boundary. Write retries retain operation identity after ambiguous failures; changed payload/key reuse conflicts, failures roll back, and successful retry results survive worker restart. These checks do not establish external device, payer or Healthcare Enterprise interoperability.

## Validation and completion boundary

See [the delivery record](../releases/unreleased/surgisuite-reference-2026-10-02.md) for exact commands, source identity and results. Component checks use explicitly synthetic server-captured test fixtures; those fixtures are imported only by tests. The backend tests execute actual source services in isolated SQLite worker stores.

The registered `desktop-clients/e2e/surgisuite-reference.mjs` suite covers the real authenticated demo HTTP, header/sidebar pages, all case sections, booking drawer, refresh and viewer denial. It has **not run** in this restricted session. Deployment to `frontend.test.pepbits.com` is **not complete**. UI catalogs and all nine guides have Arabic/Hindi/Malayalam draft translations and pass automated coverage checks. Browser typography/visual acceptance, native/domain review, offline font acceptance and any real-care integration remain pending. Existing deployed records are not relabeled.
