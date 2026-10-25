# Consumer migration map — phase 7c-0

Analysis dated **25 October 2026**. The twelve published **0.1.0** packages cover most imported symbols, but **no whole product repository can switch by changing package names alone**. The main work is explicit shell/preference/localization composition, product ownership of navigation and clinical code, and migration of Platform Enterprise's separate UI packages.

This is an inventory and recommendation, not a consumer migration or deployment. Product repositories were read-only: no installs, builds, tests, packing, worktrees or edits. Only this map, its four CSVs and the plan's status note are changed. The [restructure plan](PACKAGE-RESTRUCTURE-PLAN.md) defines ownership; [phase 7b evidence](../releases/unreleased/restructure-phase-7b-2026-10-25.md) records publication.

## Source identity and counting

Library worktree: `restructure/phase-7c-map`, `919826687e13a05a65b0675e821d306f4ffb71c6`. All twelve `packages/*/package.json` export maps and `src/index.ts` barrels were read, including recursively referenced public subpath barrels and implementation signatures. There is no `packages/` diff between the publication source `60b1428` and this HEAD. Coverage below means a reachable **public export**, not a similarly named file or a private demo implementation.

Product roots are `/home/pepadmin/pb/repos/saas/<repository>`. Tracked files were enumerated using `git -C <repo> ls-files`; source/configuration and packaging references were inspected with `git grep` and reads restricted to that tracked list. Excluded directory components: `node_modules`, `.next`, `.build`, `.local`, `.test-artifacts`, `target`, `vendor`. Archives were not opened. The old-library signature baseline is `desktop-clients/packages/*` at the library HEAD above; consumers pin older, sometimes patched archives, so this is not proof of byte-level compatibility with every archive.

| Repository | Observed HEAD | Symbol inventory |
| --- | --- | --- |
| pepbits-healthcare-enterprise | `0cdbf6ba676940a8103b2794d64c598e1681f8d6` | [CSV](consumer-migration/pepbits-healthcare-enterprise.csv) |
| pepbits-erp-enterprise | `ad57cbac088f9970354cd005bf478bf451604146` | [CSV](consumer-migration/pepbits-erp-enterprise.csv) |
| pepbits-school-enterprise | `334788e6bfc28f2b5b5deaddee2ff13075155ef4` | [CSV](consumer-migration/pepbits-school-enterprise.csv) |
| pepbits-platform-enterprise | `ef8e74c096bc062e9a4d92a9d6790ec771b5e729` | [CSV](consumer-migration/pepbits-platform-enterprise.csv) |

Healthcare had an unrelated tracked modification to `PROJECT-TRACKER.md`; the other three had no tracked modifications at inventory time. Imported source and configurations were clean. Other sessions can advance these repositories; refresh this inventory against their new HEADs before implementation.

The CSV key is **app + old specifier + imported symbol + kind**. Aliases use the original exported name. Static imports/re-exports, type imports and dynamic imports such as `.then(m => m.PreferencesPage)` are included; CSS `@import` uses the explicit `(stylesheet)` marker. `files_count` counts distinct tracked files per row, not occurrences. `source_locations` retains the import locations. No namespace imports or unbound JavaScript side-effect imports were found. Kinds reflect TypeScript import syntax; CSS is separate. Tests under the app are included. Counts sum rows across apps, so a symbol used in five apps contributes five rows; file counts must not be summed across symbols.

`package.json` dependencies/peers, Next transpilation lists and Tailwind `@source` paths are documented separately below: they are configuration references, not invented symbol imports. In particular, dependency-only AI/workspace packages are **not** counted as missing symbol imports. The Platform auth library has zero imports from these packages, so it has no CSV rows. Scanning the wider tracked repositories found no additional application imports; Healthcare's filesystem-based lifecycle tooling dependency is listed under phase 8.

Status meanings:

- **direct**: the same named public API accepts the existing import/use shape; the containing application must still migrate its provider composition and styling. This does not assert unchanged pixels, behavior or runtime acceptance.
- **renamed**: only the export name changes. There are **zero** such rows: apparent renames here also change calls, ownership or mounting and are classified as `api-changed`.
- **api-changed**: a public replacement exists, with the required adaptation in `notes` and its replacement name in `new_symbol`.
- **missing**: no replacement in these twelve published packages. `gap_group`, `notes` and `export_evidence` identify product/private/Platform ownership. An empty new package/path is deliberate, not an unresearched target.

## Counts and CSVs

| Repository | Direct | Renamed | API changed | Missing | Total | Importing files |
| --- | --- | --- | --- | --- | --- | --- |
| Healthcare | 141 | 0 | 31 | 29 | 201 | 106 |
| ERP | 55 | 0 | 17 | 21 | 93 | 27 |
| School | 67 | 0 | 23 | 22 | 112 | 34 |
| Platform | 28 | 0 | 4 | 1 | 33 | 19 |
| **Overall** | 291 | 0 | 75 | 73 | 439 | 186 |

| Repository | App/library | Direct | Renamed | API changed | Missing | Total |
| --- | --- | --- | --- | --- | --- | --- |
| Healthcare | `frontend/external-web` | 22 | 0 | 0 | 0 | 22 |
| Healthcare | `frontend/platform-admin-web` | 14 | 0 | 5 | 11 | 30 |
| Healthcare | `frontend/provider-web` | 28 | 0 | 8 | 3 | 39 |
| Healthcare | `frontend/registration-web` | 1 | 0 | 0 | 5 | 6 |
| Healthcare | `frontend/tenant-admin-web` | 34 | 0 | 8 | 1 | 43 |
| Healthcare | `frontend/tenant-desktop` | 0 | 0 | 0 | 3 | 3 |
| Healthcare | `frontend/tenant-web` | 42 | 0 | 10 | 6 | 58 |
| ERP | `frontend/erp-admin-web` | 27 | 0 | 6 | 1 | 34 |
| ERP | `frontend/erp-web` | 14 | 0 | 6 | 0 | 20 |
| ERP | `frontend/platform-admin-web` | 13 | 0 | 5 | 14 | 32 |
| ERP | `frontend/registration-web` | 1 | 0 | 0 | 6 | 7 |
| School | `frontend/education-admin-web` | 28 | 0 | 6 | 1 | 35 |
| School | `frontend/education-web` | 13 | 0 | 6 | 0 | 19 |
| School | `frontend/platform-admin-web` | 13 | 0 | 5 | 11 | 29 |
| School | `frontend/registration-web` | 0 | 0 | 0 | 10 | 10 |
| School | `frontend/teacher-web` | 13 | 0 | 6 | 0 | 19 |
| Platform | `libraries/platform-auth-web` | 0 | 0 | 0 | 0 | 0 |
| Platform | `libraries/platform-web` | 1 | 0 | 0 | 0 | 1 |
| Platform | `services/platform-service/frontend/platform-admin-web` | 27 | 0 | 4 | 1 | 32 |

