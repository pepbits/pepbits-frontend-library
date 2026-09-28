# Existing healthcare comparison (2026-09-28)

Baseline canonical a9703f1: frontend4324/API4323. Candidate frozen frontend4322/API4320. Actual Chromium,1440×1000,light appearance,fresh admin/admin authentication per page. Only temporary helpers/captures/results changed.

Six of six matched actual loaded states passed. All rendered text and measured root/heading/button/input/table/card geometry and font/style properties identical. Five screenshot pairs byte-identical. Query differs by63pixels (0.0090067%) confined to first-name field border bounds x219–405/y185–220; visually identical form/results, no layout/text difference.

| Page ID | Actual state | Text/styles/geometry | Screenshot |
| --- | --- | --- | --- |
| allyvora-patient-query | patient-query-form | identical | 63pixels (0.0090067%) |
| allyvora-patient-record | patient-query-form | identical | byte-identical |
| allyvora-patient-360 | patient-query-form | identical | byte-identical |
| op-registration | registration-entry | identical | byte-identical |
| clinical-triage | selected-patient-triage | identical | byte-identical |
| billing-clinic | patient-required | identical | byte-identical |

Zero page JavaScript errors,console errors,API HTTP errors or network request failures in final capture set. Observed authentication API origins match expected4323baseline/4320candidate. Triage selected real API patient Alex Morgan; initial candidate helper evaluated options before asynchronous lookup completed, and explicit networkidle retry succeeded.

Record/360 route IDs currently render the query form in both baseline and pre-fix candidate because existing ClinicalLibraryPage indexed a three-view array with a larger page catalog index. This run proves unchanged actual fallback presentation, and does not claim record/360 editor coverage. Root assigned lead an explicit ID dispatch correction; distinct candidate query/new-record/360 follow-up completed after its build restart.

Billing direct route without recordID deliberately renders patient-required state; no billing editor coverage claimed. Registration captures actual loaded patient-selection registration form/worklist.

No browser route interception/mocked responses,application edits,preference writes,save or clinical action submissions. Legacy API transports some read operations via POST (metadata/search/load), plus real authentication; these are not datastore writes.

Evidence: comparison-final.json,baseline-results.json,candidate-final-results.json and six baseline-/candidate- PNG pairs. Initial failures/probes retained separately for traceability.

## Corrected route follow-up

Three of three real corrected-view checks passed against fresh-auth candidate4322/API4320. Query rendered real Alex Morgan search results; New patient opened actual new-record editor through explicit reverse mapping. Direct record rendered real blank new-patient record with API metadata/fields. Direct360 selected real API Alex Morgan and rendered patient overview; Open record navigated to real existing Alex Morgan record. Zero JS/console/API errors. No fixture creation,preference writes,save or clinical actions needed.

Evidence: candidate-fixed-results.json,candidate-fixed-allyvora-patient-query.png,candidate-fixed-allyvora-patient-record.png,candidate-fixed-allyvora-patient-360.png,candidate-fixed-query-to-new-record.png,candidate-fixed-360-to-record.png. Baseline routing bug prevented old record/360 form capture; no invented before/after editor claim. Root/lead own corrected explicit ID mapping and eight component checks.

The corrected360 DOM root is1938px tall inside the host scrolling viewport; its locator capture proves the visible top patient/encounter area and includes clipped/blank space beyond that viewport. Full lower-section screenshot coverage is not claimed. Actual DOM text/markers and Open record navigation were verified against real API data.
