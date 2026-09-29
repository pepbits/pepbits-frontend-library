# Healthcare Suite RCM completion tracker

Owner: primary development session. Updated 29 September 2026. Scope is the Healthcare Suite reference module in the shared frontend library and dedicated external simulators; it does not establish Healthcare Enterprise production acceptance.

| # | Workstream | Current delivery gate |
| --- | --- | --- |
| 1 | Claims, arbitrary payer chain, denials and appeals | Engine and UI implemented; scoped policies, replacement and EOB conservation pass focused tests; 53-check authenticated browser acceptance passed |
| 2 | Electronic payer exchange | Real MockIns REST JSON/XML/SOAP 1.1/1.2 and fourth-payer round trips pass; authenticated provider browser acceptance passed |
| 3 | Remittances and clawbacks | Compensating ledger and stale coordination guards pass focused tests; 53-check authenticated browser acceptance passed |
| 4 | Credits, deposits and refunds | Separate patient liability, approved refund reservations and real mock payout recovery pass tests; 53-check authenticated browser acceptance passed |
| 5 | Packages and case-rate excess | Tenant/branch publication, immutable reservations and split conservation pass tests; 53-check authenticated browser acceptance passed |
| 6 | DRG/day-case | Configurable synthetic adapter implemented/tested; licensed production content and vendor acceptance external |
| 7 | Accounting and GL | Balanced immutable journal and independent GL export tested; 53-check authenticated browser acceptance passed |
| 8 | Commercial approvals/pricing/tax | Shared tenant/branch publication and distinct maker/checker tested; final component gates/53-check authenticated browser acceptance passed |
| 9 | Receivables/collections/reporting | Patient/payer balances and actual HTTP unknown/reconcile collection lifecycle tested; 53-check authenticated browser acceptance passed |

Nine navigation destinations are registered. Finance permissions are independent of clinical registration write permissions. Original source invoice collection/cancellation is guarded after trusted RCM import. Facility changes remount the workspace to discard stale scope-specific forms.

Design: [RCM development design](../architecture/HEALTHCARE-SUITE-RCM-DESIGN.md). Source references: AV-RCM at `reference/healthcare-reference/av-rcm`, corrected domain owners in `pepbits-healthcare-enterprise`, and `tools/pepbits-mock-services/docs/RCM-PROVIDER-INDEX.md`.

Claude Code Sonnet implemented configurable mock payer-chain validation and the isolated money-provider adapter. GPT-6 Sol agents implemented the RCM engine and typed reusable UI. The primary session owns integration, financial review, documentation and acceptance. A GPT-6 Luna task supplied final recovery-label drafts. Machine translation is not native review.

Local verification completed: 1,943 frontend tests, 274 JavaScript API plus 33 clinical TypeScript API tests, 329 dedicated provider tests, both builds and every repository gate passed. RCM browser acceptance passed 53 checks and 38 UI commands, with 50 screenshots and no provider skips. Publication/deployment remain pending in the delivery record. Live payer/payout activation and licensed DRG acceptance are separate from synthetic test delivery.

Focused RCM backend verification passed 39/39. Whole API regression passed 274 JavaScript tests plus 33 clinical TypeScript tests after internal GET checks were prevented from consuming original command idempotency keys. Both initial builds and package typechecks pass; final rebuild follows dedicated DatePicker and final translation/navigation changes. Failed startup/origin/navigation attempts are retained and are not relabelled as passing runs.

The configured provider changes were committed and pushed to `pepbits/pepbits-mocking-app` on main as `54ebc3b`. Original workflow regression passed 49 checks. Test-site activation is the remaining delivery step.