There are **439 rows in 186 distinct importing files**: 343 value imports, 81 type imports and 15 CSS imports. The 291 direct rows include those 15 CSS imports. Each CSV records `app, old_specifier, symbol, kind, files_count, new_package, new_export_path, new_symbol, status, gap_group, notes, source_locations, export_evidence`.

## What is covered, adapted or absent

The following table summarizes only observed consumption, not an assertion that each entire old package has been ported. The CSVs are the complete symbol-by-app inventory.

| Old public surface used | Published destination | Finding |
| --- | --- | --- |
| `ops-ui`: primitives (`Button`, `Input`, `Badge`, `Toggle`, `QuantityUnitField`, etc.) | `@pepbits/ui` root | Direct. |
| `ops-ui`: cards, table, overlays, states, values, presentation | `@pepbits/components` root | Direct. `CardGrid` here maps to the component, not the unrelated worklist export of the same name. Table rows gain keyboard activation and scroll containers default focusability. |
| `ops-ui`: `LocalizationProvider`, `useLocalization` | `@pepbits/i18n/react` | Same controlled interface. Supply canonical host catalogs; fallback is core/literal, not the old generated global UI catalog. |
| `tokens/tokens.css` | `@pepbits/tokens/tokens.css` | Direct, same subpath; manifest now targets `dist/tokens.css`. |
| `auth`: `HostSessionProvider`, `SessionValue`, `useSession` | `@pepbits/platform/auth` | Direct controlled session contract. Preserve product cookie/BFF authentication; do not substitute the token-based login implementation. |
| `platform-ports`: `NavigationPort`, `NavigationProvider`, `useNavigation` | `@pepbits/platform/navigation` | Direct. |
| `erp-config`: preferences/defaults/policy/theme exports | `@pepbits/preferences` | Direct imported types/functions; theme ID `nexora` stays, display label becomes `Blue`. |
| `erp-config`: `LANGUAGE_OPTIONS`, `TranslationCatalog` | `@pepbits/i18n` | Direct. `translate` and `loadFallbackLanguage` instead require factories and host catalogs. |
| `erp-config`: `MenuItem`, `ModuleKey`, `ProductDefinition`, `TemplateDocument` | `@pepbits/shell/navigation`, `@pepbits/shell/products`, `@pepbits/page-engines/types` | Direct input shapes. `ModuleKey` is now string; `MenuItem.icon` accepts generic icon components. The actual `MODULES` and `TEMPLATE_BY_ID` registries are absent. |
| `erp-config`: DCP types, guards and writable patch | `@pepbits/data/dcp-runtime` | Direct; also re-exported by `@pepbits/patterns/dcp-fields`, but use the lower-layer contract path. |
| `erp-config/lifecycle`: both HTTP factories | `@pepbits/patterns/lifecycle` | Direct factories with explicit host request transport. |
| `erp-screens/lifecycle`: `LifecycleConfigurationPage` | `@pepbits/patterns/lifecycle` | API changed: preferences/policy move to providers. |
| `erp-screens` root: master-transfer UI/port/data/preview and `PricingExpressionInput` | `@pepbits/patterns/master-transfer` | Direct; used by Healthcare tenant administration as well as School. No blanket `erp-screens` shim should pull in product screens. |
| `erp-screens/dcp-fields` | `@pepbits/patterns/dcp-fields` | `DcpFieldRenderer` type direct; runtime/section fields additionally require host preference formatting. |
| `erp-screens/record-page` | `@pepbits/page-engines/record-page` | `RecordIdentity`, `RecordNotice`, `RecordPageAction` direct; `RecordPage` removes the preferences prop in favor of PreferenceHost. |
| `erp-screens/templates`, root or `/preferences` | `@pepbits/page-engines/templates`, `@pepbits/shell/preferences-page` | Provider/service adaptations for `PageTemplateWorkspace` and `PreferencesPage`. |
| `erp-screens/patient-query`, `erp-data` clinical adapter, `erp-config` patient types | Healthcare-owned packages | Missing from publication by ownership design. |
| `erp-shell` | `@pepbits/shell`, `@pepbits/shell/layers` | Chrome props largely retained; providers, context consumers, Header and layer mounting require adaptation. |
| `workspace-core` | `@pepbits/shell/workspace` | Dependency-only in these products; all 45 old barrel export names are reachable here, but no product import rows to migrate directly. |
| `ai-config`, `ai-client`, `ai-ui` | `@pepbits/ai/config`, `/client`, `/ui` | Dependency-only; ported with explicit host inputs, not drop-in re-exports. See AI inventory below. |
| `platform-web/{bff,ui,product-profile}`, `platform-auth-web/desktop` | Retain their Platform Enterprise packages | Outside this library's published set. |

