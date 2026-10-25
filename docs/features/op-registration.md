# OP Registration

Feature ID: **OPREG**. State: implemented; local verification recorded in the [delivery record](../releases/unreleased/op-registration-2026-09-10.md). Page: `/library/op-registration`, under Page Library and List of pages.

## User problem and outcome

Registration staff can select a patient, verify identity, configure a visit, review coverage and consent, and check in without changing pages. Five progress steps retain the supplied outpatient prototype's pattern. The last step contains Overview, Nursing, Consultation, Orders, Billing and Checkout tabs. The existing application shell provides navigation and Help; the prototype's separate sidebar, role impersonation, privacy curtain and lock screen are not copied.

## User and administrator flows

1. Search existing patients. Search uses the existing CSV-backed patient API, pagination and effective page size. New patient and Update patient open the shared patient record editor inside a modal. Patient identity is explicitly confirmed for each registration.
2. Enter appointment/walk-in/referral context, template, provider, clinic and reason. Review optional episode/case, referral, document and care-plan references. Schedule opens a modal on the same page. Bookings are created through the registration API; booking collisions are checked on the server.
3. Choose insurance, self-pay, sponsor or package. Demo eligibility accepts a non-expired `DEMO-` member reference; other references remain pending. Record financial exceptions rather than assuming eligibility. Review treatment consent, privacy, representative and contact choice.
4. Review details and select nursing-first or direct-provider routing. Register & check in requires identity, reason, provider, clinic and consent review. A minor additionally requires a verified representative. Duplicate active encounters in the same specialty are rejected.
5. Record nursing assessment and reconciliation. Write and sign a consultation; the original signed fields become read-only and corrections use addenda. Add and complete/cancel services. Record simulated payments, guarded discounts or reversals. Prepare/validate/simulate a claim. Visit documents provides a localized clinical preview and a print surface; Export downloads performed charges through the existing classified CSV/Excel exporter using the effective export preference. Complete checkout with instructions and follow-up ownership. Clinical completion does not depend on payment.
6. Reopen encounters from Clinical worklist. Save draft persists an unfinished registration for its owner. Restore requires fresh identity and consent review. Discard removes the draft after confirmation. Tenant draft enablement, retention and sensitive-field exclusions use the shared draft policy.

## Technical contract and integration

Public entry points are `RegistrationWorkspace` from `@pepbits/erp-screens`, `RegistrationAdapter` and `createRegistrationAdapter` from `@pepbits/erp-data`, and registration contracts from `@pepbits/erp-config`. The [catalog example](../../desktop-clients/packages/erp-screens/src/page-library/resources.ts) demonstrates authenticated request injection, memoized adapters, scope and PreferenceHost properties.

The host supplies `adapter`, `patients`, `scopeKey`, effective preferences, policy, availability and update callback. Scope is authenticated tenant/application/user; server authorization does not trust the scope string. The workspace composes shared step navigation, patient search/summary, schema-driven fields, contextual cards, care tabs and confirmation dialogs. All controls use ops-ui or the existing patient field renderer. Specialized CSS defines the five-step geometry and the scroll area between progress and actions.

`POST /op-registration` supports `config`, `load`, `worklist`, `draft`, `discard`, `checkin`, `eligibility`, `save`, `call`, `nursing`, `resolve-consent`, `sign`, `addendum`, order transitions, `payment`, `reverse`, `claim`, appointment booking, `urgent` and `complete`. Mutations include patient ID, optional record ID, expected version and operation ID. Valid retries return the saved response; stale versions return 409. The API derives author and tenant from the authenticated session. The demo administrator can write; other users with page access can read.

Configuration is in `mock-api/config/op-registration/form.json`, `providers.csv` and `services.csv`. Records, appointments, payments and retry receipts share an atomic, single-process CSV snapshot in the configured data directory. Patient demographics use the existing patient adapter and its duplicate checks. This is a demo filesystem journal, not a multi-instance production transaction database.

**Integration boundary:** these encounter records belong to the new registration adapter. They are not automatically synchronized with older standalone consultation/triage/billing template stores. A production adapter must bind all application workspaces to the same encounter service. Episode/case/document fields are references; this page does not create external clinical programs or upload supporting documents.

## Compatibility, localization and accessibility

The template adds a route and an API endpoint without replacing existing clinical pages. Theme, radius, shell/form/result scales, density, table stripes/wrapping/sticky headers, page size and date/time/number formatting follow effective settings and tenant locks. The ledger currency remains the API currency: a personal currency setting cannot relabel an AED charge as USD. Formatting preferences do not perform currency conversion.

The five-step flow and six internal care tabs are fixed workflow structure, as requested, so the generic master-record rail/tabs/wizard setting does not replace them. Patient editing continues to use its own shared record preferences. Standard keyboard navigation works through native shared controls; no duplicate custom shortcut listener is installed. No motion is required. Canonical English, Arabic, Hindi and Malayalam messages provide labels, validations and event text. Patient-entered data and provider names remain data rather than translated interface text. Help and the catalog guide use the same versioned documentation API.

## Failures, completion boundary and support

Recoverable failures retain field values and the pending operation identity. Retry resends that operation rather than creating another payment or encounter. Server validation unlocks editing. A conflict keeps the current form until the user explicitly reloads; compare values before replacing it. Saving a draft can omit excluded fields, as required by the tenant policy. Patient changes are guarded while unsaved values or a pending operation exist.

Completed: one-page frontend workflow, shared UI composition, file-backed demo data and writes, server transitions, localized message keys, contextual documentation and catalog example. The [test cases](../testing/v1.0.0/USE-CASES.md#op-registration) identify automated scope.

Pending external acceptance: native-speaker wording review, clinical/domain validation, native executable testing, real payer/payment/notification/e-signature services, multi-instance persistence, and production encounter integration. UI events do not send SMS, collect funds or contact emergency services. No healthcare accreditation or certification is claimed. Deployment is a separate action and is not implied by a local browser test.

## Local screenshots and verification

Captured with synthetic data in the local desktop web shell: [patient selection](../releases/unreleased/evidence/op-registration/01-patient.png), [visit details](../releases/unreleased/evidence/op-registration/02-visit.png), [coverage](../releases/unreleased/evidence/op-registration/03-coverage.png), [billing](../releases/unreleased/evidence/op-registration/04-billing.png), [completed visit](../releases/unreleased/evidence/op-registration/05-completed.png), [1366-pixel layout](../releases/unreleased/evidence/op-registration/06-desktop-1366.png) and [Arabic](../releases/unreleased/evidence/op-registration/ar-registration.png). See the [delivery record](../releases/unreleased/op-registration-2026-09-10.md) for commands, source identity and untested boundaries. These are local screenshots, not deployment evidence.

## Reference-style refinement — 10 September 2026

The registration content now follows the supplied HTML more closely: search precedes the segmented patient filters, patient results have initials and compact selection actions, completed progress steps show checkmarks, and later steps use a compact heading. Main panels use the larger reference heading hierarchy; source and payer choices use outlined icon cards with soft selected backgrounds. Wider reason and narrative fields, separated form sections, compact context panels and a full-width bottom action bar preserve the desktop pattern. The application shell remains shared. Theme, font, scale, density, direction and tenant policies remain effective, so the reference’s fixed teal palette does not override the user’s selected theme.
