# Lifecycle source registry and source mappings — 18 September 2026

Status: unreleased. The work was developed and validated locally in an uncommitted working tree on base `e37a971`. Prepared for commit and push after verification. Registry publication and deployment remain separate;
healthcare archive packaging and browser acceptance are recorded in that consumer repository. Tag: not created. Testing-guide version:
[1.0.0](../../testing/README.md). Feature guide: [shared lifecycle configuration](../../features/lifecycle-configuration.md), flow 10.
Backend contract: source contract v1.2 (§3a TABLE rules) from the backend library worker (`pepbits-backend-library` lifecycle, working tree on `0fa54d0`).

## Changes and user impact

Added:

- `@pepbits/erp-config/lifecycle`:
  - Source contract v1 records: `LifecycleSourceMapping`, `LifecycleSourceRef`, `LifecycleFieldMapping`, the capture mode, operation and transform enums, and the optional `LifecycleReleaseDefinition.sourceMappings`.
  - Registry records `LifecycleSource`, `LifecycleSourceSummary`, `LifecycleSourcePage` and `LifecycleSourceCapabilities`.
  - Strict guards for these records (`parseLifecycleSource*`).
  - The optional `LifecycleSourceApi` port and `createLifecycleSourceHttpApi`: `GET /source-capabilities`, `GET /sources?cursor&limit` and `GET /sources/{source}`.
  - Pure helpers in `sources.ts`: allowed fields, transforms, operations and slots, pinning and re-pinning, payload-name suggestions, and local checks that use the contract's issue codes.
- `@pepbits/erp-screens/lifecycle`:
  - `LifecycleSourceRegistryPanel`, a bounded, cursor-paged list with a metadata-only detail view.
  - A **Source mappings** section in `LifecycleDefinitionEditor` (`LifecycleSourceMappingsSection` and `LifecycleSourceMappingEditor`).
  - `LifecycleSourcePayloadPreview` and `useLifecycleSourceCatalog`.
  - `LifecycleApplicabilityEditor`, extracted from the binding editor and shared by both editors.
  - The optional `sources` and `sourcePageSize` props on `LifecycleConfigurationPage`, and the optional `LifecyclePermissions.sources`.
- 155 messages in each of the four canonical catalogs (en, ar, hi, ml): the `lifecycle.source.*` keys, the section name and its help text. The generated fallbacks were regenerated.

Changed:

