# Clinical Triage demo form

`form.json` supplies the triage field metadata and explicit priority/destination choices through the authenticated demo API. Labels are canonical localization keys. No priority, allergy status or vital reading is preselected. The current measurement set is fixed by the typed `TRIAGE_VITALS` contract; adding fields requires changing the contract, renderer, validation and tests together.

Assessments are persisted in `RECORD_DATA_DIR/clinical-triage.csv`, separately from patient and billing data. See [Clinical Triage](../../../docs/features/clinical-triage.md) for storage, integration, permissions and clinical boundaries.
