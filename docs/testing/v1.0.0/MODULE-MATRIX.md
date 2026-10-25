# Library renderer matrix — guide 1.0.0

| Family | Destinations | Main renderer | Required acceptance |
| --- | --- | --- | --- |
| Named templates | 102 | PageTemplateWorkspace and 12 engine families | Definitions render; supported tables/layout/page-size use managed preferences; adapter behavior retains validation/recovery |
| Template index | 1 | TemplateLibraryPage | Search/filter/navigation and current generated examples |
| Component catalogs | 12 | ComponentCatalog and demo functions | Shared components, real examples, current formatters and managed controls |
| Page Library workspaces | 9 | PatientQueryTemplate, PatientRecordTemplate, Patient360Template, BillingClinicWorkspace, ClinicalTriageWorkspace, ClinicalConsultationWorkspace, OPConsultationWorkspace, ComprehensiveConsultationWorkspace, RegistrationWorkspace | API data/metadata, fields/actions, locks, formatting, shortcuts, previews, errors and relevant scope |
| Page Library catalog | 1 | PageLibraryCatalog | API navigation membership/order, page opening, relocated examples/guides, access changes and localization |
| Dedicated reference pages | 6 | LibraryReferencePage | Dedicated theme/accessibility/catalog/contracts/shortcuts/integration content; translated labels and real preference controls |
| Other shared destinations | 10 | Dashboard, WorklistPage, SpreadsheetPage, PreferencesPage, InboxPage, AiAdministration | Canonical routes do not lose Library presentation; feature-specific permissions/data behavior remains covered by its own tests |
| Barcode / QR printing | 7 | LabelPrintingWorkspace | Backend artwork, print dimensions, profile policy, reprints, payment simulation and scope |
| Device integrations | 3 | DeviceIntegrationWorkspace, ScannerInput, DeviceJobList | API scan lookup, workstation scope, queued/printed-requested/simulated states, event deduplication and tenant device policy |
| Identity devices | 3 | IdentityDeviceWorkspace, IdentityResultPanel, IdentityHistory | Synthetic capture, no authentication claim, consent, tenant policy, challenge expiry, manual review and isolation |

Total: 154 unique destinations. The [inventory](inventory.json) names each page and engine; the [original audit inventory](https://github.com/pepbits/pepbits-frontend-library/blob/3558a131f0fd443693eae0dfc678e3b258b480c1/desktop-clients/docs/library-preference-audit.md) preserves the pre-correction findings.

The 102 named templates use master, list, order, booking, case, result, finance, reconcile, report, dashboard, entity and admin engines. A test of one shared renderer provides relevant coverage to its consumers, but does not prove every application's domain rules.

The inventory preserves the historical API catalog. Current shared implementation tests live in the root packages, with demo profile/workflow checks in each app. The root boundary gate and explicit production integration selection replace the removed combined-shell static and suite-registry scripts; configured coverage is distinct from a hosted passing run.
