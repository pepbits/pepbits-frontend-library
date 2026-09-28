# Reference frontend module import

## Scope and source baseline

Reports, ERP1, ERP2 and School are integrated as distinct reusable modules in the shared frontend. The implementation uses the existing host shell, shared components, effective preference and tenant-lock contracts, localization, host navigation and authenticated API adapters. The [source inventory](SOURCE-INVENTORY.json) pins the original routes and files. It covers 341 source files across the four source modules; those original source trees remain unchanged.

ERP1 and ERP2 each define 57 catalogue pages through 20 template families. Their dynamic route files do not represent the full catalogue count. Reports and School include their route pages, domain components and demo API behavior. Source login/layout pages use the host's authentication and shell rather than introducing a second application sidebar or login flow.

Six public packages expose the four modules plus the shared host contract and ERP core: `@pepbits/reference-reports`, `@pepbits/reference-erp1`, `@pepbits/reference-erp2`, `@pepbits/reference-school`, `@pepbits/reference-host` and `@pepbits/reference-keystone-core`.

## Completed implementation

1. Added typed module, page, navigation and API contracts with unique identities for each imported destination.
2. Imported all 152 static destinations and their reusable source content. ERP1 keeps its in-page record editor; ERP2 uses routed record destinations where the source does.
3. Replaced client dependencies on source servers and local fixtures with injectable API adapters. The local demo APIs use fictional data and keep simulated operations server-side.
4. Connected host authentication context, branch scope, preferences, tenant locks, localization, errors and navigation. Request metadata does not grant authorization; each backend checks the authenticated operation and scope.
5. Registered the public packages, module navigation and 152 authored English page guides. Preserved the source inventory and its original references.
6. Ran local route, action, visual-compatibility, API, type, build and documentation checks. The [delivery record](../releases/unreleased/reference-modules-2026-09-28.md) and [evidence index](../releases/unreleased/evidence/reference-modules-2026-09-28/README.md) record their exact scope and limits.

## Verification still pending

Implementation and local validation are complete; package publication and live deployment are outside this task. The Page Library's 14-ID browser regression passed, with its final log and locale screenshots linked from the [evidence index](../releases/unreleased/evidence/reference-modules-2026-09-28/README.md). Authored-guide paragraph and metadata translations passed their language-quality checks, and [complete package verification passed](evidence/rule-verifier.log). Native-speaker review of the new guide translations and the wider strict documentation backlog remain pending. Production service integration, real email delivery and native executable acceptance require separate verification by the consuming application.

The original source folders remain read-only. Any future adaptation should be recorded in the inventory and reviewed against the affected source behavior before updating the guides.
