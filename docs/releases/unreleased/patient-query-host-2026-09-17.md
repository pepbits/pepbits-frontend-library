# Patient Query production-host adapter — 17 September 2026

The new `@pepbits/erp-screens/patient-query` public entry exports the existing ClinicalPatientWorkspace.
Healthcare uses `initialPage={{view:'query'}}` with its own adapter, effective preferences and record navigation.
This is the same renderer used by the AllyVora Patient Query library example; no competing layout was copied.

Optional metadata `queryCapabilities` flags disable unsupported presets, export, care actions, overview and
sorting. All flags default to the prior behavior for existing adapters. A summary can set `editable:false`.
`PatientSearchResult.hasMore` enables sequential cursor pagination without requiring an exact total;
`total` in this mode is the end offset of the returned page, not an exact registry size. An optional search hint
lets a host accurately describe its matching semantics. Preview enum labels fall back to supplied labels.

Healthcare supplies a real adapter; this repository's reference page retains its demo adapter. Disabled controls
remain visible in the shared layout. Filters/results are not persisted as patient data in browser storage.

Local checks: all package types pass; 8 Patient Query tests pass, including capabilities and cursor navigation.
Generated library/template examples remain in sync. No demo deployment or native desktop run is claimed.
The healthcare repository records host/API/browser evidence and the private package hashes separately.
