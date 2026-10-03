# Repository synchronization — 3 October 2026

Status: candidate, locally verified. Date UTC: 2026-10-03. Base: `1eba17bd`; source tree before audit documentation: `12666dc0154799d981cc2513decde5ae2e3b09d9`. No tag or package version change. [Testing guide](../../testing/README.md).

## Changes and user impact

Preserves 1,529 pending source/evidence files from the original checkout in an isolated integration worktree, including the reference modules and their existing historical delivery records. The original source hashes were rechecked without drift before publication. [Evidence](evidence/repository-sync-2026-10-03/verification.json) includes original and integrated source manifests.

Clean-checkout fixes declare isolated Quality Express 4 dependencies, retain Pharmacy Express 5 dependencies, install the access/diagnostics runtimes and style tooling, and prepare API workers before tests. CI explicitly checks out the pinned synthetic payment simulators. The module test recognizes all 30 registered modules, the exported SourceTimeInput is included in the runnable component catalogue, and the language test waits for asynchronous language loading. The MedSlot test now respects the original same-facility-day check-in rule without changing runtime behavior.

MedSlot help paragraphs and tour instructions now have Arabic, Hindi and Malayalam draft translations. Their revision records explicitly retain pending native review. The documentation history reader accepts the existing 67 MB immutable release snapshot. Previously recorded evidence remains historical.

## Installation and compatibility

Use Node 24 and the install commands in the GitHub workflow; each server runtime has its pinned lockfile. For local API tests set `HC_RCM_MOCK_REPO` to an independent checkout of `pepbits/pepbits-mocking-app` at `5ced4f8b021aa317859e6999d7c96ef14af63ee1`, with Python 3 available. GitHub Actions needs a repository-scoped `MOCK_SERVICES_READ_TOKEN` if its normal token cannot read that private repository. No broad workstation credential was copied or published.

## Data, errors and security

No production data, migration or deployment. API and browser fixtures use owned temporary databases and loopback services. Existing tenant, branch, user and provider boundaries remain under the original API tests. Required source packages remain independent of production clinical acceptance.

## Verification and limits

Fresh type checks, 2,579 unit tests (four skipped), 336 API tests, 33 clinical API tests, four registry tests, fourteen deployment lifecycle tests, both builds and property checks passed. Six documentation contract tests passed. Component Library and MedSlot browser journeys passed against isolated synthetic development servers. [Retained logs and hashes](evidence/repository-sync-2026-10-03/verification.json).

Initial runs exposed missing clean-checkout dependencies, stale module expectations, a language-loading race, absent authored help translations and a seeded future-appointment check-in assumption. These were corrected and the affected gates rerun. Two shell stylesheets received trailing-blank-line normalization after the runtime checks, with updated no-content-impact receipts. Final documentation checks cover this record.

The staged diff retains whitespace in 65 imported/generated source files and historical logs; raw `git diff --check` reports it. These preserved upstream/evidence bytes were not mass-reformatted. No passing whitespace gate is claimed. All 2,268 outstanding authoring/native/domain review items remain explicit. This is not all-browser, native application, live integration or production acceptance.

## Upgrade, rollback and publication

Source commit and push are recorded by the repository audit after publication. No artifact, tag or deployment was created. Existing deployment records retain their own source identities; this synchronization does not change running sites. Consumers must review and pin a package separately before adopting this source. Reverting the source commit is separate from runtime rollback.
