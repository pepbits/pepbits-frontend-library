# Teleconsult Provider and Patient import — 1 October 2026

Status: implemented, deployed and verified on the isolated test site as `20261001-teleconsult-01`.

The shared frontend library now imports Clinic Desk and CareCall as exactly two header modules: Teleconsult Provider (server-granted Doctor/Nurse modes) and Teleconsult Patient. The existing sidebar hosts their nine static destinations; three record routes open actual consultation, visit and summary identifiers. Original source layouts remain scoped and existing Healthcare/diagnostic modules retain their own contracts.

## Changed behavior

Shared controls, authenticated Reference Host transport and effective formatting/language preferences replace duplicate prototype infrastructure. CareCall opts into a reusable host fill-layout contract, including intermediate wrappers, so the phone and bottom navigation fit below header/notices/desktop tabs and above the footer. Source Tailwind 3 inputs are retained byte-exact; the library's Tailwind 4 configuration is unchanged.

A single persistent API serves both modules with trusted tenant/application/branch isolation, bounded payloads, deterministic role and patient grants, state checks, idempotency and version conflicts. Recording consent cannot be disabled; Nurse signing and cross-patient reads are denied. Scheduling, booking, registration and simulation settings resolve from tenant defaults and branch overrides. Specialty/urgency advice and other business simulations run on the API; changed answers discard stale advice.

Twelve authored guides and draft Arabic/Hindi/Malayalam translations are registered in the new immutable help snapshot `2026-10-01-teleconsult-reference-import`. Source review corrected actual doctor-signing prerequisites, waiting for an unsigned summary, backend-advice retry and shared printing. Earlier help releases and evidence are retained.

## Local verification

The [local validation receipt](evidence/teleconsult-reference-2026-10-01/validation-local.json) records 2,114 frontend tests in 178 files; 320 general API tests and 33 clinical API tests; all-package typechecking; and both production browser builds. The 149 Teleconsult frontend and 41 Teleconsult API tests are subsets, not additional totals. One obsolete module-count expectation in the first complete frontend run was corrected, and the complete rerun passed.

[Teleconsult browser acceptance](evidence/teleconsult-reference-2026-10-01/local-teleconsult-reference-results.json) covers module selection, all nine sidebar destinations, three record routes, role/patient restrictions and the shared signed summary. An earlier synthetic Doctor browser signature created the local fixture used by later summary and print checks. [Four-language layout/print acceptance](evidence/teleconsult-reference-2026-10-01/local-language-layout-print-results.json) passed 21 results, including phone/bottom-nav fit at 1,000/800/600 pixel heights and a browser-generated synthetic PDF through the shared print surface. The first fill-layout attempt exposed zero-height intermediate wrappers; the shared opt-in layout fixes that failure. Earlier failed runs remain private evidence and are not counted as passes.

[Diagnostic regression](evidence/teleconsult-reference-2026-10-01/local-diagnostic-reference-results.json), [Healthcare Suite regression](evidence/teleconsult-reference-2026-10-01/local-healthcare-suite-results.json) and [School regression](evidence/teleconsult-reference-2026-10-01/local-school-role-header-results.json) passed their existing browser suites. Teleconsult/diagnostics/Healthcare reported no page or console errors; School checks page errors but does not collect console errors. Aborted navigation requests are retained separately.

## Deployment boundary

The target is only `https://frontend.test.pepbits.com`. The retained baseline and rollback release is `20261001-sidebar-04`; the active release is `20261001-teleconsult-01`. Matching old source/configuration/package and a guarded synthetic-data backup were retained before activation. Provider simulators and Healthcare Enterprise/ERP/School deployments are outside this change. No Git push, published npm version or native executable acceptance is claimed.

## Remaining boundaries

Seeded patients/staff are fictional. Remote video, device frames, transcript, scribe, clinical scores and decision support are simulated; local camera previews are not transmitted. No real prescription, order, bill or stock transaction is posted. This is not a production telehealth integration or clinical approval. Live identity, media/signalling, secure attachments, governed knowledge sources, external adapters and jurisdiction-specific acceptance remain separate. Native-language/domain approval and source accent contrast review remain pending. Patient summary printing uses the shared surface; Provider printing retains its source browser-print behavior.

See the [feature guide](../../features/teleconsult-reference/README.md) and [reference provenance](../../reference-import/TELECONSULT-SOURCE.json).


## Accepted public deployment

The [activation receipt](evidence/teleconsult-reference-2026-10-01/activation2-result.json) records successful activation and preservation of three existing clinical/financial JSON files on startup. [Staging](evidence/teleconsult-reference-2026-10-01/stage-result.json), [remote API preflight](evidence/teleconsult-reference-2026-10-01/runtime-preflight.json) and [archive hashes](evidence/teleconsult-reference-2026-10-01/archives.json) identify the accepted package. No dependency download or database migration was needed.

Public HTTPS acceptance passed [Teleconsult 19 checks](evidence/teleconsult-reference-2026-10-01/public-teleconsult-reference-results.json), [diagnostics 80](evidence/teleconsult-reference-2026-10-01/public-diagnostic-reference-results.json), [Healthcare Suite 49](evidence/teleconsult-reference-2026-10-01/public-healthcare-suite-results.json) and [School 28](evidence/teleconsult-reference-2026-10-01/public-school-role-header-results.json). The public Teleconsult run performed the Doctor browser signature, own-patient summary read and dedicated-role denials. [Thirty-six localized guide reads](evidence/teleconsult-reference-2026-10-01/public-guides.json) passed with native review explicitly pending. Console/page collection boundaries and retained aborts remain visible in those results.

The frozen [421-file source snapshot](teleconsult-reference-source-2026-10-01.json) has SHA256 `c48ecd9ebf5dc1dbc1a066e09e565fa82ab1846153e7eb4af7c6c8ae848ccf78` over base `1eba17bdd3584fcfbef722da317ceb353286b5a8`. All listed files were checked unchanged before these final documentation/evidence updates. The [final validation receipt](evidence/teleconsult-reference-2026-10-01/validation.json) distinguishes runtime source, working-tree documentation, local checks, public acceptance and remaining external/human review. Packaging-time help notices retain their original status; this acceptance record supersedes their public-deployment-pending note. No Git push or package publication is claimed. Refresh existing tabs and sign in again after the API restart.
