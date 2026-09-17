# DCP visual template designer

Feature: DCP-01. The shared frontend provides a visual designer at **Library → Page Library → DCP Visual Designer** (`/library/dcp-designer`). Review/publication and entity answers run through the synthetic demo API. Production host DCP wiring remains separate.

## Designer layout

The style update of 12 September 2026 uses a compact component palette, a central section/field canvas and a selected-field inspector. On wide screens the palette and inspector scroll independently; field settings appear before review/release settings. Narrow screens stack the panels. Existing actions, field properties, authorization and API behavior are unchanged. Colors, radii, typography and density continue to follow effective host preferences. See the [local style verification](../releases/unreleased/dcp-designer-style-2026-09-12.md) and [verified deployment](../releases/unreleased/dcp-style-deployment-2026-09-12.md) to both demo sites.

## User workflow

1. Select a section. Click a palette item to add it there, or drag its handle onto a section. Supported types are text, long text, email, number, date, time, dropdown and checkbox.
2. Add sections. Select a field or section to edit properties. Stable IDs are generated once and remain read-only when labels change.
3. Drag handles reorder fields/sections. Keyboard drag uses Space, arrow keys and Escape; explicit Move up/down buttons provide another keyboard path. Field settings can move a field to another section.
4. Edit labels and required state, set a number minimum, or enter dropdown options as one `value|label` per line. Values remain strings, including leading zeros. Duplicate field creates a new ID. A section must be empty before removal.
5. Select the prominent **Live preview** button after designing, even before saving. Preview shows the form title and hides authoring controls. **Design** returns to editing without losing the form or test answers; **Reset preview** clears only test answers. Use preview to fill the same shared TemplateFields controls used by the existing page engines. Validate preview checks required fields, email, number minimum and selected-option membership. Preview answers are temporary. Explicit validation sends synthetic test answers to the demo API without persisting them as records; dropdown lookups send only ancestor selections.
6. Save design draft persists through the demo API. Open saved design restores it. Unsaved changes require explicit discard before switching; closing the tab uses the browser's unsaved-change prompt.

## Dependent dropdowns: Country → State

1. Add a dropdown labeled Country. Enter `IN|India` and `AE|UAE` on separate option lines.
2. Add State with `KL|Kerala`, `KA|Karnataka`, `AZ|Abu Dhabi` and `DU|Dubai`.
3. In State properties select **Depends on → Country**. Use each **Parent value for …** selector to map Kerala/Karnataka to India and Abu Dhabi/Dubai to UAE.
4. Complete every mapping. Save and preview are blocked for dangling, unmapped or cyclic dependencies. Parents must be dropdowns; a chain allows at most five dependency links. A parent with children cannot be removed until those dependencies are removed.
5. Open Live preview. State is disabled until Country is selected. India offers Kerala/Karnataka; UAE offers Abu Dhabi/Dubai. Changing Country clears State and all deeper descendants. Loading, no matches, missing parent and failed lookup are separate states. Retry retains the parent selection; late responses cannot overwrite newer selections.
6. Save design draft preserves the mapping in the scoped demo API CSV. Validate preview performs local feedback followed by server validation for locally valid answers; direct API validation also rejects forged parent/child pairs.

**Add Country → State example** inserts a complete configuration supplied by `dummy-api/config/dcp-designer/examples.json`, with fresh field IDs and remapped links. Company → Branch, Category → Item and other dropdown pairs use the same configuration. User-authored names remain literal; stable IDs and option values are not translated. Leading-zero option IDs are preserved.

Inline and uploaded CSV/XLSX sources use bounded option metadata: 1,000 options per dropdown, one parent per field, and five dependency links. Multi-parent conditions and server-paged production catalogs remain pending. CSV/XLSX staging and explicit immutable catalog revisions are supported. No third-party ERP equivalence is claimed without an agreed comparison specification.

## Reusable value sets and relationships

Use **Manage value sets** in the palette to maintain centrally shared lists. The demo API seeds Country, State and a Country → State relationship. These are shared by users within the same tenant/application; form drafts remain user-owned.

