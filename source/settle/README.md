# Settle — patient billing desk

A full redesign of the InstaHIS patient billing, receipts, advances and deposits workflow. Next.js 14 + TypeScript + Tailwind on the front, Express + SQLite behind it. Every screen works against real data in a local SQLite file — no mocks in the browser.

## Quick start

Requires Node.js 18.18 or newer (Node 20 or 22 recommended).

```bash
npm run setup     # installs backend and frontend dependencies
npm run dev       # API on http://localhost:4000, app on http://localhost:3000
```

Open http://localhost:3000. On first start the API creates `backend/data/settle.db` and loads the demo data automatically.

For a production run:

```bash
npm run build     # builds the Next.js app
npm start         # starts both servers in production mode
```

Other commands: `npm run seed` wipes and reloads the demo data from the command line; Settings → Reset demo data does the same from the app. `npm run typecheck` checks the TypeScript.

To run the two halves separately: `cd backend && npm start` and `cd frontend && npm run build && npm start`. If the API is not on `localhost:4000`, set `API_URL` for the frontend (see `frontend/.env.example`).

## Demo users

Switch user from the avatar menu in the header — rights change what each person can do, and the screens explain why an action is unavailable.

| User | Role | Can do |
|---|---|---|
| Priya Nair | Administrator | Everything |
| Rahul Verma | Billing executive | Bills, charges, discounts, refunds, reopen, cancel, write-off requests, insurance |
| Anita Das | Cashier | Bills and payments, deposits, set-off, close counter. No refunds |
| Suresh Pillai | Finance manager | Approvals, cheque realization, refunds, receipt edits, reports. No counter by default |

Payments are recorded against the counter picked in the header.

## What to try

- **Desk** — the work queue (overpaid bills, dues, approvals, claims to send, cheques to realize) and today's collections.
- **Bill BL002001** — insured, overpaid on advances, blocked from finalizing by a pending lab result. Open the blood culture charge, mark the result ready, then finalize: the excess becomes a patient deposit automatically.
- **Bill BN001002** — an open Bill Now bill. Press **A**, type a test name, press Enter. Then "Collect … and close bill".
- **Card payments** — pick Credit or Debit and collect: the demo terminal lets you approve or decline.
- **Approvals** — a discount, a write-off and a cancellation are waiting. Approve the write-off and the bill closes.
- **Patient MR240107** — deposits including an uncleared cheque. Collect, refund (choose which deposits), edit payer and availability.
- **Receipts → Cheques to realize** — realize or bounce cheques in bulk. Open any receipt to edit, cancel (creates a reversal) or print.
- **Day close** — count notes, see the difference live, close the counter.
- **Reports → Finance postings** — ledger lines FIN-011 to FIN-014 with a trial balance.

