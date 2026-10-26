# ERP parity subsets after phase 8 — 26 October 2026

Status: merged and verified on the combined source; merged to `main` on 26 October 2026. Base: `7cdc9e895ffa6c53d114b3e8e37ea01fcc1a7f5a`, branch `restructure/erp-parity-merge`. No tag, publication or deployment. Package versions remain unchanged. Testing guide: [1.0.0](../../testing/v1.0.0/PRE-COMMIT.md).

## Changes and compatibility

The candidate combines `restructure/phase-6c-7a2` (`174860e`, including `983c807`) then `restructure/phase-6c-7b` (`2c17992`) while preserving phase 8 root services, backend independence and retired original workspace. It retains 18 simple/dependent master editors, 12 tree/rate compositions and 14 transaction documents. The [feature contract](../../features/erp-demo.md), [app guide](../../../demo-apps/erp/README.md) and [destination ledger](../../../demo-apps/erp/parity-status.md) retain remaining differences at all 114 destinations. No whole-destination parity is claimed.

Prepared conflict resolutions combine both editor dispatch paths and all three subset visual drivers; keep main's busy/row/header stabilization; union subset docs and public worklist/tabular contracts. Master and transaction ledger changes are disjoint. Historical release manifests and evidence retain their original hashes.

The three source audits use immutable Git blobs at `3558a131f0fd443693eae0dfc678e3b258b480c1`, never the deleted filesystem tree. Each requires a fresh receipt file. The original-runtime visual generator remains retired. Smoke uses `mock-api`. Root installs/builds remain authoritative; no dependency or API schema migration is introduced.

## Data, errors and preferences

The subsets retain effective preferences, tenant locks, mounted permissions, version-aware saves, operation identity on retry and explicit conflict reload. Existing record URLs and personal layouts remain compatible. Mounted input retention and unload warnings do not provide durable cross-route drafts. Fictional financial workflows do not establish accounting, native, deployed, human accessibility or language acceptance.

## Verification and limits

Codex prepared the conflict resolutions and source-audit ports but its sandbox could not write this worktree's Git metadata, so the reviewer performed the two history-preserving merges with those resolutions: `3c5e39e` (6c-7a2, including 6c-7a) and `8cf8004` (6c-7b). Combined-source verification by the reviewer, Node 24.21.0, local only:

| Check | Result |
| --- | --- |
| Root `npm ci`, `tooling/scripts/install-api.sh` | PASS |
| `tooling/scripts/ci-gates.sh` forced CI (`npm run ci`) | PASS: 69/69 tasks, 0 cached; tooling 23/23; docs tools 6/6 |
| Documentation impact receipts | First run FAILED: merged ERP sources lacked receipts. Receipts refreshed with `documentation-lifecycle.mjs snapshot` (no guide content change); lifecycle check and docs check (228 files) then PASS |
| Remaining gate steps (API build/typecheck/tests, clinical, deployment) | Not re-run on this branch: the merges change no file under `mock-api/` or `tooling/`; the same code passed these steps on `main` `7cdc9e8` |
| Shell browser (`npm run test:browser -w @pepbits/shell`) | PASS |
| Production live ERP (`run-demo-integration.mjs erp`) | PASS: 198 workflows, 114 routes, 29 panel states, 71 visual checks; 0 errors, console errors, HTTP errors and axe violations |
| Production live reports | PASS |

Whole-destination parity remains incomplete at all 114 destinations (see the ledger). This is not a deployment, hosted Jenkins or native result.

## Upgrade and rollback

Rollback is a revert of the two merge commits on `main`. Deployment is separate. No API migration or irreversible data change is proposed.