Export evidence: [UI](../../packages/ui/src/index.ts), [components](../../packages/components/src/index.ts), [i18n manifest](../../packages/i18n/package.json), [preferences](../../packages/preferences/src/index.ts), [data runtime](../../packages/data/src/dcp-runtime.ts), [platform manifest](../../packages/platform/package.json), [patterns manifest](../../packages/patterns/package.json), [engines manifest](../../packages/page-engines/package.json), [shell manifest](../../packages/shell/package.json), [AI manifest](../../packages/ai/package.json), [tokens manifest](../../packages/tokens/package.json). Every nonmissing CSV row also names its defining file and the owning manifest.

### Required host changes

`ERPProvider`, `ProductProvider`, `ShellHostProvider` and `ShellHost` are not public names in the new shell. Their responsibilities split across controlled `HostSessionProvider`, `PreferenceHost`, `LocalizationProvider`, `ShellProvider` and the host's service/loading/error state. `ShellProvider` requires navigation, product, brand, branch choices and roles; it gets the effective role from the session. Header branch selection comes from this provider; old `Header branches/showInbox` props become provider choices plus an optional inbox node. Footer labels become explicit Footer props supplied through `EnterpriseShell.footer`. Preserve tenant locks and backend authority while adapting.

`useERP` still exists but no longer returns the old preference service fields. Reads of `preferencePolicy` and `preferencesAvailable` move to `usePreferences`; reset, refresh and save-error handling belong to host services. All rows for this hook conservatively carry `api-changed`, including apps that currently read only retained fields. `translate(language, key, values, overrides)` becomes `createTranslator({language, catalogs, overrides})(key, values)`; `loadFallbackLanguage` becomes a host-configured `createCatalogStore(...).loadCatalog` call. Neither recreates missing product catalogs automatically.

`GlobalLayers` is replaced by `ShellLayers`, **already mounted by EnterpriseShell**. Every scanned old host mounting both EnterpriseShell and GlobalLayers must remove the extra layer mount. A simple export alias would duplicate overlays. AI help is supplied explicitly through the AI shell extension. Standalone DCP and lifecycle pages need the same effective preference and ScreenHost services as shell-mounted pages; detached documents must retain their own document scope.

The public [ApplicationProviders](../../packages/shell/src/application-providers.tsx) is an optional composition, not a universal substitute: it expects the library preference-service endpoint/revision contract and its own localization/branch/role requests. Existing products have their own BFF contracts. Check or adapt those contracts first; otherwise compose the lower-level providers directly. Do not import private demo host helpers into a product.

### Missing groups

| Repository | Product registries/fixtures | Healthcare domain | Platform-owned | AI/unported other | Missing total |
| --- | --- | --- | --- | --- | --- |
| Healthcare | 5 | 6 | 18 | 0 | 29 |
| ERP | 2 | 0 | 19 | 0 | 21 |
| School | 2 | 0 | 20 | 0 | 22 |
| Platform | 1 | 0 | 0 | 0 | 1 |
| Overall | 10 | 6 | 57 | 0 | 73 |

**Product registries and fixtures (10 rows).** All four repos import `MODULES`, currently defined in [old navigation](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/packages/erp-config/src/navigation.ts); no new public package exports it. Each product must own the subset it uses. Healthcare provider-web additionally imports `TEMPLATE_BY_ID` from [old page templates](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/packages/erp-config/src/page-templates.ts) and `createTemplateSample` from [old template state](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/packages/erp-screens/src/templates/template-state.ts). Neither is exported by the new packages, including the real `@pepbits/page-engines/template-state` subpath. Keep required preview fixtures in product code or replace the preview with real adapter data. Demo apps are not installable substitutes.

**Healthcare domain (6 rows).** Tenant-web imports `ClinicalPatientWorkspace`, `ClinicalTemplateAdapter`, `PatientFilters`, `PatientMetadata`, `PatientRecord` and `PatientSummary`. Old definitions are in `erp-screens/src/clinical-templates/workspace.tsx`, `erp-data/src/clinical-templates.ts` and `erp-config/src/clinical-templates.ts`. Private copies exist in [healthcare demo workspace](../../demo-apps/healthcare/src/modules/clinical-templates/workspace.tsx), [adapter](../../demo-apps/healthcare/src/adapters/clinical-templates.ts) and [domain](../../demo-apps/healthcare/src/domain/clinical-templates.ts). Adopt the screen into product `frontend/packages/healthcare-ui`, domain types into `healthcare-domain`, and real backend adapters into `healthcare-api`; review the screen's transitive imports and archive-era behavior. These should be product-owned packages shared between Healthcare apps, not published whole `erp-screens`/`erp-config` copies. Generic contracts remain in this library.

**Platform ownership (57 rows).** `platform-web/bff` supplies `Configuration`, `lookupWorkspace`, `proxy`, `resolveFrontendHost`; `/ui` supplies the imported dashboard/login/registration/reset UI, `adminPages`, session hook/types, `api`, `Field`, `Notice`; `/product-profile` supplies `ProductProfile`, `emptyRegistrationForm`, `productProfile`. `platform-auth-web/desktop` supplies `DesktopApplication`, `DesktopAuthPort`, `DesktopSession`. Their export maps and source are in Platform Enterprise `libraries/platform-web/package.json` and `libraries/platform-auth-web/package.json`. None is exported by any of the twelve library packages. Keep their package names and Platform ownership, with an independently reviewed distribution. `platform-web` itself imports only `Button` from `ops-ui` and declares the `ops-ui` peer: migrate both to `ui` before downstream removal. `platform-auth-web` currently has no old-library dependency/import; its archive/distribution migration is a separate concern. Both Platform manifests are private; do not assume their current versions are registry-published.

