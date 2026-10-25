# Phase 8 local evidence

Scope: the uncommitted `restructure/phase-8` working tree based on
`3558a131f0fd443693eae0dfc678e3b258b480c1`. These are local checks, with fictional API
fixtures, production browser builds and a local archive. No remote receiver, native executable,
registry publication or product integration was tested. See the [release record](../../restructure-phase-8-2026-10-25.md)
for results, source identities, failed attempts and owner rollout.

`remaining-references.tsv` identifies every retained old-tree reference outside release
records by path, line, justification and line SHA-256. It includes nonignored untracked
files and older reference-import evidence. `reference-audit.json` summarizes that audit.
The justifications are:

- Immutable source links: removed files at the base Git commit, not live local paths.
- Dated scope/retirement provenance: descriptions of earlier app imports, checks or removals.
- Retirement history/plan: original migration stages and their current completion status.
- Historical consumer inventory: the original phase 7c symbol/archive mapping CSVs.
- Legacy receiver rollback contract: the prior artifact's API directory must remain selectable.
- Removed-source receipts: lifecycle entries preserve removal/disposition and earlier source identity.
- Historical import provenance/evidence: frozen original imports, audit output and their hashes.
- Copied backend provenance: original paths/hashes for the API-owned contracts.

The audit intentionally preserves historical names. There are no executable references.
Evidence is kept small; temporary detailed logs remain under `/tmp/phase8` on this machine.

`source-manifests.json.gz` retains exact file hashes/deletions for the final working tree and
the root CI package/demo inputs. Its digest uses compact JSON file entries in sorted path
order. `checks.json`, `root-ci.json` and `api-baseline.json` preserve distinct test scopes;
overlapping runs are not summed.

`live-demos.json` records each browser scope and process cleanup; `erp-first-attempt.json`
retains the failed pre-fix attempt. `run-smoke.json` and `archive-receipt.json` are local
launcher/artifact checks. `static-audit.json` covers deletion, protected inputs, source-link
provenance and secret-pattern scans. No remote activation receipt is claimed.