1. In **Value sets**, enter a catalog name and `value|label` lines, then **Save new revision**. IDs preserve leading zeros. Open an existing catalog revision to create a new version of the same set; earlier versions stay unchanged.
2. In **Relationships**, choose exact parent and child set revisions. Map every child option to one parent value and save. The same relationship can be reused by many forms.
3. Add dropdowns to a form. Under **Option source**, choose the set revision. An independent Country dropdown references Country revision 1. A State dropdown references State revision 1, **Depends on → Country**, and the matching **Shared relationship** revision.
4. Save and preview. Definitions store references, not copied catalog options. The server resolves the selected versions for lookup and validation.
5. A later catalog revision does not alter existing forms. To upgrade, explicitly select the new set and compatible relationship revisions in each intended form. Selecting an old catalog revision for editing creates a new revision on save; it does not rewrite history.
6. **Refresh catalog** fetches current versions without replacing form or catalog edits. After a conflict, review the latest revision and explicitly reopen it; unsaved editor changes require discard confirmation. Retry after a network failure reuses the same operation ID.

Only enterprise administrators can create catalog revisions. Retained catalog revisions have a 10,000-option total budget per tenant/application. Other authorized designer users can browse them. Tenant and application scopes are independent; catalogs are not global across tenants. Each set has at most 1,000 options. The demo retains at most 100 set versions and 100 relationship versions per tenant/application, with a bounded 100-operation catalog retry window. Each relationship maps one parent per child option. A field can combine multiple pinned relationships conjunctively, as described below. Arbitrary many-to-many mappings, retirement/inactive-value rules, catalog approvals, large-dataset paging and production governance remain pending.

## Preferences, authorization and recovery

Shared controls receive effective preferences through PresentationProvider. Theme, density, font scales, radius and language follow the host and tenant locks. No independent shell, preference store or browser draft store is introduced. English, Arabic, Hindi and Malayalam framework labels and help are supplied by canonical catalogs. Field and section labels support en/ar/hi/ml dictionaries with selected-language, English and original-label fallback. Complete form/option translation administration and production tenant metadata integration remain separate work.

The demo API checks navigation access and requires the enterprise administrator role for writes. Designs are scoped by authenticated tenant, application and user. This is actor-owned draft storage; organizational sharing/reviewer/publisher permissions remain backend integration work.

Failed saves retain edits. Retry uses the same operation ID; edits produce a new operation. Expected revisions reject stale writes. Open the latest saved design after reviewing unsaved changes to resolve a conflict. Only the most recent 100 operation receipts per scope are retained; this is a bounded demo retry window, not permanent production deduplication.

## Architecture and public integration

- `erp-config`: DesignerDefinition reuses existing TemplateSection and TemplateField contracts, approved type list, bounded schema validation and preview checks.
- `erp-data`: DesignerAdapter and createDesignerAdapter perform authenticated POST requests and runtime response validation.
- `erp-screens`: DcpDesignerWorkspace composes palette, sortable canvas, property panels and existing TemplateFields preview.
- `ops-ui`: shared controls remain the visual foundation. Button now accepts a React 19 ref so drag handles can restore keyboard focus.
- `dnd-kit`: pinned core/sortable/utilities dependencies provide drag mechanics. No alternate form framework is installed.
- `dummy-api`: `/dcp-designer` supplies the initial configuration and capability types, reads/writes scoped CSV snapshots, authorizes saves and checks revisions/operation IDs. It is synthetic demonstration storage only.

Inject DesignerAdapter, authenticated scopeKey and the existing PreferenceHost into DcpDesignerWorkspace. A public TypeScript example is available in List of pages. The frontend never connects to PostgreSQL or imports Java libraries.

This draft definition is a frontend template contract, **not** the backend DCP JSON codec. The backend already has Form/Section/Field models, expressions and authoring/release services. A host adapter must explicitly map supported frontend types and stable IDs onto that model, enforce authority and reject unsupported conversion. No production DCP tables, migration runner or alternative persistence layer are introduced.

## Validation and limits

A design needs a nonblank title, at least one section, unique bounded IDs, nonblank labels and supported types. Maximum: 20 sections, 100 fields, 1,000 options per dropdown, 100 saved designs per user/application/tenant. Option values must be unique; empty dropdown lists and nonfinite minimums fail schema validation. Requests are bounded at the API. Schema validation runs on the server and returned JSON is checked at runtime by the client.

The preview and runtime use shared TemplateField controls. Typed normalization and bounded arithmetic are supported below. Bounded multi-parent dependencies and repeating occurrences are implemented in the increments below. Exact decimal serialization and full backend expression AST parity remain separate work.

## Remaining scope

Production DCP conversion and host endpoints; production reviewer separation and approval integration; large server-paged datasets and unrestricted relationship models; advanced rule AST and production domain bindings; production adapters for the implemented shared scoped DCP draft recovery; files/attestation; advanced component packs; responsive layout authoring and arbitrary column layouts; database/native/device/performance acceptance. Preview and runtime support stacked, tabbed and stepped sections with one, two or three field columns.

