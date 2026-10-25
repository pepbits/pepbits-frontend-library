# Page Library: demo API and CSV storage

Applies to these three pages within **Library → Page Library** (other pages have their own adapters and stores):

- **Worklist Query** (`allyvora-patient-query`)
- **Master Record - Main** (`allyvora-patient-record`)
- **360 Data** (`allyvora-patient-360`)

These pages use `createClinicalTemplateAdapter` and the authenticated `/clinical-templates` API. The frontend contains no replacement patient dataset. The API now reads and writes CSV instead of using JSON for saved records and generating related rows in code. The example data remains fictional demo data.

## Files and data ownership

| File | Purpose |
| --- | --- |
| `mock-api/config/clinical-templates/seed.csv` | Initial fictional records and all nine kinds of related 360 entries |
| `mock-api/data/clinical-templates.csv` | Default writable data file; created automatically |
| `mock-api/config/clinical-templates/metadata.json` | Form schema, lookup choices and provider configuration returned by the API |
| `mock-api/config/clinical-templates/patients.json` | Retained test fixture; the running store no longer reads it |

`RECORD_DATA_DIR` overrides the writable directory; otherwise the API uses `NEXORA_DATA_DIR` or its default data directory. A new tenant/application receives a copy of the CSV seed once. Seed changes do not replace already saved data.

The CSV columns identify tenant, application, entity, owner and ID. Record identifiers/version have their own columns. Form strings use `value.*` columns and booleans use `boolean.*`. Related entries use `care.*` columns. Repeated form collections and activity arrays occupy quoted JSON cells; saved searches, export history and retry receipts use the `details` cell. This preserves nested data without splitting a save across multiple files.

CSV quoting supports commas, quotes, embedded newlines and non-Latin text. Values are preserved as data, including empty strings and false checkboxes. This storage CSV is not a formatted spreadsheet export.

## Create and read flow

1. Open Master Record - Main and choose New. The API supplies an empty form record.
2. Complete required details, choose Create patient and confirm the review.
3. The API checks permission, fields, duplicates and the expected record version.
4. It assigns identifiers, appends the record and activity, and stores the retry receipt in the same CSV snapshot.
5. The temporary file is flushed and atomically renamed before a success response is returned.
6. Worklist Query reads the persisted CSV and finds the new record.
7. 360 Data reads the same record and its related rows. A newly created record has **no invented care history**.
8. Supported encounter/appointment creation writes real demo API entries to the same CSV. Refreshing 360 reads those entries.

Every API operation reloads the committed CSV. The browser does not write files directly. Filters, sorting, pagination and export remain API-backed. Tenant/application isolation and user-scoped saved searches remain intact. Existing themes, component composition and preference policies are unchanged.

## Existing JSON data

When no CSV file exists, startup checks for the corresponding legacy `clinical-templates.json`. If present, all records, related care, searches, export history and retry receipts are converted to CSV before serving requests. The original JSON is left intact. Once the CSV exists, it is authoritative; the old JSON is not updated.

Invalid existing CSV fails rather than silently replacing saved records with seed data. Do not delete the CSV to resolve an error: restoring an old JSON file could discard later CSV-only writes. Back up the writable directory before deployment or deliberate file maintenance.

## Integration and limits

Keep the existing typed adapter and `/clinical-templates` action contract. Other applications can supply their own authorized adapter without changing the three page components. The API remains responsible for access control, validation, version checks and retry handling; display settings are not permission checks.

This CSV store is intended for a **single demo API process on one host**. It rewrites one atomic snapshot per successful mutation and is not a concurrent production database. Production insurer integrations, payment posting, prescribing and clinical decision support are not provided by changing the storage format. The metadata file is configuration, not generated patient history.

## Verification

The CSV and existing API-store suites cover create/read/restart, Unicode and multiline values, booleans, tenant/application isolation, duplicate identity rejection, stale versions, saved searches, related entries, retry receipts, legacy migration, external CSV reads and malformed CSV rejection.

An isolated browser run used the actual API without request interception: create in Master Record - Main, inspect the CSV write, search in Worklist Query, then open 360 Data. After a real API process restart, HTTP reads confirmed the same record and empty related history. No live demo data was changed during these checks.

## Catalog location — 10 September 2026

Examples, demo descriptions and user/integration guides are in **Page Library → List of pages**. Working pages open directly to their forms/workspaces. See the [catalog guide](page-library-catalog.md).
