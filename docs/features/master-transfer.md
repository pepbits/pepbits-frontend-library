# Master transfer and pricing expression components

The reusable `MasterTransferPanel` accepts an authenticated host port for preview, atomic commit and cursor export. It has no tenant authority or database access. Import files contain literal CSV/XLSX values and tenant reference codes. Uploads are bounded to 2 MB, 500 rows, 80 columns and 16,000 characters per cell. XLSX archives are inspected for declared expanded size (8 MB), encryption, macros and external workbook links before decoding. Formula cells are rejected; CSV exports neutralize spreadsheet command prefixes.

## User flow

Download a template, enter records, upload, supply a reason, validate on the server, review row errors, then import. Changing the file or reason invalidates the preview. Failed commit responses retain their idempotency key for retry. The server must revalidate within the commit transaction; preview does not reserve codes or guarantee success. The default mode creates drafts and never overwrites existing records. Optional UPSERT mode updates existing codes only with the exported __version, preserving status; the server must reject stale versions. New codes still create drafts.

Exports follow authorized cursor pages with consistent columns and a 10,000 row bound. Export permission and data scope belong to the host. A host should unmount or key the panel when the table or authenticated scope changes. Do not pass patient/customer datasets into a catalogue administration adapter.

`PricingExpressionInput` offers base-price, percentage markup, percentage discount and cost-plus templates. It emits text to the host; the backend restricted expression engine validates and evaluates it. Expressions produce a unit price; quantity multiplication is separate. JavaScript and arbitrary SQL are not supported.

## Integration and preferences

Import the components from `@pepbits/erp-screens`. Controls use the shared ops-ui primitives and inherit host theme, radius, font and form-scale settings. Host owns navigation, permission presentation, reference choices and canonical API errors. The panel has no persistent presentation settings, custom keyboard shortcuts or competing draft store. Source files and imported values are kept only in mounted component state. Translated copies for this new component remain a follow-up; English is the delivered copy.

## Acceptance and boundaries

Focused tests use synthetic CSV/XLSX files and in-memory ports, covering formula rejection, string preservation, server validation, changed-preview invalidation and commit retry identity. They do not establish live tenant database acceptance or deployment. XLSX decoding uses the repository's existing pinned SheetJS dependency. Streaming files, multi-sheet workbooks and signed import packages are not supported by this increment.
