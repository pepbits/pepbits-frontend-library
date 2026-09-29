# Healthcare Suite RCM development design

29 September 2026. Implementation in progress. This extends `reference-healthcare-suite` in the shared frontend library. Existing Healthcare, ERP, School and their backend services retain their own application boundaries.

## Ownership and integration

The shared host authenticates the actor, application, module and branch. The Suite selects an authorized facility inside that scope. Reusable RCM components use the injected transport and shared form, table, localization and preference infrastructure. The browser contains no business-data simulator.

The demo API owns RCM commands, financial calculations, state transitions and provider adapters. Financial state is durable and independently partitioned by tenant, application, branch and facility. Existing Suite invoices can be imported only through a trusted server reader, with currency pinned by the server and source facility verified. Import does not issue stock or recognize revenue a second time. Once imported, original invoice collection/cancellation must be blocked so RCM remains its financial owner.

Healthcare Enterprise already implements comparable domain owners. Its contracts and corrected behavior supply reuse references. AV-RCM is a design reference; documented approval, revenue, remittance, deposit and coordination defects must not be copied into this module.

## Workspaces and intended commands

| Workspace | Behavior and invariant |
| --- | --- |
| Claims, payers and appeals | Configured ordered payer chain, including fourth and later payers. Each successor preserves prior adjudication evidence and cannot claim or collect beyond the remaining authorized liability. Denial and appeal actions retain history. |
| Payer connections | Effective scoped connection profiles select JSON/XML REST or SOAP. Provider URLs and credentials are server configuration. Durable submission keys and unknown-outcome recovery precede retry. Transport acknowledgement and adjudication remain separate. |
| Remittances and clawbacks | Allocate advice to its claim/invoice with duplicate protection. Corrections append compensating entries and preserve original advice; cash, write-off and patient responsibility are distinct. |
| Refunds, credits and deposits | Credit reduces liability; refund pays back eligible settled funds; deposit application and refund compete against the same locked available balance. Maker/checker cannot be the same actor. |
| Packages and case rates | Reserve/consume entitlement under concurrency; cancellation releases unused reservation only. Case-rate included/excess allocations reconcile to the source amount without duplicate charges. |
| DRG and day-case grouping | Capture coded input and versioned grouping result. Synthetic adapter remains explicitly demo; licensed vendor content and deployment acceptance are required for production use. |
| Accounting and reconciliation | Balanced journal legs, immutable source links and idempotent posting. Reconcile source activity and journal totals; configuration cannot authorize an unbalanced journal. |
| Commercial governance | Draft, review and publish immutable pricing/tax versions. Separate maker/checker, bound percentage/amount fields and preserve currency/rounding evidence. Branch overrides inherit tenant policy deterministically. |
| Receivables and collections | Invoice balance follows charges, credits and applied settled funds. Collection, aging and statements use the same scoped ledger rather than editable paid flags. |

## Contract and persistence

`GET /api/rcm/workspace` returns scoped state, version, currency and command capabilities. `POST /api/rcm/commands` uses an explicit `kind`, expected version and idempotency key. Commands reject changed payloads under a reused key, stale versions, invalid scope/currency, unsafe integer amounts and unauthorized actors. Errors preserve existing state.

Monetary values are safe integer minor units with an explicit currency. Percentage calculations and rounding are server-owned. Version, command result, append-only action/journal records and outbox evidence commit together. Retry after a lost response returns the original result. Restart reloads durable financial state. This is a synthetic demo service, not the production authentication or storage system.

Payer chain limits are configuration bounds, not a two-payer or three-payer schema assumption. Prior payer evidence is ordered, unique and strictly earlier than the current payer. Protocol encodings must preserve the same semantic validation. Real provider activation requires credentials, profile validation and jurisdiction-specific acceptance; mock tests do not establish that acceptance.

## Verification gates

Required automated checks cover every workspace command plus negative scenarios: fourth/fifth payer, cross-tenant/branch/facility denial, unauthorized role, self-approval, stale version, changed-key conflict, duplicate response, rollback, restart, concurrent last balance, balanced journal and conservation across credit/refund/remittance/clawback/package allocation. Actual HTTP tests exercise the dedicated provider simulator rather than frontend interception. Browser checks cover navigation, actionable forms, failure/retry and effective presentation preferences.

Evidence must retain source identity, execution time, parameters and results. User guides and pending records must state the verified scope. Live payout/payer certification and licensed DRG acceptance remain external activation requirements, even after mock acceptance passes.
