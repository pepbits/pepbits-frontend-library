# Healthcare Suite RCM delivery — 29 September 2026

Status: local implementation and RCM acceptance passed; Git publication and deployment are pending. The previously deployed Healthcare Suite import remains described in [its original receipt](healthcare-suite-2026-09-29.md).

Base source: `159e1e052722e5e8bc97ba786d474325dd25b3fa` plus the current working changes. Final source digest and publication identity will be recorded after implementation freezes.

## Change scope

Added nine API-backed RCM destinations, typed shared workspace/forms, server-only synthetic RCM command engine, MockIns protocol adapter and real HTTP payment/refund/collection adapters. Added source persistence so imported invoice identifiers, retries and original stock movements remain valid after restart. Added per-invoice ownership serialization between original billing and RCM, separate financial capabilities, explicit provider reconciliation and commercial maker/checker.

See the [feature guide](../../features/healthcare-suite-rcm.md), [design](../../architecture/HEALTHCARE-SUITE-RCM-DESIGN.md) and [completion tracker](../../tasks/HEALTHCARE-SUITE-RCM-2026-09-29.md).

## Verification receipts so far

These focused results are retained under `/tmp/pepbits-rcm-20260929` on the development host. They precede final configuration changes; final checks remain required. Counts describe different scopes and are not summed.

| Check | Observed result | Artifact/scope |
| --- | --- | --- |
| Original source API and durable source regression | 19 passed | `source-regression.log`; restart, replay, failed persistence and writer lease |
| Authenticated RCM host ownership | 1 passed | `host-source-ownership.log`; product/branch/facility/role and source collection/import race |
| Frontend focused Suite tests | 52 passed | Reported by UI owner; final whole-suite verification pending |
| Money adapter | 11 passed | Actual Python simulator HTTP; final malformed-confirmation hardening pending |
| Dedicated mock repository | 329 passed | `mock-all.log`; full Python discovery, including 30 payer-chain and 8 AED cases |

Remaining local gates: final engine/protocol tests, frontend/API regression, type checking, repository gates, both builds, authenticated browser business flows, original workflow regression and screenshot/PDF evidence. Publication/deployment remain pending.

## Limits and external activation

The provider side is the dedicated development simulator, not a live payer/bank. DRG/day-case results are explicitly synthetic; licensed content and vendor acceptance are external. Native language review, facility clinical/finance validation, real provider acceptance, production database operations and native executable acceptance are not established by these tests. Configuration inheritance must pass tenant/branch/facility tests before its gate closes.

## Review and correction follow-up

The focused final backend run passed 39/39, covering the store, all four actual insurance wire profiles, AED SOAP12, fourth-payer EOB, malformed payment confirmation, actual payment/collection recovery and authenticated ownership. Full API regression passed 274 JavaScript tests plus 33 clinical TypeScript tests. The original source HTTP replay check found an internal scope GET consuming the mutation's idempotency key; internal reads now carry only the facility header and GET requests do not claim command replay keys. The focused follow-up passed 5/5 before whole-API rerun.

The initial frontend run found an existing observer attachment race; the test now waits for attachment. A subsequent concurrent build/test run exceeded the five-second timeout while rendering all 102 existing templates. Frontend/API runners are now capped at four workers; final frontend verification is pending. The initial browser run found the isolated local API origin missing from its private runner settings; no production CORS policy was relaxed. An original route sweep then found the new routes absent from canonical authenticated navigation. Nine explicit menu/page records and a host navigation assertion now cover that boundary; the final browser rerun remains required.

## Final local acceptance

- Frontend: **1,943/1,943** tests, 165 files (`frontend-tests-final3.log`).
- API: **274/274** JavaScript and **33/33** clinical TypeScript tests (`api-tests-final3.log`).
- Dedicated provider repository: **329/329** Python tests; published main commit `54ebc3b`.
- Both production-format builds, every package typecheck and every repository verification gate passed.
- Authenticated RCM browser: **53/53** checks and **38** successful UI commands; **50** screenshots; all configured provider flows executed, no skips or browser page errors.

Sanitized retained artifacts are in [the evidence directory](evidence/healthcare-suite-rcm-2026-09-29/). Earlier failed runs remain described above; no initial failure is reclassified as passing. The final browser harness corrected its label selector, added the required five-payer policy publication, and accepts monotonic versions because durable provider preparation and settlement are separate commits. These are harness corrections, not bypasses of application validation.

Documentation checks pass for 500 page-guide registrations, including all nine authored RCM guides and draft translations. The existing authoring/native review backlog is explicitly 1,668 items; automated validation does not establish native review.

Original Healthcare Suite regression also passed **49** authenticated checks and **6** UI commands, including all 32 static destinations, five dynamic routes and registration→appointment→encounter→signed order→paid invoice. Source manifest: [implementation identity](manifest-healthcare-suite-rcm-2026-09-29.json), digest `502b1ec1d68194e89598ba8392b4b9c84214823e977f55e3f131bd70ef5bd5e2`. Final local source is frozen; publication and isolated deployment follow.