The broad [enterprise scope and reuse assessment](../development/README-DCP-ENTERPRISE-FORM-SCOPE.md) remains the roadmap. Delivered increments cover visual composition, draft persistence, dependent preview validation and reusable versioned value sets; the full roadmap remains incomplete. See [delivery evidence](../releases/unreleased/dcp-designer-2026-09-11.md).

## Dependency API contract

`DesignerField` extends the existing template field with optional `dependsOn` (stable parent field ID). Each dependent option has `parentValue` containing a stable parent option value. `TemplateFields` accepts optional injected field states for disabled/loading hints and resolved options; ordinary pages retain their existing behavior.

The existing authenticated `/dcp-designer` endpoint adds `options` and `validate` commands. For saved drafts, supply `id` and `revision`; the server loads the authoritative saved definition and rejects a simultaneous definition override. For unsaved authoring previews, an administrator may send the bounded `definition`. Other roles cannot supply arbitrary preview definitions. `options` takes `fieldId` and ancestor `values`; `validate` takes test `values` and returns structured field errors. Neither operation writes answers. Existing tenant/application/user scope and revision checks apply. This endpoint demonstrates preview validation, not business-transaction persistence or production DCP integration.

## Shared-catalog integration contract

`DesignerCatalog` contains immutable `CatalogSet` and `CatalogRelationship` revisions. A catalog-backed field stores `valueSet: {id, revision}`; a dependent field additionally stores a `relationship` revision reference and the parent field ID in `dependsOn`. The relationship pins both parent and child set revisions. Inline option arrays are forbidden on catalog-backed fields, preventing client copies from becoming competing authorities. Inline and catalog sources cannot be mixed within one dependency pair.

`save-value-set` and `save-relationship` commands use the existing authenticated designer adapter, expected head revision and idempotency operation ID. Saved timestamps and actor IDs come from the demo server. Catalog mutations update only the shared catalog scope in the existing CSV snapshot store. They do not overwrite user-owned form drafts. `options`, `validate` and form saves re-resolve references against the authorized catalog and reject unknown or mismatched revisions. Public helpers and types are exported from erp-config. Production hosts must map these frontend references onto the existing backend DCP catalog/definition contracts; no production table, migration or Java service is introduced here.

The catalog seed lives in `dummy-api/config/dcp-designer/catalog.json`. Existing inline examples and saved designs remain supported. Version pinning applies to catalog metadata and does not establish production form publication, legal attestation or historical business-answer storage.

## Import CSV options into a value set

Open **Manage value sets**, create a set or open the revision you want to revise, and enter its name. Upload a UTF-8 `.csv` file up to 2 MB containing a header and 1–1,000 data rows. Choose different columns for ID and label. IDs remain text, so `001` is not converted to `1`. Quoted commas and Unicode labels are supported.

Review every mapped row. Duplicate/blank IDs, blank labels, IDs longer than 80 characters and labels longer than 160 block the entire import. Pipe characters and embedded line breaks cannot be represented in the current line-based catalog editor and are rejected. Malformed CSV, invalid UTF-8 and header collisions are rejected by the shared parser. Extra unmapped columns are ignored. No formulas are executed.

**Replace editor with reviewed rows** replaces only the unsaved option editor. It does not merge rows or save to the API. **Save new revision** sends the complete reviewed set through the existing catalog adapter; the server validates it and atomically writes a new revision or rejects it. No partial revision becomes visible. Existing form references remain on their pinned revisions. Selecting a CSV file blocks saving until its staging is applied or canceled, preventing an accidental save of the previous options. Closing or switching an unsaved catalog editor uses the existing discard prompt.

CSV/XLSX staging remains in memory and follows the catalog editor's permission state. Refreshing the catalog does not discard it. A recoverable save failure retains the applied options and retry command; conflicts require reviewing the latest revision. There is no background import job, resume-after-refresh, CSV relationship import or server-side dataset pagination in this increment. XLSX parsing runs in a worker with a five-second timeout, a 2 MB compressed input limit, 16 MB declared expanded ZIP limit, ten sheets, eighty columns and 1,000 rows per sheet. Formula cells, macros and external-link parts are rejected. Preview is paged locally in groups of fifty rows; this does not establish million-row scalability. Larger dataset staging and activation remain on the enterprise roadmap. Shared inputs/selectors/tables use the existing preference and localization providers; no new shell or preference store is introduced.

## Rules, normalization and layouts

