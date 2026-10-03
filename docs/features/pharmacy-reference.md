# Pharmacy-1 — Phial reference workspace

Pharmacy-1 imports the Phial application from `reference/frontend/pharmacy-1/phial` into the shared frontend library. Select **Pharmacy-1** in the header. Its original workspaces and record links are hosted inside the existing shell; the header and sidebar are not duplicated.

## Pages and workflow

| Sidebar | Use |
| --- | --- |
| Command center | Prescription queues, current activity, revenue tasks and stock alerts |
| Rx workbench | Intake, safety review, verification, partial filling, checking, handover and returns |
| Counter sale | Permitted counter supply, invoice and simulated payment |
| Customer orders | Collection/delivery orders, stock reservation and fulfillment |
| Sales and returns | Issued sales, eligible partial returns and credit records |
| Inventory | Products, batch stock, expiry, quarantine, adjustment and trace |
| Purchasing | Reorder suggestions, purchase approval, send and actual receipt |
| Prior authorizations | Requested and adjudicated service quantities |
| Claims | Submission, simulated adjudication, rejection and resubmission |
| Remittance & payments | Advice reconciliation and simulated payment posting |
| Patients | Source patient records, coverage, supplies and prescriptions |
| Audit trail | Actor-attributed source status history |
| Settings | Source business configuration and trusted actor directory |

Open a patient, prescription, order or sale from its real API response. Original query identifiers remain in the web host URL; the desktop browser shell retains typed in-memory navigation targets. Web back/forward, search palette and supported keyboard shortcuts retain the original workflows. Register patient and new prescription forms use the shared modal controls. Prescription supplies remain distinct from administrations.

## Shared contract

`@pepbits/reference-pharmacy` composes the original views with `@pepbits/reference-host`, `@pepbits/ops-ui` and `@pepbits/erp-config`. Form controls, cards, tables, overlays and print output use shared primitives. Scoped CSS retains the source composition and respects effective theme, density, typography, radii, reduced motion and formatting. Theme updates follow host policy; locked settings cannot be overridden.

UI copy comes from the canonical backend English/Arabic/Hindi/Malayalam catalogs. Identifiers and clinical record content are not rewritten by localization. Newly authored in-app guides are published as `2026-10-01-pharmacy-reference-import`; translated drafts retain pending human review.

## API, scope and permissions

All business data comes from the authenticated `/reference-modules/pharmacy` demo API, not hardcoded frontend records. The original Express service runs privately in a scope-owned worker with SQLite persisted beneath the API data directory. A reusable worker broker hashes authenticated tenant/application/branch scope, retires idle workers and refuses unsafe paths. The browser cannot select an arbitrary actor through `x-user` or the original user switcher.

Administrator, pharmacist, technician, billing and viewer grants are checked on the server. Technician verification and viewer writes are denied. A role name from a source directory does not grant host access. Authenticated actors are projected into the source directory so historical references resolve. Module selection is navigation, not clinical authority.

Mutations require an operation key. The trusted actor, domain changes, status history and durable replay result commit together; validation errors roll back. Identical retries return the original result and changed payloads conflict. Stock eligibility, quantities and state transitions remain enforced by the source service. Scope changes dispose frontend caches and pending reads.

## Failures and boundaries

A missing grant, invalid scope, unavailable worker, stock shortage or invalid transition produces an explicit API failure. Supported local form values remain visible after failed requests; they are not durable clinical drafts. Review unsaved work before changing branch.

This is a fictional demonstration application. Payer decisions, eRx intake and payments are simulations; bank, payer and production prescribing connections are not activated. Source currency/license/tax examples are illustrative and require deployment governance. The source allows single-pharmacist checking and labels it; this import does not assert independent maker-checker enforcement or clinical accreditation. Audit retains source transition history and records authenticated commands that have no source status transition, without including their request payload. It is not a hash-chain certification. Native-speaker clinical review and native executable testing are separate pending acceptance activities.

## Verification

See [release scope and evidence](../releases/unreleased/pharmacy-reference-2026-10-01.md) and [source provenance](../reference-import/PHARMACY-SOURCE.json). Public deployment is complete only after the isolated site release marker and authenticated browser checks pass.