Keyboard: **⌘K / Ctrl+K** or **/** search everything, **N** new bill, **?** shortcuts. On a bill: **A** add charge, **P** payment, **F** finalize.

## Screens

| Screen | Path | Purpose |
|---|---|---|
| Desk | `/` | What needs attention, today's till, recent activity |
| Bills | `/bills` | All bills; summary figures double as filters |
| Bill workspace | `/bills/[billNo]` | Charges, sponsor split, payments, approvals, history, lifecycle actions, settings |
| Patient accounts | `/patients`, `/patients/[mrNo]` | Deposits, dues across bills, points, visits, receipts |
| Receipts | `/receipts` | One ledger for receipts, refunds, sponsor payments and deposits |
| Approvals | `/approvals` | Discounts, write-offs and cancellations in one queue |
| Day close | `/day-close` | Day book by counter, cash count and closure |
| Reports | `/reports` | Collections, daily consolidated, patient dues ageing, sponsor dues, deposit balances, reward points, finance postings |
| Audit trail | `/audit` | Every change with before/after values |
| Settings | `/settings` | Payment modes, counters, number series, discount categories, rate plans, users and rights, preferences |
| Print | `/print/bill/[billNo]`, `/print/receipt/[no]` | Bill, itemized statement, receipt and vouchers |

The layout has a header, footer and sidebar. The sidebar starts collapsed, expands on hover or click, and collapses again on every page load. All pages are full width and responsive down to phone size.

## Business rules implemented

**Bill lifecycle** — Open (A) → Finalized (F) → Closed (C), Reopen back to Open, Cancel from Open (X). Every check is evaluated on the server and returned with plain reasons, so disabled buttons say why.

- *Finalize* needs at least one charge, no pending test results, no discount or cancellation awaiting approval. Backdating needs the right. Overpayment first trims deposit set-off and points, then posts a refund receipt plus a new patient deposit for the rest.
- *Close* needs patient due = 0 and, for insured bills, sponsor due = 0 — unless a write-off is approved. Closing credits reward points.
- *Reopen* needs the right, a reason code and note, and is blocked once the claim is sent.
- *Cancel* needs no order-linked charges, zero net receipts, no set-off, no points and no sponsor receipts. With the preference on, it goes to approval first.
- *Write-off* is for finalized Bill Later bills with a patient due; approval closes the bill.

**Charges and totals** — totals are recalculated in one place (`backend/src/lib/billing.js → recalcBill`) after every change. Cancelled charges keep their line with zero amounts. Round-off is a system `ROF` line. Rate plans re-rate from list price. Discounts are per item (amount or %) or bulk on selected items or by category; self-pay discounts above the threshold go for approval and block finalization; rejection restores the previous amounts.

**Sponsor split** — primary plan first on the net amount (copay %, claim cap, groups not covered), secondary on the remainder; sponsor GST on claims. Claims can be set by hand per charge and survive recalculation.

**Payments** — advance (Bill Later, open only), settlement (capped at the due), refund (needs the right, capped at receipts) and sponsor receipts (capped at sponsor due). Several modes in one save, one receipt each. Refunds are classified against the advance balance: covered → advance refund (U), none → settlement refund (S), partly → split into both. Card payments wait for the terminal before any receipt exists. No counter, no payment.

**Deposits** — belong to the patient, usable for hospital, pharmacy or both. Cheques count only after realization (or are cancelled if they bounce). Set-off allocates oldest first or as chosen. Refunds draw from chosen deposits. Package deposits are tracked by name.

### Fixes for the known issues listed in the original README

1. Deposit payer and "usable for" are always saved as entered.
2. Editing a receipt never changes its advance/settlement type, so finance accounts stay put.
3. Bill totals are recalculated in code, so cancelling or changing receipts always updates them.
4. Number series advance only when a record is actually created.
5. Receipt cancellation works with or without card integration (it voids on the terminal when there is one).

The patient-due formula is the same everywhere: patient share = charges − discount + GST − sponsor claims − sponsor GST + round-off; paid = receipts + deposit set-off + points.

## Architecture

```
settle/
├── backend/                Express API + SQLite (better-sqlite3)
│   └── src/
│       ├── server.js       app, error handling, auto-seed on empty database
│       ├── db.js           schema
│       ├── seed.js         demo data covering every bill state
│       ├── lib/billing.js  totals, sponsor split, lifecycle checks, receipts, deposits
│       ├── lib/auth.js     users and rights (demo: x-user-id header)
│       └── routes/         bills, patients & deposits, receipts & card terminal,
│                           approvals, reports & day book, admin & settings
├── frontend/               Next.js 14 App Router, TypeScript, Tailwind
│   ├── app/(app)/          screens inside the shell
│   ├── app/print/          print layouts
│   ├── components/shell/   sidebar, header, footer, search, new bill
│   ├── components/bill/    balance line, charges, payments, tabs, dialogs
│   ├── components/ui/      buttons, fields, dialogs, drawers, toasts
│   └── lib/                API client with global revalidation, types, formatting
└── scripts/run.mjs         runs both servers together
```

The frontend calls `/api/*`, which Next.js forwards to the Express server, so there is no CORS setup in normal use. Every write goes through a single SQLite transaction and is written to the audit log. After any successful change the app refreshes every visible screen, so figures never go stale.

## Before going live

This is built to production standards for a single site, with these deliberate demo choices to replace:

- **Sign-in** — the demo user switcher sends an `x-user-id` header. Put real authentication (SSO or sessions) in `backend/src/lib/auth.js`; everything else already checks rights through it.
- **Card terminal** — `POST /api/card-txns/:id/approve` simulates the bank. Call your terminal vendor there instead.
- **Database** — SQLite in WAL mode suits one server. For several app servers, move to PostgreSQL; the SQL is standard.
- **Fonts** — the Onest typeface loads from Google Fonts; self-host it if the network blocks Google.

## API summary

All under `/api`. Errors return `{ error: { code, message, details } }` with 400/403/404/409.

| Area | Endpoints |
|---|---|
| Session | `GET /meta`, `POST /me/counter`, `GET /search?q=` |
| Bills | `GET /bills`, `POST /bills`, `GET /bills/:no`, `PATCH /bills/:no/settings` |
| Charges | `GET /catalogue`, `POST /bills/:no/charges`, `PATCH /charges/:id`, `POST /charges/:id/cancel`, `POST /charges/:id/result-ready`, `POST /bills/:no/discount` |
| Lifecycle | `POST /bills/:no/finalize`, `/close`, `/reopen`, `/cancel`, `/writeoff`, `/send-claim` |
| Money on a bill | `POST /bills/:no/payments`, `POST/DELETE /bills/:no/deposit-setoff`, `POST/DELETE /bills/:no/points` |
| Card terminal | `GET /card-txns/:id`, `POST /card-txns/:id/approve`, `/decline` |
| Receipts | `GET /receipts`, `GET /receipts/:no`, `PATCH /receipts/:no`, `POST /receipts/:no/cancel` |
| Patients and deposits | `GET/POST /patients`, `GET /patients/:mr`, `POST /patients/:mr/visits`, `POST /patients/:mr/deposits`, `PATCH /deposits/:no`, `POST /deposits/:no/cancel`, `GET /deposits/unrealized`, `POST /deposits/realize`, `GET /plans` |
| Approvals | `GET /approvals`, `POST /approvals/:id/decide` |
| Day book and reports | `GET /dashboard`, `GET /daybook`, `POST /daybook/close`, `GET /reports/{collections, payment-consolidated, patient-dues, sponsor-dues, outstanding-deposits, reward-points, finance-postings}` |
| Audit and settings | `GET /audit`, `GET/POST /settings/:section`, `PATCH /settings/:section/:id`, `PATCH /settings/preferences`, `POST /admin/reset-demo` |