**AI client/UI and other gaps.** No app directly imports an AI symbol, so this group contributes zero missing CSV rows. All seven old `ai-ui` exports remain under `/ui` (`TransparencyPanel`, `AssistantPanel`, `AiTerminal`, `InlineAiAction`, `Assistant`, `useAssistant`, `AiAdministration`); they now use explicit AI/session/shell providers. The old client top-level names `fetchAiConfig`, `saveAiConfig`, `setAiCredential`, `clearAiCredential`, `verifyAiCredential`, `fetchAiUsage`, `setAiScopedCredential` are methods returned by `createAiAdmin`; `fetchAiPolicy`/`resetAiPolicy` come from `createAiPolicyClient`; `dispatchAi` comes from `createAiTransport`. `createAiClientWithRequest` combines these with a host request and classifier. They are API adaptations, not unimplemented AI features. The concrete `USE_CASES`/`USE_CASE_IDS` catalog is absent by design; `getUseCase` is on a `createAiCatalogue(hostUseCases)` instance. Host page metadata/classification/catalog content must be carried forward if an old host's implicit AI is retained. See [config](../../packages/ai/src/config/index.ts), [client](../../packages/ai/src/client/index.ts), [UI](../../packages/ai/src/ui/index.ts) and [host contract](../../packages/ai/src/ui/provider.tsx). No other missing imported-symbol group was found. No product imports `@pepbits/reference-*`.

## Dependency and build-configuration inventory

All names below are under `@pepbits/`. **C12** means exactly `ai-client, ai-config, ai-ui, auth, erp-config, erp-data, erp-screens, erp-shell, ops-ui, platform-ports, tokens, workspace-core`. **P7** means `auth, erp-config, erp-shell, ops-ui, platform-ports, tokens, workspace-core`. `hc074.2`, `hc096.1`, `hc.fa36d76.1` abbreviate `0.0.0-<suffix>`; these are old archive versions, not registry versions. Every manifest in the requested locations was checked, including declared-but-unimported packages.

| Repository | App/library | Declared package set and archive version |
| --- | --- | --- |
| Healthcare | `frontend/external-web` | `ops-ui`, `tokens` @ `hc096.1` |
| Healthcare | `frontend/platform-admin-web` | C12 @ `hc.fa36d76.1`; `platform-web` @ `0.1.0-dev.mfa0a95e3c72c33` |
| Healthcare | `frontend/provider-web` | C12 @ `hc074.2` |
| Healthcare | `frontend/registration-web` | C12 @ `hc.fa36d76.1`; `platform-web` @ `0.1.0-dev.mfa0a95e3c72c33` |
| Healthcare | `frontend/tenant-admin-web` | C12 @ `hc074.2` |
| Healthcare | `frontend/tenant-desktop` | `platform-auth-web` @ `0.1.0-dev.hfe4666856e06` |
| Healthcare | `frontend/tenant-web` | C12 @ `hc096.1`; `platform-auth-web` @ `0.1.0-dev.hfe4666856e06` |
| ERP | `frontend/erp-admin-web` | C12 @ `hc096.1` |
| ERP | `frontend/erp-web` | C12 @ `hc096.1`; `platform-auth-web` @ `0.1.0-dev.hfe4666856e06` |
| ERP | `frontend/platform-admin-web` | C12 @ `hc.fa36d76.1`; `platform-web` @ `0.1.0-dev.mfa9b2869314350` |
| ERP | `frontend/registration-web` | C12 @ `hc.fa36d76.1`; `platform-web` @ `0.1.0-dev.mfa9b2869314350` |
| School | `frontend/education-admin-web` | C12 @ `hc074.2` |
| School | `frontend/education-web` | C12 @ `hc096.1`; `platform-auth-web` @ `0.1.0-dev.hfe4666856e06` |
| School | `frontend/platform-admin-web` | C12 @ `hc.fa36d76.1`; `platform-web` @ `0.1.0-dev.mfac8c1f483c81c` |
| School | `frontend/registration-web` | C12 @ `hc.fa36d76.1`; `platform-web` @ `0.1.0-dev.mfac8c1f483c81c` |
| School | `frontend/teacher-web` | C12 @ `hc096.1`; `platform-auth-web` @ `0.1.0-dev.hfe4666856e06` |
| Platform | `libraries/platform-auth-web` | No @pepbits dependencies/peers |
| Platform | `libraries/platform-web` | `ops-ui` @ `*` (peer) |
| Platform | `services/platform-service/frontend/platform-admin-web` | `auth`, `erp-config`, `platform-ports`, `tokens`, `workspace-core` @ `hc.fa36d76.1`; `erp-shell`, `ops-ui` @ `central-navigation.1` |

The manifest locations are `<app>/package.json`. Healthcare's provider archives live in `frontend/provider-web/vendor`, tenant archives in `frontend/tenant-web/vendor`; platform/registration hosts reference provider archives and their own Platform UI archives, tenant-admin references provider archives, external-web references tenant archives, and tenant-desktop has its own auth archive. ERP/School hosts use `file:../vendor/...`. Platform admin uses `file:../vendor/...` under `services/platform-service/frontend`. Preserve these provenance distinctions during migration; the broad lockfiles do not mean every app has the same snapshot.

