# Healthcare reference page templates

## Purpose and scope

The Page Library reproduces the supplied `demo-pages` designs through shared TypeScript components and the authenticated demo API. The existing OP Registration remains available. Four additive destinations are Emergency Registration (`emergency-registration`), Inpatient Admission (`inpatient-admission`), Consultation Entry (`consultation-entry-design`) and Consultation Entry v2 (`consultation-entry-v2`). The existing application route `consultation-entry` is preserved. The PNG and README remain source references rather than extra application screens.

## User flows

Emergency: search/select a synthetic patient or create an unidentified record, open the ED encounter, move through Arrival, Triage, Registration, ED Care and Disposition. Save fields through the API. Completion requires an active encounter, explicit identity and consent review, disposition and a handover plan.

Inpatient: select a patient, admission source and type; enter the reason, receiving specialty, admitting doctor and attending doctor; review coverage/consent; reserve a compatible bed; confirm identity and care basis before admission. After admission, use Overview, Nursing, Medical, Orders, Transfer and Discharge tabs. The receiving team and source/assessment fields are saved records. Transfer and discharge-planning fields do not operate a real hospital bed-management system.

Consultation: select a patient, choose consultation context, then use the left section rail for complaint, history, systems review, examination, diagnosis, treatment and follow-up. Save or preview the note. Required clinical documentation and explicit identity/consent confirmation are checked before demo signing. Signed records are read-only; corrections use an appended note.

Version 2 adds structured order entry. The API retains all order values, including instructions, indication, collection and contrast. Cancellation keeps the original order with cancelled status. The first consultation version retains the simpler layout without order-entry dialogs.

## Design and shared components

The prototypes' application sidebars are excluded; the existing host shell supplies navigation. Five-step registration layouts, patient banners, card groups, a right summary, consultation section rail and sticky bottom actions are composed using `CareWorkspace`, `CarePanel`, `CareFields`, `CareSteps`, `CareHero`, `CareChoices`, `CareBedBoard` and `CareReview`. They reuse ops-ui cards, inputs, selectors, tabs, overlays, recovery and presentation contexts. Structured field definitions preserve the original field grouping and column spans; semantic theme tokens replace the standalone HTML's fixed colors and radii.

## Preferences and localization

The host resolves effective preferences and tenant locks. PresentationProvider applies field presentation and density; the workspace uses form/result scales, radius and color tokens, language catalogs, date formatters and preferred page size. There is no independent settings store. No new global keyboard shortcuts or animated scroll are installed. Arabic direction comes from the host; ordinary keyboard navigation remains available. Language catalogs are authored translations awaiting native-speaker review, not certified clinical terminology.

## API and storage

`createCareAdapter(request, productId)` calls authenticated `POST /care-pages`. Inject that adapter, `pageId`, authenticated `scopeKey` and `PreferenceHost` into the exported `CareWorkspace`. The page configuration lives in `mock-api/config/care-pages/pages.json`; initial patient and bed records are CSV files in the same directory. Mutations write atomic CSV snapshots under the configured record-data directory.

Commands: load, create, save, step, open, reserve, order, removeOrder, admit, sign, complete and addendum. Server authorization checks page navigation access. Saved records are scoped by tenant, application, owner and page; bed reservations are shared within the tenant/application. Operation IDs deduplicate retries; record versions reject stale writes. This is an isolated synthetic template store, not an enterprise patient master or interoperability service.

## Recovery and saved records

Save draft explicitly persists an encounter draft in the API record store. It is not automatic browser draft storage. Restore saved record loads its last saved fields and time. Switching records is disabled while edits are unsaved. A failed save retains values; network retry uses the same operation ID. A version conflict requires reviewing/reloading the latest record; reload warns that unsaved edits will be replaced. Signed/completed records accept addenda rather than field edits.

Bed reservation rejects conflicting reservations, incompatible care level, isolation and telemetry requirements. Admission checks the reserved bed and required clinical responsibility fields. Clinical completion leaves the bed allocated; it does not silently mark the bed clean or available.

## Completion boundary

These are reusable frontend pages with working demo API records. No actual payer eligibility, prescription transmission, physical transfer, nursing/medical credential verification, validated electronic signature, bed cleaning or clinical decision support is connected. Coverage status fields record demonstration context only. The UI does not automatically mark findings normal or supply patient-specific clinical advice. Do not enter real patient information. OP Registration retains its previously implemented API-backed flow.

## Verification

See the [delivery record](../releases/unreleased/care-page-templates-2026-09-10.md), [testing guide](../testing/README.md) and `CARE-01` in [acceptance cases](../testing/v1.0.0/USE-CASES.md). Recorded checks distinguish local source tests, isolated API browser tests and deployment. The subsequent [10 September deployment record](../releases/unreleased/care-page-deployment-2026-09-10.md) records release `20260910173632033-48931d24` on both demo sites. Its live checks cover authenticated loading and layout; write workflows were checked against the isolated API, not by creating records on the public sites.