- Renames of stages, events, lifecycles and dimensions now also update source mappings. Removing any of them, or unmapping a stage event, is blocked while a mapping references it.
- The version diff and validation-issue navigation now include `sourceMappings`.
- The dirty check treats an absent `sourceMappings` and an empty list as equal. This matches the server checksum, which omits both.
- New validation: local checks flag the following immediately. The server remains authoritative.
  - Reserved payload names and names outside the payload-name grammar.
  - Denied fields (`tenant_id` and the host's `deniedFields`) and non-selectable fields.
  - With service capture, sensitive fields used with anything other than **Present**.
  - With table capture, anything other than a same-name **Copy** of a column in the active capture payload. Trigger-supplied denied columns are shown as supplied and are not mapped.
  - Invalid MAP value tables.
  - Undeclared stage events and table-event mismatches.
  - Watched fields on operations other than updates.
  - Stale source pins.

Hosts that do not pass `sources` see no change: there is no new tab or request, and the saved definition has no `sourceMappings` property.

## Installation and compatibility

Additive exports only; no existing export, prop or route changed meaning. `createLifecycleHttpApi` behaves as before; its
request pipeline is now shared with the source adapter. A definition stored with mappings opened by a host without a
source port shows the mappings read-only. Packaging and host adoption belong to the parent and host repositories.

## Data, errors and security

No schema, migration or dummy-API change. The browser never names a table, column or SQL statement: every source reference is built
from a registry entry and its current provenance, and only registry-listed, selectable, non-denied fields are offered.
Values that may not be disclosed can only be mapped as **Present**, and the payload preview shows types, never values.
A host that has not enabled the registry, a 403 or `FORBIDDEN` response, an empty registry and failed reads each have an explicit
state. Failed reads offer retry and keep editor values. Mapping edits are saved only through the existing draft save, with a change
reason, the expected revision and a stable operation key, and are then governed by independent approval, immutable publication and
activation. Tenant, application and user scope still come from the host session, and the server authorises every call.

The Arabic, Hindi and Malayalam texts are machine-drafted and not native-reviewed. Arabic RTL and long Hindi and Malayalam strings have not been checked in a browser.

## Verification and limits

Node v24.21.0. Commands were run from `desktop-clients` against base `e37a971` plus this working tree. Baseline before the change: the lifecycle
focused suite had 34 tests passed.

- `npx vitest run packages/erp-config/src/lifecycle packages/erp-screens/src/lifecycle`: 4 files and 62 tests passed. That is 34 existing tests, 17 new contract, adapter and model tests in `sources.test.ts` and 11 new page tests in `sources.test.tsx`.
- `npx vitest run packages/erp-config packages/erp-screens`: 67 files and 411 tests passed.
- `npm run typecheck`: all packages and `apps/desktop` passed.
- `npm run build -w web`: the Next.js 16.3.3 production build passed.
- Gates: `verify:form-controls`, `verify:shared-components`, `verify:library-preferences`, `verify:library`, `verify:templates`, `verify:contrast`, `verify:parity` and `verify:localization` passed. `localization:sync` regenerated the fallbacks.
- Cross-check against the backend worker's uncommitted examples, read-only. The four definitions in `pepbits-backend-library/lifecycle/examples` parse through the new guards and round-trip unchanged. Two contain `sourceMappings`; the local checks report no problems. The SHA-256 digests are:

  | File | SHA-256 |
  | --- | --- |
  | `erp-purchase-order-source.json` | `0f5a590e8dd2fd1d23beb7568a91e1a97cb75e5de4a768e59c80698e796701ac` |
  | `healthcare-patient-source.json` | `e48540c401f0dcfb7daf1df9230748248f33b952649ec5748d4772542bd37780` |
  | `erp-purchase-approval.json` | `30d416d55f5ce49052255b13b11a50faeb4e91b3e5781e391df8256e371cc7e1` |
  | `healthcare-registration.json` | `909e91758e8d489a626aff95f754acd6e17b2d75f9e5c99750371702447b8e38` |

  These are hand-written examples, not Java-serialised registry responses.
- Java wire check, read-only. All 17 JSON fixtures that the backend worker's `LifecycleSourceWireFixturesTest` wrote to `pepbits-lifecycle-core/target/lifecycle-wire-fixtures` (09:58 build) parse through the matching guards and round-trip unchanged. `error-independent-approval.json` is an error body and was not parsed. The local checks report no problems on the two mapped definitions. The SHA-256 digests of the source fixtures are:

  | File | SHA-256 |
  | --- | --- |
  | `source-capabilities.json` | `1526b9dae007dd5441d9cd344faffdd52cf4af6cc2f35c91823da4e21bd7a24b` |
  | `source-detail.json` | `becd7d710c13ae660891cdcadb5141341a61b6fdad6e92fc68591e5b4e1e3912` |
  | `source-page.json` | `4010ec4fc4fe933309ad2ee87f3d02389daef3ddae194b14f4f78c41020e4453` |
  | `definition-erp-purchase-order-source.json` | `7514cbd5c9a2650426d0ddfa11449fae53ab4da48f1c3daa9eaa3594c694e87f` |
  | `definition-healthcare-patient-source.json` | `d66682ece77e73d0a238b0bf4b44b356932dfe21bc9ef67128eb87aeca7b0d4d` |
- From the repository root: `node docs/tools/check-docs.mjs` passed on 111 documentation files. `node docs/tools/documentation-lifecycle.mjs check` passed after impact receipts were recorded with `no-content-impact`: no registered page renders the lifecycle module, and the catalog changes add keys only. `npm run verify:documentation` also passed. The inherited backlog of 1,116 authoring and review items remains pending.

Broader sequence on the final source:

- `npm test`: 137 files and 1,652 tests passed. An earlier run, before the v1.2 table-capture alignment, had one 5 s timeout in `erp-screens/src/templates/page-template.test.tsx` under full-suite load. That file passed alone and in the final run.
- `npm run test:api`: passed, 104 API plus 33 clinical API cases. The initial missing `bwip-js` startup failure was resolved by `npm ci --prefix dummy-api --ignore-scripts --no-audit --no-fund` using the existing lockfile; no dependency versions changed.
- `npm run test:e2e-registry`, `npm run test:deployment` and `npm run build` (the turbo build, including desktop) passed.
- All 21 `npm run verify` steps passed individually, including `verify:bundle` after the build and `verify:ai-limits` after installing the pinned dummy API dependencies.
- Source identity for the final run:
  - Base: `e37a971`.
  - SHA-256 of `git diff HEAD`: `17bd47a3cfdb46389407b6f65bcf1fe4ffca9eae83c014d61d61dc3679dbccf4`.
  - SHA-256 of the concatenated untracked files: `c1901d1ea104384c058801c365c5b7788016ec17345672a2f94574801caaf951`.
  - After the run, only the wording and numbers in this release record changed.

Tests use in-memory ports and fictional ERP purchase-order fixtures. The following were not run:

- Browser journeys within this library repository (healthcare consumer acceptance is recorded separately).
- Native execution.
- Live host routes.

The backend implementation was still in progress during this work, so later contract changes require re-verification.

## Upgrade, rollback and publication

Upgrade: pass `sources={createLifecycleSourceHttpApi({...})}` once the host exposes the contract routes. Rollback: omit the prop.
Existing mappings then remain visible read-only and are preserved on save. This record accompanies the source commit; no release tag or live deployment is implied.