In field properties, configure numeric minimum/maximum and whole-number restrictions; text length, letter/alphanumeric/case checks; and optional trim or trim-then-uppercase normalization. Length counts Unicode code points. Uppercase validation checks casing; choose ASCII/Unicode letter validation separately when letter-only input is required. Normalization occurs before validation, and is distinct from rejecting lowercase input. Integer 0–10 accepts both endpoints and rejects negatives, 11 and fractions.

Conditions reference another stable field ID and use equals, not-equals or has-value. Configure visibility, conditional required state or read-only presentation. Hidden values are retained, not erased; visibility/read-only presentation is not field authorization. Calculated numeric fields reference two numeric fields for sum, difference, product or ratio. Missing inputs, nonfinite output and division by zero fail calculated-field validation. Cycles across dropdown, conditional and calculation references block valid schemas. Values are recomputed on the API and client-provided calculated results are ignored. Arithmetic uses JavaScript finite numbers, not an exact-decimal finance engine.

In the release panel, choose stacked sections, tabs or steps and one to three columns. Preview and entity runtime reuse DesignerSections and TemplateFields. Validation moves tab/step views to the first section containing an error. Section navigation preserves values and does not independently commit business transitions.

## Review, publication and entity answers

1. Choose an API-registered answer owner type and trigger. Synthetic patient, encounter, lab order-item, employee and item records are supplied by `dummy-api/config/dcp-designer/entities.json`; they are not references into a production clinical database.
2. Save the design, submit for review, approve, then publish. Request changes returns a reviewed design to draft and requires a reason. The demo administrator can preview all roles; independent reviewer/publisher grants require the production authorization adapter.
3. Published content is immutable. Create next draft unlocks the working design without rewriting the published snapshot. New publication creates another release. Retirement requires a reason and prevents further writes to releases of that form; existing answers can still be read. This is a demo lifecycle, not the existing production Workflow bridge or legal attestation.
4. Open Published forms, select a release and compatible owner, then load its answer form. Save answer draft stores a recoverable API draft; Submit answers validates the pinned schema, selection membership and rules before submission. Submitted answers are read-only in this increment. Amendment/signature workflows remain pending.
5. Answers are shared by authorized demo users within the tenant/application for the same release/owner, with expected revisions, bounded idempotency receipts and retained revision snapshots. Wrong entity types, foreign tenants/applications, stale writes and edits to submitted answers are rejected. This demo permits navigation-authorized users to access its registered synthetic owners; real record/field permissions must be injected by the product adapter.

Limits: 100 releases, 100 current answers and 1,000 retained answer revisions per tenant/application, with the existing bounded operation receipts. There is no indefinite audit guarantee, actual domain foreign key, production transaction rollback acceptance, or signer identity verification implied by CSV storage.

## Production host adapter boundary

`createDcpHostAdapter` in erp-data accepts the host authenticated request function plus application-owned `encode`, `decode` and optional `decodeError` functions. The encoder maps public designer commands to the actual registered host paths and bodies; the decoder maps its versioned responses into the validated frontend contract. Only relative host paths are accepted. Requests carry an abort signal with a 30-second deadline. Errors retain mapped field paths and incident references when supplied by the host codec. Tenant form metadata never provides endpoint URLs or executable codecs.

This is a tested integration seam, not a claim that a Spring Boot endpoint is connected. The live endpoint, current wire schema, actual permissions and version compatibility must be supplied and exercised. No backend library, migration or product business operation was changed by this frontend increment.


The XLSX reader uses SheetJS CE 0.20.3 pinned to the publisher's distribution URL across the existing web, desktop and shared-screen consumers. See [official installation guidance](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/). The import worker checks actual expanded byte counts before workbook parsing, rejects encrypted/data-descriptor ZIP entries and uses a bounded lifetime. The declared limits are acceptance boundaries, not proof that every workbook or browser is supported. Unsupported/corrupt workbooks produce a localized failure; CSV remains available.

## Current backend contract runtime and frontend additions

Open **Backend contract runtime** on the designer page to exercise the separately supplied DCP v1 contract. This uses a synthetic API-owned employee form and CSV snapshot, not a production Java endpoint. All eight current v1 types are rendered: text, integer, decimal, Boolean, date, datetime instant, choice and nested collection. Collection rows keep server `_id` values. New rows carry only local UI identity until the server assigns an ID; that UI identity is removed from requests. Remove/undo is staged until save.