| Repository | App/library | Next transpilePackages | Tailwind source packages | CSS imports |
| --- | --- | --- | --- | --- |
| Healthcare | `frontend/external-web` | `ops-ui` | `ops-ui` | `tokens/tokens.css` |
| Healthcare | `frontend/platform-admin-web` | C12, `platform-web` | `auth`, `erp-screens`, `erp-shell`, `ops-ui`, `platform-web` | `tokens/tokens.css` |
| Healthcare | `frontend/provider-web` | C12 | `auth`, `erp-screens`, `erp-shell`, `ops-ui` | `tokens/tokens.css` |
| Healthcare | `frontend/registration-web` | C12, `platform-web` | `ops-ui`, `platform-web` | `tokens/tokens.css` |
| Healthcare | `frontend/tenant-admin-web` | C12 minus tokens | `auth`, `erp-screens`, `erp-shell`, `ops-ui` | `tokens/tokens.css` |
| Healthcare | `frontend/tenant-desktop` | — | `platform-auth-web` | — |
| Healthcare | `frontend/tenant-web` | C12 minus tokens | `auth`, `erp-screens`, `erp-shell`, `ops-ui` | `tokens/tokens.css` |
| ERP | `frontend/erp-admin-web` | C12 | `auth`, `erp-screens`, `erp-shell`, `ops-ui` | `tokens/tokens.css` |
| ERP | `frontend/erp-web` | C12, `platform-auth-web` | `auth`, `erp-screens`, `erp-shell`, `ops-ui` | `tokens/tokens.css` |
| ERP | `frontend/platform-admin-web` | C12, `platform-web` | `auth`, `erp-screens`, `erp-shell`, `ops-ui`, `platform-web` | `tokens/tokens.css` |
| ERP | `frontend/registration-web` | C12, `platform-web` | `ops-ui`, `platform-web` | `tokens/tokens.css` |
| School | `frontend/education-admin-web` | C12 minus tokens | `auth`, `erp-screens`, `erp-shell`, `ops-ui` | `tokens/tokens.css` |
| School | `frontend/education-web` | C12 minus tokens | `auth`, `erp-screens`, `erp-shell`, `ops-ui` | `tokens/tokens.css` |
| School | `frontend/platform-admin-web` | C12, `platform-web` | `auth`, `erp-screens`, `erp-shell`, `ops-ui`, `platform-web` | `tokens/tokens.css` |
| School | `frontend/registration-web` | C12, `platform-web` | — | — |
| School | `frontend/teacher-web` | C12 minus tokens | `auth`, `erp-screens`, `erp-shell`, `ops-ui` | `tokens/tokens.css` |
| Platform | `libraries/platform-auth-web` | — | — | — |
| Platform | `libraries/platform-web` | — | — | — |
| Platform | `services/platform-service/frontend/platform-admin-web` | — | `auth`, `erp-shell`, `ops-ui` | `tokens/tokens.css` |

Configuration table notation: names are relative to the `@pepbits/` scope; CSS entries mean `node_modules/@pepbits/<name>/src`, with the actual relative prefix recorded by the source stylesheet. `next.config.ts` is under each listed Next app. Stylesheets are `src/app/globals.css` unless noted; Healthcare registration uses `src/app/(platform)/globals.css`, Healthcare desktop uses `src/style.css`, and Platform admin uses `src/styles.css`. School registration has no tracked shared CSS import/source directive. There are no additional old-package Tailwind config or Vite-config specifiers in the scanned source.

After migration, remove old-library `transpilePackages` entries and source aliases only when those dependencies are gone; published packages use compiled ESM exports. Change Tailwind scanning to the used packages' **`dist`** directories (`ui`, `components`, `patterns`, `page-engines`, `shell`, and `ai` when used). Verify paths relative to the stylesheet: do not copy an old relative prefix blindly. Keep the token CSS subpath. Independently owned Platform packages may still need their existing transpilation/source scanning until their own packaging changes. Never enable the internal `pepbits-source` condition for installed 0.1.0 packages, whose tarballs omit source. See [publishing installation contract](../development/PUBLISHING.md#build-and-installation-contract).

## Recommended migration sequence and effort

**Platform → Healthcare → ERP → School**, with shared preparation first. Platform removes the upstream `ops-ui` peer and establishes how its two packages are distributed. Healthcare supplies the host baseline consumed downstream. In particular School's `scripts/sync_healthcare_frontend.py --check` is enforced by `Jenkinsfile:44` and `scripts/verify.sh`: editing the copied shell independently would fail that gate. ERP's `frontend.lock.json` also records Healthcare as archive provenance, though no equivalent source-copy gate was found. This dependency order takes precedence over simply picking the smallest remaining row count.

Estimates are **engineering person-days**, inferred from the 186 importing files, host composition, archive provenance and verification surface, not a measured implementation schedule. They include implementation, focused build/type/behavior verification in subsequently authorized product work, and lock/CI updates. They exclude elapsed review time, deployment windows, native/device acceptance and phase 8 removal. Shared preparation is counted once.

| Work | Approach | Size / estimate |
| --- | --- | --- |
| Shared preparation | Establish package read access, host adapter design/catalog ownership, and independent Platform package distribution. Verify any proposed generic shim surface against these CSVs. | 3–5 days |
| Platform Enterprise | Direct import rewrite for the 28 direct rows, especially `platform-web` Button/peer; explicit admin shell provider adaptation and local navigation catalog. No broad compatibility package needed for 19 files. Compare the central-navigation archive patch with new sidebar/form-control behavior. | Small/medium, 3–5 days |
| Healthcare Enterprise | First migrate external-web (22 direct rows), then platform/registration wrappers and provider/tenant-admin host composition; extract clinical screen/types/adapters before tenant-web switches. Keep tenant-desktop on Platform-owned auth while migrating its distribution separately. Use temporary compatibility facades for generic old imports while staged apps move, with explicit wrappers for provider/API changes and product-local clinical exports. | Large, 12–18 days |
| ERP Enterprise | Rewrite direct imports across 27 files after adopting the reviewed host adapter; replace MODULES locally. A small temporary host wrapper can ease the tenant/admin cutover; a twelve-package shim suite is unnecessary. Preserve independent platform/registration and tenant archive histories in evidence. | Medium, 4–6 days |
| School Enterprise | Regenerate/adopt the migrated Healthcare host baseline through the tracked sync workflow, then apply direct rewrites and lifecycle/preferences adaptations; preserve master transfer/pricing and teacher/education behavior. Update archive verification gates as dependencies become registry packages. | Medium, 5–8 days |
| **Total phase 7c implementation** | Shared preparation plus the four repositories; each remains a separate product change. | **27–42 person-days** |

A compatibility shim is a **new, deprecated facade**, not an existing guarantee in phase 7b. Generic examples are `ops-ui` → explicit exports from `ui`, `components`, `i18n/react`; `auth` → `platform/auth`; `platform-ports` → public platform ports; `workspace-core` → `shell/workspace`; selected `erp-config` and `erp-screens` subpaths → their mapped contracts/components. Re-export only the reviewed consumed surface. `ERPProvider`, catalogs, preference services, AI globals and layer mounting need adapters, so `export *` alone is insufficient. Do not put Healthcare data, navigation registries or real API endpoints into a shared library shim. A temporary product `erp-screens` facade may delegate the clinical export to Healthcare's new package while old call sites migrate.

