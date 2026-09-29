# Healthcare Suite RCM delivery — 29 September 2026

Status: deployed synthetic release candidate at [frontend.test.pepbits.com](https://frontend.test.pepbits.com). Implementation source and dedicated simulator source are pushed to main; no npm publication or release tag is claimed. The earlier Healthcare Suite import remains described in [its original receipt](healthcare-suite-2026-09-29.md).

Source commit: `4fec17b5b482732d3e418879c8a3450108a6515f`, based on `159e1e052722e5e8bc97ba786d474325dd25b3fa`. Dedicated provider main: `54ebc3b`. Deployment release: `20260929122358894-3da821b0`; archive SHA-256: `48ac0f62d232916e6ebe2a43fb61910e0ee3998f68ac9dc774f2cf7ac8c1ed60`. Retained rollback release: `20260929080313644-1b17b579`. The [candidate manifest](manifest-healthcare-suite-rcm-2026-09-29.json) records source and deployment identities separately.

## Change scope

Added nine API-backed RCM destinations, typed shared workspace/forms, server-only synthetic RCM command engine, MockIns protocol adapter and real HTTP payment/refund/collection adapters. Added source persistence so imported invoice identifiers, retries and original stock movements remain valid after restart. Added per-invoice ownership serialization between original billing and RCM, separate financial capabilities, explicit provider reconciliation and commercial maker/checker.

See the [feature guide](../../features/healthcare-suite-rcm.md), [design](../../architecture/HEALTHCARE-SUITE-RCM-DESIGN.md) and [completion tracker](../../tasks/HEALTHCARE-SUITE-RCM-2026-09-29.md).

## Historical focused verification

These focused results are retained under `/tmp/pepbits-rcm-20260929` on the development host. They precede final configuration changes and were superseded by the final results below. Counts describe different scopes and are not summed.

| Check | Observed result | Artifact/scope |
| --- | --- | --- |
| Original source API and durable source regression | 19 passed | `source-regression.log`; restart, replay, failed persistence and writer lease |
| Authenticated RCM host ownership | 1 passed | `host-source-ownership.log`; product/branch/facility/role and source collection/import race |
| Frontend focused Suite tests | 52 passed | Reported by UI owner; final whole-suite verification pending |
| Money adapter | 11 passed | Actual Python simulator HTTP; final malformed-confirmation hardening pending |
| Dedicated mock repository | 329 passed | `mock-all.log`; full Python discovery, including 30 payer-chain and 8 AED cases |

At that stage, final engine/protocol tests, frontend/API regression, type checking, repository gates, both builds, authenticated browser business flows, original workflow regression and screenshot/PDF evidence remained pending. The final local and deployed results below close those synthetic delivery gates.

## Limits and external activation

The provider side is the dedicated development simulator, not a live payer/bank. DRG/day-case results are explicitly synthetic; licensed content and vendor acceptance are external. Native language review, facility clinical/finance validation, real provider acceptance, production database operations and native executable acceptance are not established by these tests. Tenant/branch/facility policy inheritance passed the retained scoped tests; production configuration acceptance remains a consuming-application responsibility.

## Review and correction follow-up

The focused final backend run passed 39/39, covering the store, all four actual insurance wire profiles, AED SOAP12, fourth-payer EOB, malformed payment confirmation, actual payment/collection recovery and authenticated ownership. Full API regression passed 274 JavaScript tests plus 33 clinical TypeScript tests. The original source HTTP replay check found an internal scope GET consuming the mutation's idempotency key; internal reads now carry only the facility header and GET requests do not claim command replay keys. The focused follow-up passed 5/5 before whole-API rerun.

The initial frontend run found an existing observer attachment race; the test now waits for attachment. A subsequent concurrent build/test run exceeded the five-second timeout while rendering all 102 existing templates. Frontend/API runners are now capped at four workers; the final 1,943-test frontend run passed. The initial browser run found the isolated local API origin missing from its private runner settings; no production CORS policy was relaxed. An original route sweep then found the new routes absent from canonical authenticated navigation. Nine explicit menu/page records and a host navigation assertion now cover that boundary; the final browser rerun passed.

## Final local acceptance

- Frontend: **1,943/1,943** tests, 165 files (`frontend-tests-final3.log`).
- API: **274/274** JavaScript and **33/33** clinical TypeScript tests (`api-tests-final3.log`).
- Dedicated provider repository: **329/329** Python tests; published main commit `54ebc3b`.
- Both production-format builds, every package typecheck and every repository verification gate passed.
- Authenticated RCM browser: **53/53** checks and **38** successful UI commands; **50** screenshots; all configured provider flows executed, no skips or browser page errors.

Sanitized retained artifacts are in [the evidence directory](evidence/healthcare-suite-rcm-2026-09-29/). Earlier failed runs remain described above; no initial failure is reclassified as passing. The final browser harness corrected its label selector, added the required five-payer policy publication, and accepts monotonic versions because durable provider preparation and settlement are separate commits. These are harness corrections, not bypasses of application validation.

Documentation checks pass for 500 page-guide registrations, including all nine authored RCM guides and draft translations. The existing authoring/native review backlog is explicitly 1,668 items; automated validation does not establish native review.

Original Healthcare Suite regression also passed **49** authenticated checks and **6** UI commands, including all 32 static destinations, five dynamic routes and registration→appointment→encounter→signed order→paid invoice. Source manifest: [implementation identity](manifest-healthcare-suite-rcm-2026-09-29.json), digest `502b1ec1d68194e89598ba8392b4b9c84214823e977f55e3f131bd70ef5bd5e2`. The implementation source is pushed to main and the isolated deployment is active. The 39 focused backend checks overlap full API regression and are not added to its counts.

## Deployed public acceptance

The deployed runtime source identity was verified before browser acceptance. All five isolated API, web, desktop-browser, provider and collection units were healthy. The provider simulators are loopback-only on ports 33413/33414, configured for a maximum of five payers and AED. A guarded backup retains matching prior source, configuration and data for rollback. Sanitized [deployment](evidence/healthcare-suite-rcm-2026-09-29/deployment.json) and [restart](evidence/healthcare-suite-rcm-2026-09-29/deployment-restart.json) receipts record these boundaries.

| Public authenticated suite | Result | UI commands / screenshots | Evidence |
| --- | --- | --- | --- |
| RCM | 53/53 checks; no provider skips | 38 / 50 | [Results](evidence/healthcare-suite-rcm-2026-09-29/browser-rcm-public.json) |
| Original Healthcare Suite | 49/49 checks | 6 UI commands | [Results](evidence/healthcare-suite-rcm-2026-09-29/browser-original-public.json) |
| School role header | 28/28 checks | Separate role regression | [Results](evidence/healthcare-suite-rcm-2026-09-29/browser-school-public.json) |

All three runs reported zero page errors; RCM and original Suite also reported zero console errors. Navigation abort requests remain recorded in the RCM and original logs (12 and 6 respectively); no ignore filter removed them. After an isolated API restart, six authenticated HQ/Dubai workspace, patient and invoice JSON hashes were unchanged. Sessions still reset on restart, and these checks used fresh authenticated sessions.

Public PDFs and actual browser screenshots are indexed under the stable [E2E evidence path](https://github.com/pepbits/pepbits-e2e-testing/tree/main/test-results/healthcare-suite/frontend-test/2026-09-29-rcm-public). This deployment establishes synthetic Healthcare Suite acceptance only. Licensed DRG content, live bank/payer acceptance, native executable testing and facility clinical/native-language review remain external; the documentation backlog remains 1,668 review issues.

The public evidence package is pushed on E2E main at `c6729ab9525f462d758fe361eb77c47253cc4a1f`. [RCM PDF](https://github.com/pepbits/pepbits-e2e-testing/blob/main/test-results/healthcare-suite/frontend-test/2026-09-29-rcm-public/rcm-evidence.pdf) contains 53 pages and 50 actual screenshots (SHA-256 `73062b4be87be50f8a3d4cb54e9777fb007e5695ea25f2ff8eb8979058c8d446`); [original workflow PDF](https://github.com/pepbits/pepbits-e2e-testing/blob/main/test-results/healthcare-suite/frontend-test/2026-09-29-rcm-public/original-workflows-evidence.pdf) contains 46 pages and 43 actual screenshots (SHA-256 `923d5ad3e022f29aea3bed393855de20c1f83acb20912030897db760ad480625`). PDF pages and screenshots are presentation evidence, not additional acceptance checks.
