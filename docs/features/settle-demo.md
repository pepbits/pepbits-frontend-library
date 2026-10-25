# Independent Settle billing demo

Feature ID: STL. State: all Settle patient billing screens ported as an independent app over the unchanged Settle API, with the deliberate differences listed below. Local build and real-HTTP verification pass: 20 workflows and 29 route variants, with zero runtime/console/HTTP errors or axe violations. Unit/typecheck and prior CI/shell Chromium scopes are recorded separately. [Delivery record](../releases/unreleased/restructure-phase-6e-4-2026-10-24.md), [test guide 1.0.0](../testing/v1.0.0/PRE-COMMIT.md). Local verification only; fictional billing behaviour is **not billing, accounting or clinical acceptance**.

## User problem and outcome

The Settle patient billing desk (bills, receipts, advances, deposits, approvals and day close) previously ran only as its own Next.js 14 frontend. It now runs in a separate library app, `@pepbits-demo/settle`, inside the shared shell with host sign-in, preferences, tenant policy and localization, while every billing rule stays in Settle's own unchanged Express + SQLite API. The [app guide](../../demo-apps/settle/README.md) explains setup and routes; the [source mapping](../../demo-apps/settle/source-mapping.md) lists where each source responsibility went.

## User and administrator flows

1. Start the demo host API and the Settle API, then the app. Sign in with a local fixture account through the shared login screen. The Settle **Desk** shows the work queue (overpaid bills, dues, approvals, claims to send, cheques to realize), today's till and recent activity.
2. Pick a **counter** in the desk bar; payments are recorded against it, and no counter means no payment. Switch the **desk user** (Priya, Rahul, Anita, Suresh) to see how rights change the screens. The Settle API checks every right for that desk user; hidden or disabled actions explain why.
3. **Bills**: summary figures double as filters; search, status/type/insurance filters and sort are part of the URL. Open a bill.
4. **Bill workspace** (`/bills/BL002001`): the balance line reads charges − discount + tax − sponsor = patient share, then paid and due. A pending lab result blocks finalize and the reason is shown. Open the blood culture charge, mark the result ready, then finalize: the server moves the overpayment to a patient deposit. Charges support quick add (type, arrows, Enter), bulk/per-item discounts with approval thresholds, rate changes, sponsor claim overrides and cancellation. Sponsor split, payments, approvals and history are tabs. Reopen, cancel and write-off need a reason; lifecycle checks are evaluated on the server.
5. **Bill Now** (`/bills/BN001002`): press **A**, type a test, press Enter; then "Collect … and close bill". Card modes wait for the demo terminal (approve or decline) before any receipt exists. After a payment the rail offers the receipt print link.
6. **Patient accounts**: deposits (collect, refund from chosen deposits, edit payer/usable-for, cancel), dues across bills, reward points, visits and receipts. Register a patient or start a new bill for them.
7. **Receipts**: one ledger for receipts, refunds, sponsor payments and deposits; filter, export, open any receipt to edit, cancel (reversal) or print; realize or bounce cheques in bulk.
8. **Approvals**: discounts, write-offs and cancellations in one queue; approve (optional note) or reject (note required). Approving the write-off closes the bill.
9. **Day close**: day book by counter, count notes and coins, see the difference live, explain any difference and close the counter.
10. **Reports**: collections, daily consolidated, patient dues ageing, sponsor dues, deposit balances, reward points and finance postings with a trial balance; export in the effective format. **Audit trail** shows every change with before/after values. **Settings**: payment modes, counters, number series, discount categories, rate plans, users and rights, Settle billing preferences and demo reset (administrators).
11. Open **Preferences** from the shell for language, theme, formatting, density, shortcuts and motion; tenant locks disable conflicting choices. Settle's own billing preferences are a separate server setting in Settings.

## Integration and failure behaviour

The public page-renderer registry receives one page definition per Settle screen. `ApplicationProviders` composes session, preferences, runtime localization and the EnterpriseShell against the demo host API. The Settle transport receives a configured base URL, sends the desk user as `x-user-id` (source demo contract), validates paths and maps the `{error: {code, message, details}}` envelope. There is no component origin, no other-demo import and no frontend data fallback; frozen fixtures are test-only. Public ResourceScope/useFetch abort obsolete reads and prevent old path/identity data from being displayed. Every successful write revalidates mounted Settle queries; an identity change also clears desk editors. Bills, receipts and audit send the effective page size to the server. Failures keep entered values and show the server's reasons; an unreachable API is reported in the status footer and on the affected screen. Durable drafts are not added (source forms are mounted state).

## Compatibility, localization and accessibility

Effective theme tokens (including dark and high-contrast themes), font family and form/result scales, radius, table density/page size/stripes/sticky header/wrapping, date/time/number/currency formatting, export format, shortcuts/hints, loading skeletons, toast presentation and reduced motion apply. The source palette is mapped onto semantic tokens; fixed print paper colours are deliberate. Settle copy has no canonical catalog keys: labels that already exist in the shared catalogs translate (for example section titles in Arabic) and other wording stays English until the protected canonical catalogs gain Settle keys. Arabic switches direction and directional icons mirror. Four-profile route tests cover default, Arabic RTL, reduced motion and a locked density with axe; browser axe in Chromium includes colour contrast. Automated checks do not establish assistive-technology, language or billing acceptance.

## Acceptance and limitations

| ID | Contract and verification |
| --- | --- |
| STL-01 | Shared sign-in/provider chain, Settle sidebar groups, desk bar, deep links and not-found |
| STL-02 | Every route (13 pages, report and settings sections, print variants, preferences) renders under four preference profiles with no axe violations |
| STL-03 | Configured Settle transport: base URL, desk user header, envelope mapping, offline and path validation |
| STL-04 | Bill lifecycle: gated finalize with reasons, result ready, finalize with overpayment to deposit, reopen with reason, collect-and-close, card terminal |
| STL-05 | Deposits, receipts, cheque realization, approvals and day close through the API with value retention on failure |
| STL-06 | Reports export in the effective format, audit search, Settle settings and read-only rights for non-administrators with server 403 |
| STL-07 | Preferences: serialized revisions, tenant locks, mounted language change; shortcuts listeners follow the preference |
| STL-08 | Forced root CI, production build, shell Chromium, real-HTTP workflows, documentation and protected-path scans |

Remaining: Settle copy in the canonical catalogs (protected), live counts in the shell sidebar (shown in the desk bar instead), host toast actions (replaced by inline print links), right-based hiding of Reports/Audit in the shell sidebar (the pages show the server's refusal), durable drafts, physical printing, and human accessibility/localization/billing review.

## Operations and support

Run the host API with Node 24 and the Settle API with the Node that installed its native SQLite module. The integration launcher owns temporary storage, both APIs, the Next server and the browser, and stops them on success, failure, cancellation or deadline. Keep credentials and headers out of receipts. Removing the app does not change the original Settle frontend/backend or other demos.