Edits trigger a bounded server preview after a short pause. A validation response, including HTTP 422, keeps edits and shows field errors plus a shared error summary. Required Boolean `false` is present in this v1 contract. This differs from the existing authoring template's required-checkbox convention; the two definitions must not be posted interchangeably. Read-only, masked and hidden fields are omitted from patches. Preview and save are distinct: only an acknowledged save without violations shows **Server save confirmed**. CAS revisions remain strings, including values above JavaScript's safe integer limit. No failed write is automatically replayed; reload and compare after a conflict or uncertain result.

The existing shared draft service now accepts a `dcp` recovery scope. It isolates drafts by authenticated tenant/actor, application, page and the host-supplied owner/form scope key, applies retention and field exclusions, and never writes browser storage. Restoring requires the same revision and checksum; stale drafts cannot silently overwrite a newer record. Draft Center lists DCP drafts and opens the designer; choose Backend contract runtime for the Library's synthetic recovery example. A recovery acknowledgement is not a saved business record. Product integrations must supply a distinct record key for each owner, form/version, occurrence and organizational scope.

The visual designer additionally supports:

- Up to four conjunctive dropdown parents, five edges per dependency path, API membership checks and clearing descendants when any parent changes. Every extra parent needs an inline mapping or a pinned catalog relationship.
- Field and section label translations for English, Arabic, Hindi and Malayalam. Resolution is selected language → English → original label; field IDs, option IDs and answer values do not change. Imported labels retain their provided text.
- Shared searchable selectors, radio groups, segmented choices (maximum four options), toggles, sliders with number entry, labeled integer ratings (maximum eleven choices), and read-only presentation. Presentation is not field authorization.
- Repeatable sections with minimum/maximum rows (up to 100), stable occurrence IDs, per-row normalization/calculations and occurrence-specific validation. Shared parent changes clear dependent values across rows. Designer repetition is one level; nested collections are supported separately by the v1 runtime. Row option filtering uses the bounded API-delivered catalog; it does not establish remote paged per-row lookup.
- Release comparison by stable field/section identity, including ordering, rules, mappings and labels. Answer history displays the API's revision/actor/time/status metadata.

### Host integration example

```tsx
import {createDcpRuntimeAdapter} from '@pepbits/erp-data';
import {DcpHostRuntime} from '@pepbits/erp-screens';

// Resolve these paths in trusted application code, bound to an authorized owner.
const adapter = createDcpRuntimeAdapter(authenticatedRequest, hostPaths);
// Render inside the existing shell/PresentationProvider. Remount for scope changes.
<DcpHostRuntime
  adapter={adapter}
  scopeKey={authorizedWorkspaceIdentity}
  draftScope={hostRecoveryScope}
/>
```

`hostPaths` supplies `load`, `preview` and `save` relative paths. The existing authenticated request owns session/BFF integration; the adapter adds the contract-version header, cancellation, timeout and runtime response validation. The host must allow that header in its CORS policy where cross-origin requests are used. The Library's demo API does so. Do not infer production paths from `/dcp-designer`.

The verified backend fixture handoff is [PLIBRYBEND-206](https://pepbits.atlassian.net/browse/PLIBRYBEND-206); the [frontend-owner response](https://pepbits.atlassian.net/browse/PLIBRYBEND-206?focusedCommentId=10095) records the remaining backend requirements and ownership. Contract fixtures from attachment 10000 are retained under `desktop-clients/packages/erp-data/src/fixtures/dcp-v1/`; they are actual-engine synthetic fixtures, not PostgreSQL or live-host evidence.

This completes additional frontend capabilities, **not the full supplied enterprise scope**. Advanced authoring components and nested editable grids, staged large-dataset job UI, organizational assignment and independent permission administration, attachments/capture/domain packs, workflow/attestation/amendment interfaces, print/report operations and actual native acceptance remain work. Backend tasks remain with the other session. None of the current work is a deployment claim.

### Deployment follow-up — 11 September 2026

The supported increment above is now deployed on both demo sites as `20260911145802227-397d1cf5`, from application commit `0cab668d3dc816ff6f855cc5911c2b4bad5e1b75`. Public browser checks verified the shared runtime and repeatable designer through the demo API. This supersedes the earlier local-only status, while the remaining enterprise scope stays pending. See [deployment evidence](../releases/unreleased/dcp-frontend-deployment-2026-09-11.md).

### External host fields — 17 September 2026

A narrow `@pepbits/erp-screens/dcp-fields` export supports authorized domain reference controls and
host-owned sessions. Required collections retain their final row. See the [host composition contract](hosted-healthcare-composition.md).
