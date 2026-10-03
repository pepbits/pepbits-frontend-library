# RCM Workspace reference module

The header entry **RCM Workspace** imports the original RCM reference application as its own module. It is separate from Healthcare Suite RCM and the Healthcare Enterprise application. All 40 original pages remain in their eight source sidebar categories; shared controls and the authenticated backend transport replace duplicate shell plumbing.

Business data and page definitions come from `/reference-modules/rcm`. Synthetic payer, payout, accounting export and DRG outcomes run in the backend. This module does not establish live-provider integration or certified DRG grouping.

## Pages

### Front office

- Billing home (`/`)
- Patient and encounter coverage (`/w/coverages`)
- Payer authorizations (`/w/authorizations`)
- Eligibility checks (`/w/eligibility`)
- Estimates and admission clearance (`/w/estimates`)
- Deposits (`/w/deposits`)
- Cash drawer (`/w/cash-sessions`)

### Charges and documents

- Unbilled worklist (`/w/encounters`)
- Charge detail (`/w/charges`)
- Manual charges and procedure groups (`/w/manual-charges`)
- Invoices (`/w/invoices`)
- Debit notes (`/w/debit-notes`)
- Credit notes (`/w/credit-notes`)
- Adjustments (`/w/adjustments`)

### Money

- Receipts and allocation (`/w/receipts`)
- Refunds and payouts (`/w/refunds`)
- Packages (`/w/packages`)

### Insurance

- Claims (`/w/claims`)
- Exchange monitor (`/w/exchange-messages`)
- Remittances (`/w/remittances`)
- Remittance corrections (`/w/remittance-corrections`)
- Appeals (`/w/appeals`)
- Payer reconciliation (`/w/payer-reconciliations`)
- Responsibility transfers (`/w/responsibility-transfers`)

### Receivables

- Aging (`/aging`)
- Payment plans (`/w/payment-plans`)
- Statements (`/w/statements`)
- Dunning and collections (`/w/collections`)
- Reports (`/reports`)

### Coding and models

- Coding worklist (`/w/coding-cases`)
- CDI clarifications (`/w/cdi-queries`)
- DRG grouping (`/w/drg-groupings`)
- E&M determinations (`/w/em-determinations`)
- Model settlements (`/w/model-settlements`)

### Accounting

- Journals and exceptions (`/w/journals`)
- GL reconciliation (`/w/gl-reconciliations`)
- Exports (`/w/exports`)

### Cross-cutting

- Approvals inbox (`/approvals`)
- Workflow worklist (`/w/tasks`)
- Assistance (`/w/assistance`)

## Access, persistence and transactions

The host session supplies identity and tenant/application/branch scope. Source fictional branch/currency filters use `x-rcm-scope` and never provide host branch authority. Reference stores are partitioned by authenticated ownership, persist on disk and refuse destructive reseeding of existing stores.

Accounts have roles `rcm-reference-admin`, `rcm-reference-clerk`, `rcm-reference-supervisor`, `rcm-reference-insurance`, `rcm-reference-accountant`, `rcm-reference-coder` and `rcm-reference-viewer`. Enterprise administrators may use the module. Viewer capabilities are read-only; other roles receive only their permitted action definitions, with independent server checks. Original approval rules still require a different person for protected financial decisions.

Commands require durable idempotency keys. Record changes, source financial effects, audit history and command replay results commit together. Changed-content retries conflict; failures roll back. Original row versions prevent stale changes. An excessive credit is rejected without changing the source invoice balance.

## Shared presentation

Host module/branch navigation, authenticated transport, source-style native controls, table semantics, overlays, localization and preferences are reused. Original RCM body layouts, worklists, ledgers, boards, dashboards, lifecycle maps, detail panes, new-record forms, command palette and query links are retained. Host theme, form/result scales, managed tables and accessibility preferences remain supported.

MedBand default controls retain the source teal colors and geometry. Scoped specificity and cascade ordering prevent shared host utilities from changing the original control appearance. Original reference files remain unchanged.

## Validation

Use `npm run test:rcm-reference-api`, package tests, full typecheck/API/UI gates and `e2e/rcm-reference.mjs`. MedBand real-browser control comparisons are opt-in through `MEDBAND_BROWSER_PARITY=1`; they require the documented diagnostic browser runtime. Unit test fixtures are test-only; shipped frontend modules contain no synthetic business-data fallback.

Release evidence records the exact deployed source and browser results. Translation drafts require native/domain review; a web deployment does not establish native executable acceptance.

Source Public Sans and Bricolage Grotesque fonts are bundled locally under their OFL licenses; the imported pages do not depend on a third-party font service. The existing host typography remains unchanged.
