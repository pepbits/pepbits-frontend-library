# Reference-only runtime guide audit — 11 September 2026

## Scope and result

Source review at `20b36b0fad10cc26b00012c148a3d7ca90a9d472` of the 168 pages marked `domain workflow authoring required` in [the backlog](backlog.json). This is a documentation/source audit; no deployment or browser acceptance is claimed. The inventory below assigns every page exactly once using the registry's explicit kind/entity settings, its fallback rules and the renderer branches.

These pages render screens, but a screen title is not evidence of a complete domain workflow. Of the 168 pages, **123 render the shared worklist**, **22 render the shared report**, **8 render module dashboards**, and **15 use other platform screens**. Within the 123 worklists, 79 use generic generated rows and 44 use shared fixture families. A page called Patient Merge, Bank Reconciliation or Payroll Run is therefore not proof that those operations exist.

The current backlog contains **168 authoring issues, 516 incomplete translation entries and 429 current translations awaiting native review**, totaling **1,113**. The 147 authored guides are not all completely translated: customer-master, patient-master, preferences and documentation-center each have incomplete Arabic, Hindi and Malayalam entries (12 entries, including field/tour metadata). These counts describe the reviewed baseline; completion work must regenerate them instead of retaining stale totals.

## How the source was traced

- [Navigation registry](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/packages/erp-config/src/navigation.ts): explicit page types/entities, fallback kind and entity-name derivation.
- [Page renderer](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/packages/erp-screens/src/page-renderer.tsx): dispatches dashboards, lists, forms, billing, reports and specialized screens; new/edit/view worklist targets use DynamicRecordForm.
- [Worklist configuration](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/packages/erp-data/src/mock.ts): selects drug, prescription, consultation, patient, customer, invoice, employee, user, product, supplier or order fixture families, otherwise genericRows.
- [Entity schemas](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/packages/erp-config/src/entity-schemas.ts): specialized user, customer and consultation schemas; other entities receive general identification, assignment, detail and audit sections.
- [Lifecycle rules](README.md): authored status requires reviewed instructions; translation completeness and native-review evidence are separate requirements.

## What can be documented from implementation

### Shared worklists — 123 pages

Source: [WorklistPage](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/packages/erp-screens/src/worklist/worklist-page.tsx), [DynamicRecordForm](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/packages/erp-screens/src/forms/dynamic-record-form.tsx) and the configuration/schema sources above.

The actual reusable workflow includes searching, filtering, paging, column layout, table/card presentation, record navigation and configurable actions. New/edit/view record targets use the shared form; the form uses the record editor, validation, explicit draft/save, recovery and conflicts. Worklist inline edits remain client state: the source explicitly states there is no server copy of those generated rows. A successful form save must not be described as updating the fixture-backed worklist or executing a specialized business transaction.

Author each guide against its exact fields and enabled controls. Explain fixture provenance and transient inline changes. Do not invent domain behavior such as merging identities, reconciling bank statements, dispensing medicines, posting journals, calculating payroll or reserving beds. The generic form's Duplicate record and View audit history menu callbacks only close the menu; its Submit for approval overflow callback displays a toast. Those particular menu items are not evidence of completed operations. Shared RecordApproval panels are a separate implementation and need their own verified instructions.

#### Generic row family — 79