Pin new packages together and ensure only **one copy of each context/provider implementation** is installed. Mixing the original `ops-ui` localization or `auth` session contexts with new shell contexts cannot be repaired by changing import spelling alone. A shim must re-export the new context, and wrappers must use its matching provider. Give each shim a consumer-removal checklist derived from these rows; phase 8 deletes it after the last consumer changes.

## Prerequisites outside product repositories

1. **Registry access and CI secrets.** Use the existing library [publication contract](../development/PUBLISHING.md#manual-publication-by-the-owner): `@pepbits:registry=https://npm.pkg.github.com` plus `//npm.pkg.github.com/:_authToken=${NPM_TOKEN}` in consuming npm configuration; inject a secret with `read:packages` and access to the private packages, including organization authorization where required. Scope mapping alone does not grant access. Product build containers/CI jobs need this secret; no credential is committed or recorded here. Confirm all twelve 0.1.0 artifacts are accessible to each CI identity and pin reviewed versions/lockfile integrity. This analysis did not authenticate against the registry.
2. **Library surface.** No mandatory generic UI addition was identified for the consumed symbols: all reusable gaps have public replacement APIs. If the owners choose centrally distributed old-name shims, those packages and explicit host adapters still have to be implemented, tested, versioned and published; they are not among the twelve 0.1.0 packages. Do not change already published 0.1.0 bytes. New generic defects discovered during integration require a subsequent release.
3. **Product ownership agreement.** The missing registries, preview fixture and clinical screen/domain/adapter contracts must acquire product ownership before removing their old archives. Keep generic preferences, lifecycle, DCP, record layout and template contracts in the library. Do not simply republish all of `erp-config`/`erp-screens` as shared product dependencies. Healthcare-owned packages can share the required clinical code among its apps.
4. **Platform-owned package handoff.** Version/distribute migrated `platform-web` with its new UI peer and preserve `/bff`, `/ui`, `/product-profile`; decide the independent distribution of `platform-auth-web` and preserve `/tenant`, `/desktop`. Downstream use of those packages need not disappear merely because this library migrates. They are dependencies outside Healthcare/ERP/School, but changes belong to Platform Enterprise, not this library.
5. **Canonical catalogs and host services.** Supply product fallback catalogs generated from canonical backend catalogs, real preference/policy persistence and session-aware request ports. Confirm preference revision/lock, lifecycle, AI and clinical contracts; published generic components deliberately do not infer them. The new shell must preserve current action grants, branch scope, catalog loading and failure handling. The aggregate `ApplicationProviders` cannot be assumed compatible with every BFF.

## Phase 8 deletion dependencies

**25 October phase 8 update:** the table below is the pre-deletion audit, retained for provenance. Its source links now target the immutable base snapshot. Current replacements and gate coverage are in [test-site operations](../development/TEST-SITE.md), with [phase 8 status](PACKAGE-RESTRUCTURE-PLAN.md#phase-8-status). Backend contracts, root tooling and demo outputs replace the executable dependencies. No old-name facades were implemented. Owner-reported product migrations remove archive regeneration requirements; School’s parallel migration must be accepted before merge.

Migrating the four products is necessary but insufficient. These current build/runtime/deployment paths still depend on `desktop-clients/`. Paths below are tracked evidence at the library HEAD; reading them is not verification that a named remote service is currently running. No deployment was attempted.

| Entry point / dependency | Current use | Required replacement before deletion |
| --- | --- | --- |
| [run.sh](../../run.sh), service functions around lines 34–105 and release requirement at 422 | `web`/`desktop` use the old npm workspace, old build output and `scripts/serve-release.mjs`; `nexora`/`vantage` build/start old `desktop-clients/source/*` Next apps. API uses `dummy-api`. | Choose and configure the replacement demo hosts/ports/release commands from `demo-apps/*`; retire or relocate the two source-app services explicitly. Update installation, artifact and start/stop checks together. Use `mock-api` directly. |
| [run_all.sh](../../run_all.sh) | Delegates every operation to run.sh; no independent build implementation. | Retain as wrapper only after the run.sh service table is migrated, or retire both deliberately. |
| [Jenkinsfile](../../Jenkinsfile), Install/Gates/Package test site stages | Executes from `frontend/desktop-clients`; installs its lockfile and old runtime/tool dependencies; runs old type/test/build/verify/deployment gates; `main` invokes `deploy:prepare` and old packaging script. | Root workspace/library/demo gates and the required mock API installations; a replacement prepared-release format and packager. Keep documentation and deployment lifecycle validation. |
| Jenkins Deploy test site, [deploy/pb-srv5/known_hosts](../../deploy/pb-srv5/known_hosts) | Streams `frontend-test-*.tar.gz` to the forced-command receiver and checks `__nexora-release.json`. `deploy/` contains only the tracked host-key file, not an alternative builder. | Coordinate payload/start-path/health/rollback changes with the external `pepbits-shared-document` `common/deployment/config/stacks/pb-srv5` receiver/service configuration named by Jenkins. Retain host verification. Receiver implementation/live state was not audited here. |
| [desktop-clients/package.json](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/package.json): build/dev/ci/deploy scripts; `apps/web/package.json`, `apps/desktop/package.json`, native `src-tauri/tauri.conf.json` | Both shell builds, API stamping, verification, prepare/deploy and native hooks resolve relative to the old workspace. | Selected demo package scripts and root tooling; move required verification, stamping and Tauri hooks. Validate native artifacts separately from the browser desktop demo. |
| [scripts/deploy.mjs](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/scripts/deploy.mjs), [serve-release.mjs](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/scripts/serve-release.mjs), [deployment/release.mjs](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/scripts/deployment/release.mjs), `deployment/process.mjs`, `deployment/desktop-server.mjs`, `verify-deployable.mjs`, `stamp-api.mjs` (all under desktop-clients) | Snapshot/build/smoke-test old shells; package Next standalone `apps/web` and desktop `dist`; activate/current/rollback; call root run.sh; validate BUILD_API and old release paths. | Port this deployment lifecycle to `tooling` with the new demo artifacts and service contract; retain rollback/immutable-release checks and their tests. Merely moving the files leaves hardcoded paths wrong. |
| [scripts/ci/package-test-site.sh](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/scripts/ci/package-test-site.sh) | Copies prepared shells plus `dummy-api`, **all old packages, package.json and node_modules** into `src/desktop-clients` because the API imports them; bundles pinned external simulators. | Package a self-contained mock API with owned contracts/data and its own dependencies plus new demo output. Resolve the `dummy-api` symlink packaging assumption and preserve simulator pins/build provenance. |
| [.github/workflows/ci.yml](../../.github/workflows/ci.yml): `check` | Old workspace working directory/cache lock; docs, API, old suite-registry, deployment, build and property gates; old artifact upload paths. | Root package/demo checks with intentional coverage of each old gate; root lock/cache/artifact paths. |
| Same workflow: `browser` | Builds `web`/`desktop`, starts old API/Next/static servers, runs old `e2e`. | New demo hosts and root e2e selection with equivalent acceptance scope and diagnostics. |
| Same workflow: `feature-browser` | Matrix prepares old fixtures/API workers, builds both shells and runs `desktop-clients/e2e/run.mjs`. | Move needed fixture/worker setup and suite registry to root tooling/e2e, point tests at replacement hosts. |
| Same workflow: `native-linux` | Runs Tauri build from `desktop-clients/apps/desktop`; invokes old native driver/e2e suite. | `demo-apps/desktop/src-tauri` build/install/driver tests, with explicit Linux native evidence. Existing web-mode demo evidence is insufficient. This is the only tracked workflow file. |
| Mock API runtime and build dependencies (inventory below) | Imports old config/domain/AI/data and uses old TypeScript installation. Deleting frontend source breaks the API and therefore demos/test-site packaging. | Make mock API contracts/registries/fixtures backend-owned and use its own tooling or permitted independent contracts. Preserve the plan's “mock-api imports nothing from the frontend” rule; do not substitute imports of private demo modules. |
| [docs/tools/check-docs.mjs](../tools/check-docs.mjs), [documentation-lifecycle.mjs](../tools/documentation-lifecycle.mjs) | Import old library/page/documentation registries, enumerate old sources and expect old docs/test inventory paths. | New authoritative registry and source inventory; preserve historical release evidence with durable archive/source links before tree deletion. Even the requested docs validation currently depends on the old tree. |
| ERP/School visual audit helpers | `demo-apps/erp/scripts/source-visual-audit.mjs` reads old reference/template source; `demo-apps/school/scripts/build-visual-harness.mjs` builds it and resolves old dependencies; `visual-parity.mjs` inventories it. | Preserve immutable reference snapshots/baselines or complete and retire these tools explicitly; update their imports/tool dependencies. |
| Healthcare lifecycle wire tooling | Product `scripts/lifecycle/check-wire.mjs:10–11` dynamically loads old lifecycle guards and `lifecycleErrorFrom` by filesystem path. | Use the published `@pepbits/patterns/lifecycle` exports or an approved backend contract fixture; remove the sibling source path assumption. |
| Product archive generators, re-packers and lock gates (below) | Old source snapshots and adopted `.tgz` files remain part of reproducible product builds. | Registry packages/new product-owned packages and revised provenance checks; no active build may require recreating an old archive after deletion. |
| Remaining compatibility shims | Proposed phase 7c facades, not implemented by this analysis. | Zero consumers in source, manifests, lockfiles, peers, transpilation/scanning, CI and packaging; remove wrappers only after direct/new product APIs are accepted. Preserve old release provenance. |

### Mock API dependencies that also block deletion

The full tracked executable/type-reference scan outside `desktop-clients` found these API files. Grouping is by required replacement, not by whether they are exercised by every deployment:

| Current files under `mock-api/` | Old dependency to replace |
| --- | --- |
| `access-runtime/build.mjs`, `tsconfig.clinical.json` | TypeScript/types resolved from the old workspace. |
| `server.mjs`, `ai-security.mjs` | Config navigation/schema/form/import/classification/DCP/school registries; old AI gates/policy/use cases; report/mock data. Own equivalent backend catalogs/data/contracts. |
| `application-config.mjs`, `application-config.test.mjs`, `check-application-config.mjs`, `school-view-policy.mjs`, `school-role-views-http.test.mjs` | Old navigation and school-role configuration. |
| `clinic-billing-store.ts`, `clinic-billing-store.test.ts`, `clinical-consultation-store.ts`, `clinical-consultation-store.test.ts`, `clinical-document-store.ts`, `clinical-template-csv.ts`, `clinical-template-csv.test.ts`, `clinical-template-search.ts`, `clinical-template-store.ts`, `clinical-template-store.test.ts`, `clinical-triage-store.ts`, `clinical-triage-store.test.ts`, `comprehensive-consultation-store.ts`, `comprehensive-consultation-store.test.ts`, `op-registration-store.ts`, `op-registration-store.test.ts` | Old clinical/domain/draft contracts, including type-only references used by compilation. |
| `dcp-catalog-store.mjs`, `dcp-designer-store.mjs`, `dcp-designer-store.test.mjs`, `dcp-lifecycle-store.mjs`, `dcp-runtime-store.mjs`, `draft-policy-store.mjs`, `import-store.mjs`, `import-store.test.mjs`, `label-printing-store.mjs`, `preference-store.mjs`, `record-store.mjs` | Old DCP/catalog/rules/runtime, draft/import/label/preference contracts and validators. |
| `monitoring-store.mjs` | Old auth Sentinel event sanitizer. |
| `diagnostics-policy.test.mjs`, `reference-medslot-documentation.test.mjs`, `reference-surgisuite-documentation.test.mjs` | Old reference routes/navigation/documentation registries. |
| `documentation-http.test.mjs`, `monitoring-http.test.mjs`, `preference-http.test.mjs`, `security-http.test.mjs` | `desktop-clients/e2e/managed-api.mjs` harness. |

`mock-api/reference-school-store.mjs` mentions the old tree only in explanatory comments; it is not counted as an import/build blocker. `tooling/scripts/check-boundaries.test.mjs` contains an intentional forbidden-import fixture and the checker mentions the path in a comment; those references should not be mistaken for a runtime dependency. Historical documentation references also require preservation, not mass textual deletion. The `dummy-api → mock-api` compatibility symlink can go only after all old callers and packaging paths have migrated.

### How the product archives are produced today

This is the historical phase 7c-0 inventory. Phase 8 retires this library’s old archive inputs. Product-owned snapshot/backport packers must stay retired after registry adoption; this worktree does not modify other repositories. Publication rehearsal through root `release:pack` remains supported for the twelve current libraries.

These scripts and ledgers were read; none was executed. Historical archives remain immutable evidence. Deleting a directory at new HEAD does not remove its old Git history, but a product depending on historical source packing has not completed the registry migration.

| Repository / evidence | Observed archive lineage and operation | Replacement |
| --- | --- | --- |
| Healthcare: `scripts/frontend/pack.py`, `frontend.lock.json` | `git archive <pinned commit> desktop-clients/packages` into a temporary directory; verifies/applies the recorded host patch; follows `@pepbits/*` dependency closure from lock roots; sets distribution versions and `files:['src']`; removes tests; `npm pack --ignore-scripts --json`; checks recorded hashes/integrity and copies to provider-web/vendor. Current lock pins `8c8e0bf8e94a6bd22172b6f77c3d4942da218c7a`, `hc074.2`, `catalog-host.patch`. | Registry install/new product packages; retire active snapshot packing and update lock evidence without discarding prior records. |
| Healthcare: `scripts/frontend/pack-healthcare.py`, `healthcare-frontend.lock.json` | Same closure/pack process to tenant-web/vendor; current pin `a9703f1250d993d583a6dd6d8e09c4e3d127b1c9`, `hc096.1`, no patch. | Same; do not assume the provider lock describes tenant archives. |
| Healthcare: `scripts/frontend/pack-inventory-ops-ui.py` | Historical ops-ui-only pack from `d2657a2e6646d35e4957a3ffe6c4031ac734e4e5`, version `hc092.1`; checks immutable bytes, updates ledger/manifest. Current manifest pins differ. | Remove it from active regeneration workflows; retain provenance if required. |
| ERP: `frontend.lock.json`, `scripts/verify_frontend_lock.py`, `scripts/verify-frontend.sh` | Adopts Healthcare-produced archives. Platform set records Healthcare commit `7f15372925d8d89f5d9169e652bf03c836bbf233`; tenant set explicitly records byte-identical `hc096.1` copies from Healthcare `76bc868`. Verifier enforces archived bytes/dependency specs. No independent old-library packer found in tracked non-vendor source. | Registry version/integrity gate plus independently owned Platform dependencies; update all app manifests and both ledger sets coherently. |
| School: `frontend.lock.json`, `scripts/verify_frontend_lock.py`, `scripts/verify-frontend.sh`, `scripts/sync_healthcare_frontend.py` | Adopts Healthcare provider/platform and per-host tenant sets; records source paths/commits/hashes. Separate source-sync gate reproduces copied host files from recorded Healthcare commits. No independent old-library packer found. | Migrate the upstream copied host baseline and update sync/pin gates, then install registry packages. |
| Platform: `services/platform-service/frontend/shared-artifacts.lock.json`, `scripts/prepare-navigation-archives.py`, `frontend/patches/central-navigation.patch` under that service | Adopts existing ERP/Healthcare `hc.fa36d76.1` bytes; extracts only erp-shell/ops-ui, verifies input SHA-256, applies the tracked backport, versions as `central-navigation.1`, and runs `npm pack`. | Preserve/test that navigation behavior against new exports; retire the backport packer after direct registry adoption. |
| Platform UI/auth distribution; Healthcare `scripts/onboarding/package-ui.py`, `package-reviewed-ui.py`, `platform-ui.lock.json`; ERP/School frontend ledgers | Platform-owned packages have their own source/version/archive lineage. Healthcare scripts build/pack a Platform source snapshot (historical path `platform-web`) and copy to registration/admin hosts; the current owning repo path is `libraries/platform-web`. Auth is separately pinned. | Platform-owned release/distribution pipeline, updated source paths and dependency/peer contracts. These archives are not outputs of this library's twelve-package publication. |

Phase 8 is ready only when all four product migrations and their provenance/sync checks are accepted, new hosts replace the old service/deployment contracts, the mock API and documentation tools no longer import the legacy tree, needed native/browser/visual coverage has moved, and no active shim/archive workflow depends on it. Preserve historical records; do not publish or delete artifacts merely to make a checklist green.

## Validation and limits

The import inventory was mechanically aggregated from tracked source, and every mapped target was checked against the owning export map and recursively resolved export declaration. Every missing name was checked across the public export graphs; product and Platform locations were then inspected. API classifications include explicit provider requirements and implementation/signature comparisons, not just name matching. CSV row counts, duplicate keys, evidence paths and summary totals were checked locally.

Documentation check: `/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/desktop-clients/node_modules/.bin/jiti docs/tools/check-docs.mjs` — **PASS: 222 documentation files** with `NODE_PATH=/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/desktop-clients/node_modules`. The initial invocation without NODE_PATH failed to resolve `lucide-react` from this uninstalled worktree; the successful run reused existing dependencies without installation or repository changes. Scope is documentation validation against library HEAD plus these six documentation files. No product execution, archive extraction, installed-package build, real backend acceptance, registry authentication, native executable test, commit, push or deployment was performed.
