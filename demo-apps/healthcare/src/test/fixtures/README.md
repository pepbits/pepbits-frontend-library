# Synthetic healthcare HTTP fixtures

`http.json` retains phase 6b-1 synthetic API read snapshots. `diagnostics.json` captures diagnostic read responses from isolated local HTTP runs; authentication responses are excluded and credential fields are redacted. Values are fictional. Dates in schedule request matching are normalized so the test does not depend on the capture day.

`diagnostic-instance.dcm` is one synthetic CT Part 10 instance captured from the unchanged demo HTTP API. Unit tests reuse it for a study's image requests, with jsdom canvas/layout limitations. They do not assert image fidelity, measurement accuracy or clinical interpretation. Chromium loads each actual HTTP image in its separate browser checks. The empty viewer study 999 is an explicit unit-only fixture; it is never served by the running app.

Use `HEALTHCARE_CAPTURE` and `HEALTHCARE_DICOM_FIXTURE` on the local integration script to refresh these files; never capture real patient data or credentials. Source identity and exact check scope belong to the phase 6b-2 release evidence.