`role-master`, `delegation-master`, `contractor-master`, `position-master`, `department-master`, `grade-master`, `location-master`, `leave-request`, `shift-roster`, `hr-policy`, `hr-numbering`, `hr-workflow`, `credit-profile`, `chart-account`, `cost-center`, `bank-master`, `tax-master`, `jurisdiction-master`, `fiscal-period`, `credit-note`, `receipt-entry`, `journal-entry`, `expense-entry`, `bank-reconciliation`, `receivables-worklist`, `journal-review`, `currency-config`, `posting-rules`, `earning-master`, `deduction-master`, `pay-group`, `statutory-master`, `bank-format`, `benefit-plan`, `payroll-run`, `payroll-adjustment`, `final-settlement`, `payroll-worklist`, `exception-worklist`, `settlement-review`, `pay-calendar`, `pay-formula`, `territory-master`, `price-list`, `discount-rule`, `fulfillment-worklist`, `carrier-master`, `warehouse-master`, `uom-master`, `purchase-requisition`, `goods-receipt`, `receiving-worklist`, `valuation-method`, `patient-merge`, `next-of-kin`, `appointment-worklist`, `admission-worklist`, `bed-management`, `discharge-worklist`, `encounter-worklist`, `clinical-notes`, `vitals-worklist`, `lab-results`, `imaging-worklist`, `preauthorization`, `claim-worklist`, `denial-worklist`, `service-catalog`, `payer-master`, `clinician-master`, `controlled-reconciliation`, `pharmacy-requisition`, `pharmacy-goods-receipt`, `formulary-setup`, `dispensing-rules`, `import-export`, `bulk-operations`, `saved-views`, `shortcut-manager`.

#### Employee row family — 12

`employee-master`, `employee-onboarding`, `employee-transfer`, `employee-separation`, `attendance-adjustment`, `employee-worklist`, `approval-worklist`, `attendance-anomalies`, `fin-approvals`, `pay-approval`, `sales-approval`, `procurement-approval`.

#### Supplier row family — 5

`supplier-fin-master`, `supplier-master`, `supplier-contract`, `procurement-worklist`, `pharmacy-supplier`.

#### Invoice row family — 1

`billing-worklist`.

#### Customer row family — 2

`sales-customer`, `customer-worklist`.

#### Order row family — 11

`sales-channel`, `quotation`, `sales-order`, `sales-return`, `order-worklist`, `sales-numbering`, `sales-targets`, `purchase-order`, `reorder-worklist`, `reorder-rules`, `medication-orders`.

#### Product row family — 5

`product-master`, `item-master`, `stock-transfer`, `inventory-count`, `stock-adjustment`.

#### Consultation row family — 1

`consultation-worklist`.

#### Prescription row family — 3

`prescription-queue`, `dispense-history`, `medication-review`.

#### Drug row family — 4

`drug-master`, `stock-on-hand`, `batch-expiry`, `controlled-register`.

### Dashboards — 8 pages

Source: [ModuleDashboard](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/packages/erp-screens/src/dashboard/module-dashboard.tsx). The renderer imports dashboardData from erp-data. Document navigation, metric/chart presentation and available page links as a demonstration. Do not describe the fixtures as live operational totals or assert module-specific calculations.

`hr-dashboard`, `finance-dashboard`, `payroll-dashboard`, `sales-dashboard`, `supply-dashboard`, `healthcare-dashboard`, `pharmacy-dashboard`, `library-dashboard`.

### Reports — 22 pages

Source: [ReportsPage](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/packages/erp-screens/src/reports/reports-page.tsx). The renderer imports the shared reportRows fixture. Document the visible filters, chart/table presentation, export controls and separately implemented scheduled-report configuration. Do not claim that a named balance sheet, tax return, occupancy report or statutory return is computed from operational records. Production report definitions, calculations and data providers require domain implementation and acceptance.

`workforce-report`, `attendance-report`, `compliance-report`, `profit-loss-report`, `balance-sheet-report`, `ar-aging-report`, `tax-return-report`, `pay-register-report`, `payslip-report`, `statutory-report`, `pipeline-report`, `revenue-report`, `margin-report`, `inventory-valuation-report`, `supplier-performance-report`, `stock-aging-report`, `occupancy-report`, `los-report`, `denial-rate-report`, `consumption-report`, `expiry-risk-report`, `stock-turn-report`.

### Other platform screens — 15 pages

