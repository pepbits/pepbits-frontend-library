# Healthcare Suite revenue cycle workspaces

Feature ID: CAREPOINT-RCM. Updated 29 September 2026. Current state: deployed to the isolated public test site on release `20260929122358894-3da821b0` from source `4fec17b5b482732d3e418879c8a3450108a6515f`; public synthetic acceptance passed. Publication and deployment are recorded separately in the [delivery record](../releases/unreleased/healthcare-suite-rcm-2026-09-29.md).

## Coverage and navigation

Choose **Healthcare Suite** in the existing module header, then open its **Revenue cycle** navigation group. Nine workspaces extend the original pages without replacing the existing Healthcare module or its clinical backend.

| Workspace | Supported workflow |
| --- | --- |
| Claims | Ordered payer coordination, claim creation/adjudication, denial and appeal evidence |
| Exchange | Server-configured MockIns JSON/XML REST and SOAP 1.1/1.2 requests, delivery tracking and advice |
| Remittances | Payer receipts, allocations and compensating clawbacks |
| Patient finance | Patient credits, deposits, approved refunds and provider reconciliation |
| Packages | Published entitlements, reservation, consumption and case-rate excess splitting |
| DRG/day-case | Configurable synthetic grouping and an explicit licensed-provider boundary |
| Accounting | Balanced journal, incremental GL export and reconciliation |
| Commercial | Versioned pricing proposals, distinct maker/checker publication and tax/rounding controls |
| Receivables | Patient/payer balances, collection intents, ageing and operational reports |

This is a synthetic application integration. It is not a certified DRG grouper, real bank connection, jurisdiction tax approval or live payer accreditation. The host implements authentication; the dedicated mock repository implements external provider behavior. Browser components do not fabricate success responses.

## Step-by-step operation

1. Sign in to the host with an authorized demo identity. Select the branch in the host and the facility in Healthcare Suite. Wait for the session and workspace to load.
2. Create and sign clinical orders through the original encounter workflow. Create an invoice there. Import that invoice into RCM using its actual source identifier; the API resolves its patient, facility, currency and amounts.
3. Configure the ordered payer sequence and create a claim against the appropriate remaining liability. Patient and payer responsibility are separate. Patient payments cannot settle or refund the payer's liability.
4. In Exchange, select an enabled profile and operation, queue a request, then dispatch it. Review delivery state and any provider validation. Apply a valid remittance advice through its explicit command rather than a client-entered success flag.
5. Use Remittances for payer receipts and clawbacks, Patient finance for credit/deposit/refund work, or Receivables for patient collection. Reconcile pending or uncertain provider operations before treating them as completed money movements.
6. Publish package, grouping or commercial configuration only with the required authority. Commercial approval requires a different actor from the proposer. Reserve package allowance before consumption; retain consumed history after cancellation.
7. Review the balanced journal and reports. GL export creates a separate export record and does not rewrite earlier journal rows. Repeating an operation with the same key returns its committed result; changing its payload with that key is a conflict.

## Permissions, preferences and recovery

Trusted host roles provide read, claims, finance, configure, approve and export capabilities independently. Finance access does not grant clinical registration writes. The backend checks tenant, application, branch, active facility, role and command scope; a hidden button is not the control. The synthetic reviewer identity supports testing a distinct maker/checker and does not establish a production identity policy.

Shared form controls, cards, tables and host formatting/localization preferences are used throughout. Scope changes remount the workspace so an old branch or facility form cannot be submitted in the new scope. Validation preserves input. A version conflict offers reload while retaining the draft; a business conflict reports its reason. These tab-local values are not durable draft storage.

The parser rejects malformed or unsafe monetary values. Amounts use integer minor units server-side. Source invoice collection/cancellation is blocked after RCM import; imports and original collection commands share a per-invoice lock. Neither route can independently collect the same responsibility concurrently.

## Data and integration contract

The module uses authenticated `GET /reference-modules/healthcare-suite/api/rcm/workspace` and `POST /reference-modules/healthcare-suite/api/rcm/commands`. Commands carry expected workspace version, currency, idempotency key and typed business fields. The workspace exposes records, capabilities, policy provenance, reports and provider boundaries. Server environment settings select private provider endpoints/keys; the frontend never receives those keys.

The host persists original source tables and retry records alongside RCM state. Original invoice identities and stock deductions survive restart. Atomic file replacement and a single-writer lease protect this synthetic service; it is not a replacement for a transactional production database or multi-instance deployment. An unrecognized writer lock fails closed and requires an operator to verify that no writer is live before recovery.

MockIns supports USD/EUR/INR/AED without conversion, and a configured payer-level limit from 2 to 20 (default 3). The host and provider limits must agree when exercising fourth/fifth and later payers. The isolated test deployment configures a maximum of five payers and AED flows. Payment/refund and collection providers use actual loopback HTTP on ports 33413/33414, scoped identity, bounded responses and correlation checks. Pending or lost responses preserve operation ownership for reconciliation.

Live activation requires provider-specific contracts, credentials, payer acceptance, payment settlement and licensed grouping content. Corrected Healthcare Enterprise services remain the production domain owners; this module does not copy known AV-RCM financial defects into that application.

## Verification boundary

See the [design](../architecture/HEALTHCARE-SUITE-RCM-DESIGN.md), [workstream tracker](../tasks/HEALTHCARE-SUITE-RCM-2026-09-29.md) and [delivery evidence](../releases/unreleased/healthcare-suite-rcm-2026-09-29.md). Retained test results identify the actual source and distinguish local API/unit checks, real simulator HTTP, browser acceptance and deployment. Draft Arabic/Hindi/Malayalam translations still require native review.
