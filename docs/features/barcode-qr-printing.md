# Barcode, QR and label printing

The Library contains seven API-backed pages: Item barcodes, Specimen labels, Patient wristbands, QR codes, Payment QR, Batch printing and Printer profiles. They share one TypeScript workspace and reusable preview/print components. The demo uses synthetic records; existing clinical and inventory records are not automatically registered as label sources.

## User flow

1. Open a Library printing page. Select a backend template and a compatible paper profile.
2. Select records and copies, then choose Generate preview from API. The server obtains identifiers and business values; the browser cannot supply a barcode payload, invoice amount or payment destination.
3. Verify the patient/sample/item identity and readable details against the source record.
4. Open Preview and print / PDF. The sheet uses physical millimetres, with approved margins and separate pages. Choose Request print, actual size (100%) and no browser headers/footers. Select Save as PDF in the browser dialog when required.
5. Open Print history to revisit jobs. Reprints require a reason of at least five characters and tenant permission. Print requests are recorded before opening the browser dialog. Cancellation still leaves a requested attempt; the application does not claim physical completion.

Use the wristband profile for patient bands. A4 uses two columns; a wide band does not fit that profile. The API rejects incompatible dimensions, excessive copies, duplicate/missing records and records from another template category. Choose an appropriate profile rather than shrinking a barcode to fit.

## Available codes and templates

The backend uses the pinned `bwip-js` dependency for Code 128, EAN-13, Data Matrix, QR, GS1-128 and GS1 DataMatrix. The GS1 examples use synthetic GTIN/lot data in GS1 element syntax. Generic Data Matrix and GS1 DataMatrix remain distinct templates. These examples do not certify a label for a clinical standard, scanner or printer.

Templates are read from `mock-api/config/label-printing/templates.json`; source records from `records.csv`. Generated artwork is returned as an SVG image data URL and rendered through an image element, never injected as HTML. No encoder is shipped in the frontend bundle.

The original reference implementation and API for the encoder are documented by [bwip-js](https://github.com/metafloor/bwip-js). See [GS1 DataMatrix guidance](https://www.gs1.org/standards/gs1-datamatrix-guideline/25) for production GS1 data and symbol requirements.

## Payment QR

Invoice-specific and static merchant-link templates encode reserved `example.invalid` URLs. The backend owns the synthetic invoice amount, identifier, destination and five-minute expiry. Creation and printing do not mark a payment paid. An administrator can explicitly simulate Paid or Failed; otherwise the frontend refreshes pending status and the server derives Expired. Expired or completed payment jobs cannot be printed again.

No customer can pay through these demo codes. Production requires a provider adapter, validated provider payloads, verified callbacks/webhooks and reconciliation against the original invoice. Payment-scheme formats such as EMV merchant-presented QR require their own implementation; a QR image alone is not that integration. See [EMVCo QR specifications](https://www.emvco.com/emv-technologies/qr-codes/).

## Architecture and integration

| Boundary | Responsibility |
| --- | --- |
| erp-config | LabelTemplate, PrinterProfile, LabelPolicy, LabelArtwork, LabelJob and command contracts |
| erp-data | Injected authenticated LabelAdapter over POST /label-printing |
| erp-screens | LabelPrintingWorkspace, CodePreview, LabelPreview, WristbandPreview, PrintSheet and LabelPrintDialog |
| ops-ui | Existing fields, cards, tables, overlays, recovery and PrintDocument primitive |
| demo API | Source lookup, encoder, policy validation, idempotency, expiry, scoped CSV persistence |

Copyable TypeScript examples are on each page. Pass `createLabelAdapter(authenticatedRequest, applicationId)`, effective preferences, tenant policy, preference availability and a scope key containing tenant/application/user. The host remounts on identity changes; the server independently derives authority from the authenticated session.

POST commands: `library`, `create`, `job`, `print`, `simulate`, `preference`, `policy`. Mutations require an operationId. Repeating an identical operation returns its original result; changing its contents with the same identifier returns a conflict. The API accepts selected record IDs, not arbitrary identifiers or markup. For another application, supply a new adapter and backend source resolver mapping those IDs to authoritative business records.

Job snapshots, per-user profile defaults, retry receipts and tenant policies are written atomically to `label-printing.csv` in RECORD_DATA_DIR (or the normal demo data directory). Tenant/application buckets and owner checks prevent cross-scope reads. Administrators can inspect jobs inside their own tenant/application. Policy updates require the current policy version and administrator authority. The CSV store is single-process demo persistence, not a production database or tamper-proof audit service.

Install the backend dependency with `npm ci --prefix mock-api`. `run.sh install api` now recognizes that the API has dependencies. Both frontend deployment packages remain independent of the encoder; deploy/install the demo API separately when required.

## Preferences and tenant locks

The interface inherits effective theme, font, density, language, number/date/time and table preferences. The shared table retains managed presentation. Screen preferences do not change printed barcode geometry, quiet zones or black-on-white contrast. Physical output intentionally uses a stable print font and LTR symbol presentation; localized UI controls surround synthetic demo labels.

Printer profiles define paper dimensions, columns, margins and gaps. Users may save a default unlocked profile through the API. Tenant administrators can lock a profile, cap copies and disallow reprints. Locked profiles override client selections, including old jobs; changed policy is checked on each new request. Backend configuration owns which fields appear; field-level policy editing is not included in this first version.

## Recovery, testing and boundaries

Recoverable errors retain selections and the pending operation ID. Validation and permission failures unlock the form so users can correct their request. No local browser patient/job persistence is added. Browser printing does not identify or silently select a physical printer; a profile describes stock, not an OS printer connection.

Automated coverage is in `mock-api/label-printing-store.test.mjs` and `desktop-clients/e2e/label-printing.mjs`. Backend tests cover all advertised encoders, persistence, idempotency, isolation, limits, profile fit, reprint rules and payment states. Browser tests cover batch layout, print-media isolation, requested-only history, wristbands, payment simulation and administrator profile locking.

Pending external work: actual thermal/native printer adapters, printer acknowledgments, physical scanner/readability testing, provider-specific real payments, clinical identification acceptance, native-speaker review, production retention/audit storage and mappings to real patient/sample/inventory services. Direct downloadable server PDFs are not generated; PDF output uses the browser print dialog. Deployment status and exact live verification are recorded in the delivery record; commits and pushes are separate actions.

## Verification examples

See the [delivery record](../releases/unreleased/barcode-qr-printing-2026-09-10.md) for exact source identity and test scope. A [synthetic A4 label-sheet PDF](../releases/unreleased/evidence/label-printing/specimen-sheet.pdf) demonstrates browser output. Decoder checks use native SVG dimensions and pure-code mode; no physical scanner certification is claimed.

### 10 September: compatible stock selection

The paper selector lists stock that fits the selected template, including margins, columns and gaps. If a personal default does not fit, the preview selects compatible stock without changing the saved preference. Label and paper dimensions are visible. A tenant-locked incompatible profile stays locked, shows a localized field error and prevents generation. The API repeats the fit check and identifies `profileId` in validation errors. For example, the 80 × 80 mm payment QR cannot fit 110 × 40 mm wristband stock; A4 is compatible.