| Pages | Renderer/source | Evidence-based guide scope |
| --- | --- | --- |
| `user-master` | [DynamicRecordForm](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/packages/erp-screens/src/forms/dynamic-record-form.tsx), user entity schema | Identity, access assignment, security and default-setting fields; validation and record/draft recovery. A field storing a role or MFA choice does not itself provision an identity provider. |
| `billing-entry`, `sales-invoice` | [BillingPage](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/packages/erp-screens/src/billing/billing-page.tsx) | Shared invoice editing/calculation, line controls and record save; distinguish demo calculations from accounting posting or real payment collection. |
| `consultation-entry` | [ConsultationPage](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/packages/erp-screens/src/consultation/consultation-page.tsx) | Existing configured consultation builder and record editor, with selections, prompts, documentation, coding and orders. This is distinct from the new consultation-entry-design/v2 pages. Clinical/code correctness requires qualified validation. |
| `spreadsheet-studio` | [SpreadsheetPage](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/packages/erp-screens/src/spreadsheet/index.tsx) | Actual cell editing, range paste, Excel/CSV import, export and cost recalculation; explain local scratchpad lifetime. |
| `theme-studio`, `accessibility`, `page-catalog`, `component-contracts`, `keyboard-shortcuts`, `integration-guide` | [LibraryReferencePage](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/packages/erp-screens/src/library/reference-pages.tsx) | Real theme/radius and accessibility preference controls; searchable accessible page catalog; component contract links; shortcut preference/list; provider/preference/adapter integration explanation. Preview inputs are demonstrations, not business records. |
| `notifications`, `messages` | [InboxPage](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/packages/erp-screens/src/inbox/inbox-page.tsx) | Inbox reading/actions and record navigation according to actual backing service; do not imply external email/chat delivery merely from page names. |
| `ai-administration` | [Page renderer](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/packages/erp-screens/src/page-renderer.tsx), AiAdministration from ai-ui | Provider/policy/credential configuration, access restrictions and configured provider limitations. This page explicitly disables its own assistant. |
| `error-monitor` | [ErrorMonitor](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/packages/erp-shell/src/error-monitor.tsx) | Sanitized incident listing/details and implemented monitor actions; distinguish demo incident storage from production observability. |

## Misleading page names that need special care

`import-export`, `bulk-operations`, `saved-views` and `shortcut-manager` currently fall through to generic worklists. Their names must not be used to write instructions for a dedicated import wizard, batch-operation console, saved-view manager or shortcut editor. Real import/export and saved-view features exist within other shared components; document those features at their actual entry points.

Likewise `patient-merge`, `bed-management`, `bank-reconciliation`, `controlled-reconciliation`, `payroll-run`, `pay-formula` and `statutory-master` are generic worklist/form destinations in this audited set. Specialized Page Library templates do not silently turn those original destinations into production domain implementations.

## Practical completion sequence

1. Correct the 12 incomplete entries on the four already-authored guides, including fields and tours, then refresh translation hashes. This is bounded work that can be completed without inventing workflows.
2. Author the 15 distinct platform-screen guides from their controls, data lifetimes, actual validation and failure paths. Describe the six reference screens as reference/preview tools; authored documentation does not mean the screen became a transactional module.
3. Prepare family guides for the 123 worklists and 30 report/dashboard screens. Each page needs an explicit field/configuration check and a limitation statement. Promote to authored only when those instructions accurately describe the current demonstration. Domain workflow approval remains separate.
4. Add a new runtime documentation release snapshot, preserve prior snapshots, translate every paragraph/field/tour, regenerate backlog and run lifecycle/contract checks. Test contextual Help and relevant conditional tour targets in each supported language.
5. Produce review packets for native speakers and domain owners. Record reviewer identity, date and evidence only after actual review. Automated or model-authored translations cannot clear native-review status.

The source audit, inventory and review packets can be finished in this review. A truthful claim of all 168 domain workflows being complete cannot be achieved by bulk-renaming reference guides or repeating generic instructions. The current implementation boundaries and outstanding native reviews must remain visible.
