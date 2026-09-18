# Feature: Shared lifecycle configuration

Feature ID: LCA. State: implemented and tested locally (components, contract guards and HTTP adapter). Not deployed; no live host acceptance.
Affected applications/pages: any host that mounts `LifecycleConfigurationPage` (healthcare first; ERP, School, CRM and POS can reuse it unchanged). No Library demo route is registered.
Related records: [release record](../releases/unreleased/lifecycle-configuration-2026-09-18.md), [source mapping increment](../releases/unreleased/lifecycle-source-mapping-2026-09-18.md), [testing guide 1.0.0](../testing/README.md), shared guide `saas-shared-document/cross-dev/SHARED-LIFECYCLE-DEVELOPMENT-GUIDE.md` (phase LC-05), backend wire contract v1 (`pepbits-backend-library/lifecycle`).

## User problem and outcome

Administrators need to define which lifecycles, stages and events an application recognises, and which exact form, workflow, assessment, notification, integration, rule or action version applies at each point. Before this feature the library had no neutral administration surface for that; the DCP designer's own lifecycle panel covers only DCP forms.

The new page manages versioned lifecycle release definitions through the host's real API: browse, edit a draft, validate, preview resolution, approve independently, publish immutably and activate for the tenant. It never fabricates rows, scores, audit dates or execution results.

## User and administrator flows

1. **Open the page.** The page loads server metadata, either the library metadata or a host envelope whose `library` field carries it. If the host reports `available:false` (`LIFECYCLE_NOT_ENABLED`) or a route returns `LIFECYCLE_NOT_ENABLED`/`LIFECYCLE_SCHEMA_NOT_READY`, an explicit "not enabled" state is shown instead of an empty list. Without read permission the page shows Access not permitted and makes no request. When the host says it does not run triggers (`execution.triggerExecution` or `eventWorkersEnabled` is false), a note states that the page covers configuration and preview only. **Show installed capabilities** lists the host-reported capability statuses verbatim.
2. **Catalogue and worklist.** The left rail shows Application → [Module → Domain] → Definition → [Module → Domain] → Lifecycle → Stage → Event. Definition-level module and domain groups come only from the host's optional `classify` projection; definitions it does not classify sit directly under the application. Inside the open definition, lifecycles are grouped by their own optional `module` and `domain` codes from the loaded definition (for example `patient-administration` → `patient-identity` → `registration`). A lifecycle without them sits directly under its definition; a domain without a module sits directly under the definition. The groups are built from the already-loaded definition only: no summary is fetched or classified to build them and no taxonomy is guessed. Selecting a lifecycle module or domain opens the Lifecycles section. The worklist lists stored versions from the list endpoint with code/status filters and cursor-based **Load more**.
3. **Create.** *New definition* asks for a code (`[a-z][a-z0-9-]{0,63}`) and name. Nothing is stored until **Save draft**, which calls `createDraft`; the server assigns the version. Save draft and Create next version require a **Change reason** (up to 1,000 characters) unless the host sets `changeReason="optional"` or `"hidden"`. The reason is sent only for create/save.
4. **Edit visually.** The Definition tab has sections for Overview, Dimensions, Stages, Events, Lifecycles, Bindings and optional Advanced JSON. Keys are renamed on Enter/blur only when valid and unused, and the rename updates every reference. Items still referenced cannot be removed; the references are listed. Lifecycles select stages and explicitly map events to stages (no stage × event product). Each lifecycle has optional **Module** and **Domain** codes (`[a-z][a-z0-9-]{0,63}`). An empty field stores `null`. An invalid value shows the key-format error and is not stored. The catalogue groups update as you type. Bindings choose an exact slot (lifecycle, stage, optional mapped event, purpose, unique priority), an immutable target (kind, code, version, optional handler, workflow states for WORKFLOW only) and typed applicability conditions (IN, RANGE for number/date, WITHIN for organisation). Target kinds that the host has not installed are flagged as not activatable.
5. **Advanced JSON.** The complete definition can be edited as JSON. It is parsed with `JSON.parse` and the contract guard only; nothing is evaluated. The application and code cannot be changed there.
6. **Validate.** The Validation tab calls the server validation endpoint for the editor content (read-only) or the stored version. Issues show severity, code, path and server message, and **Show** jumps to the affected item. Issues returned by a failed save (`INVALID_DEFINITION`, `UNSUPPORTED_CAPABILITY`) appear there too.
7. **Preview.** For a stored version, the Preview tab sends a resolve request for the active version or that explicit version, with test context: subject type/reference, an organisation path and typed dimension values. `previewPolicy` lets a host hide the subject reference (always sent as null) and accept exactly one organisation unit selector, whose ancestry the server derives. Number, yes/no and date values are validated; invalid text blocks the preview and is never coerced. Empty values are omitted so the server reports them as missing (`UNKNOWN`). Results show each slot's outcome, selected binding, target, missing context and every candidate's reasons. Preview never executes handlers or writes.
8. **Approve, publish, activate.** The Approval and activation tab shows the stored record (revision, checksum, approved checksum, editors, actors/times) and the current activation. Approve needs a saved, unchanged draft; when the host passes `actorId`, an editor sees why they cannot approve their own version. Publish requires an approved version whose checksum is unchanged and asks for confirmation (the version becomes immutable and is not activated). Activate requires a published version, a reason and confirmation; activating an earlier version is labelled as a rollback for future resolution only. **Create next version** copies a published definition into a new server draft.
9. **Versions.** The Versions tab lists all stored versions of the code and compares any two (or the unsaved editor) by stable key, showing added, removed and changed items with changed fields.

10. **Source registry and source mappings (optional).** When the host passes a `sources` port, **Show source registry** lists the sources that the host application registered in its active pinned source metadata release. The list is bounded and uses cursor paging. **Open** shows the source's release, pin revision, fingerprint, capture modes, service operations, active table captures and field metadata. Fields show their type, sensitivity, whether they can be selected or copied, table capture and whether events require them. No record values are shown. The Definition tab gains **Source mappings**. **Add** asks for a registered source and loads its detail. **Add mapping** then creates a mapping pinned to that source's current release, revision and fingerprint. Each mapping has a key, a capture mode and an operation. Both are limited to what the source and host support. It also chooses one declared lifecycle stage event; a table capture may only use the event type and schema version its trigger emits. For updates it can list watched fields. It then maps permitted source fields to payload fields using allowlisted transforms and typed conditions. Denied fields are never offered: `tenant_id` and any `deniedFields` the host lists. With **service capture**, only selectable fields are offered, and a field whose value may not be disclosed can only be sent as **Present**. With **table capture** (contract v1.2), only columns in the active capture's payload are offered. Each is a same-name **Copy**, so nothing beyond what the governed trigger already captures is disclosed. Denied columns that the trigger supplies itself are listed as "supplied by the table capture" and are not mapped. Payload names follow the EventPulse field grammar, and reserved envelope or prototype names are refused. **Payload shape** lists each destination, its produced type and its source field. When the registry pins a newer release, **Pin current release** re-pins the mapping; nothing is re-pinned silently. Mappings are saved in `definition.sourceMappings` with the rest of the draft. They therefore need a change reason and are subject to independent approval, immutable publication and activation. Local checks show contract issue codes immediately; server validation and activation verification remain authoritative.

Unsaved changes are protected: leaving the definition, opening another version or node, or closing the browser tab asks for confirmation. `onDirtyChange` lets the host guard its own navigation.

## Technical contract and integration

| Package entry | Contents |
| --- | --- |
| `@pepbits/erp-config/lifecycle` | Wire types matching backend contract v1 exactly, runtime guards (`parseLifecycle*`, throwing `LifecycleContractError` with the JSON path), pure helpers (key formats, rename/reference checks, diff, catalogue tree, governance gating, operation keys), the `LifecycleApi` port and `createLifecycleHttpApi`. No React. |
| `@pepbits/erp-screens/lifecycle` | `LifecycleConfigurationPage` plus the reusable parts (tree, worklist, editor, binding editor, validation, preview, governance, versions). The page is also exported from the package root. |

The UI depends only on the `LifecycleApi` port. The reference HTTP adapter maps it to the contract's suggested routes under a host-chosen `basePath`: `GET /metadata`, `GET /releases`, `GET|PUT /releases/{code}/versions/{v}`, `POST /drafts`, `POST …/{v}/approve|publish`, `GET|POST /releases/{code}/activation`, `POST /validate`, `GET …/{v}/validation` and `POST /resolve`. Every mutation sends `Idempotency-Key` and `If-Match: "<expectedRevision>"`. The key is fixed per operation and fingerprint (payload plus change reason) and reused on retry. When configured, `reasonHeader` (for example `X-Change-Reason`) carries the trimmed create/save change reason. `reasonEncoding` chooses the header form:

| `reasonEncoding` | Header value | Accepted reasons | Refused before sending |
| --- | --- | --- | --- |
| `raw` (default) | The reason verbatim | ISO-8859-1 text without control characters, at most 1,000 characters | `REASON_NOT_TRANSMITTABLE` |
| `percent-utf8` | ASCII `UTF-8''` + `encodeURIComponent(reason)` (RFC 8187 style; at most 4,507 characters) | Any script. The decoded reason must have at most 1,000 UTF-16 characters and at most 1,500 UTF-8 bytes, with no C0/DEL/C1 controls or lone surrogates | `REASON_TOO_LONG`, `REASON_INVALID_CHARACTERS` |

`lifecycleReasonHeaderValue(reason, encoding)` exposes the same rule. The host decodes the `UTF-8''` prefix and applies the same decoded bounds. The healthcare wrapper is to set `percent-utf8` (parent integration) so that Arabic, Hindi and Malayalam administrators can save drafts; this repository does not verify that wrapper. Generic hosts keep the raw default. `encodeURIComponent` never emits `+` or spaces, so a Java `URLDecoder` decodes the value unambiguously. The operation fingerprint always uses the decoded reason. Retrying the same payload and reason therefore reuses its key whatever the header encoding. The transport is either a fetch-like `request` returning a Response or a `send` function that returns decoded JSON and throws `{status, body}` errors (`lifecycleErrorFrom`). Guards carry unknown additive properties through, so saving never strips fields a newer server added. Activation sends the same key as `idempotencyKey` and `expectedRevision` equal to the current activation revision, or 0. Error bodies `{code, message, issues|details}` become `LifecycleRequestError` (`LIFECYCLE_` prefix removed, HTTP status kept for the shared recovery notice). `NOT_ACTIVE` on the activation read returns `null`. Event-type resolution has no contract route and is enabled only when the host names `resolveEventPath`; the page does not yet use it.

```tsx
import {createLifecycleHttpApi} from '@pepbits/erp-config/lifecycle';
import {LifecycleConfigurationPage} from '@pepbits/erp-screens/lifecycle';

const api = createLifecycleHttpApi({request: (path, init) => fetch(path, init), basePath: '/bff/healthcare/lifecycle',
  reasonHeader: 'X-Change-Reason', reasonEncoding: 'percent-utf8'});

<LifecycleConfigurationPage api={api} scopeKey={`${tenantId}:healthcare:${userId}`}
  application={{code: 'healthcare', label: t('Healthcare')}}
  permissions={{read, edit, approve, publish, activate, resolve}} actorId={userId}
  classify={summary => catalogue[summary.code]} notify={showToast} onDirtyChange={setNavigationGuard}
  previewPolicy={{allowSubjectId: false, organisationMode: 'selector', organisationTypes: unitTypes}}
  preferences={effectivePreferences} preferencePolicy={policy} />
```

Source mappings use the same transport options. `createLifecycleSourceHttpApi` maps the optional `LifecycleSourceApi` port to `GET /source-capabilities`, `GET /sources?cursor&limit` and `GET /sources/{source}` (backend source contract v1 §6). A host that answers `{available:false, code}` on capabilities, or returns `LIFECYCLE_NOT_ENABLED`/404, is shown as having no source registry. A 403 or `FORBIDDEN` response shows a permission state. `permissions.sources` (default `read`) lets the host hide the registry for a user. Mappings are part of the definition. `LifecycleReleaseDefinition.sourceMappings` is optional, and the UI adds it only when a mapping exists. A host without source support therefore receives the original wire shape. Renaming or removing stages, events, lifecycles and dimensions updates mappings, or is blocked while they are referenced, in the same way as bindings.

```tsx
import {createLifecycleSourceHttpApi} from '@pepbits/erp-config/lifecycle';
const sources = createLifecycleSourceHttpApi({request: (path, init) => fetch(path, init), basePath: '/bff/erp/lifecycle'});
<LifecycleConfigurationPage api={api} sources={sources} … />
```

An ERP host supplies `application={{code: 'erp', …}}` and its own BFF path; nothing else changes. The page has no product namespace default. Tenant, application and actor must come from the host's verified session; the server authorises every call. Permission props only shape the UI.

## Compatibility, localization and accessibility

New, additive exports; existing packages and pages are unchanged. The page uses `PresentationProvider` with effective preferences (density, table stripes, sticky headers, font scale), semantic theme tokens and the radius token. Dates use the host localization `dateTime` formatter. It uses shared ops-ui controls (Input, Select, Textarea, Checkbox, DateInput, Tabs, Segmented, Table, Card, Badge, Modal, ConfirmDialog, RecoveryNotice, DescriptionList). The two-pane tree and editor layout use a CSS module because no shared primitive covers a master/detail editor. It collapses to one column below 900 px and respects reduced motion.

350 `lifecycle.*` messages are in the canonical catalogs for en, ar, hi and ml and are regenerated into fallbacks. The Arabic, Hindi and Malayalam texts are machine-drafted and not native-reviewed. Definition labels are business data and are shown untranslated. Keys, codes, event types and checksums are shown verbatim.

## Acceptance, completed and pending work

Completed locally: contract guards, HTTP adapter, model helpers and the page with 34 Vitest cases (19 contract/adapter/model, 15 page). Contract tests cover Unicode (Arabic, Hindi, Malayalam, emoji) percent-encoded reason round-trips, the character and byte bounds, controls and lone surrogates, and lifecycle module/domain grouping across two domains. The guards also accept 13 real Java-produced wire fixtures unchanged; that check is the parent's `healthcare/scripts/lifecycle/check-wire.mjs`. The page tests cover not-enabled state, access denial, saves with expected revision and operation-key reuse on retry, conflict recovery with edits kept, published read-only, the unsaved-change guard, the independent-approval hint, activation (reason, confirmation, expected revision, idempotency key), server validation issues with navigation, read-only preview, key renames that cascade, and module/domain editing that regroups the catalogue and is saved. Typecheck, form-control, shared-component, preference, example and localization gates pass. See the release record for exact commands.

Source mapping increment (local only): 28 more Vitest cases. 17 cover the contract, adapter and model: wire compatibility of mapping-free definitions, strict enum paths, registry routes, forbidden and sensitive fields, v1.2 table-capture rules and host denied fields, reserved targets, stale pins and cascading renames. 11 cover the page: create and save through the draft, forbidden fields not offered, invalid and stale mappings, re-pinning, read-only published mappings, hosts without a source port, server issue navigation, and not-enabled, forbidden, empty and failed-read registry states. A read-only check parsed all 17 Java-serialised wire fixtures from the backend worker's build (`pepbits-lifecycle-core/target/lifecycle-wire-fixtures`, including source capabilities, page, detail and mapped definitions) through the guards, and each round-tripped unchanged. No live host has served the source routes.

Pending: healthcare host adoption, packaging and live API/browser acceptance (parent/host repositories); an ERP or other second consumer; native-speaker review; browser checks for Arabic RTL and long Hindi/Malayalam strings; event-type resolution in the UI; persisted drafts through the shared draft service (edits are held in memory only). No clinical scoring, assessment authoring or workflow execution is provided by this page.

## Operations and support

Failures use the shared recovery notice (retry only where retryable, with the same operation key) plus a lifecycle-specific explanation for each library error code. `CONFLICT` means a stale revision, a duplicate open draft or a reused idempotency key: reload, then reapply the change. Edits are kept on screen after a failed save. A response that does not match contract v1 is rejected with its JSON path rather than partly rendered. Rollback is activating an earlier published version. It changes future resolution only and does not undo executed actions.

## Lifecycle console layout

The shared page now uses a persistent left worklist, a central tabbed editor and a right live summary.
Search submits the existing exact-code/status API filters and keeps cursor continuation; it does not
pretend the server supports full-text name/module search or an active-only query. Open a worklist
card to edit; leaving a dirty definition prompts before discarding changes. The hierarchy remains
available in the expandable catalogue beneath the worklist.

Overview edits release identity labels. Stages & Events groups stage/event catalogues and lifecycle
membership, including module/domain and subject types. Stage cards show only mapped event pairs.
Bindings configures versioned engine targets. Applicability contains dimensions and the real binding
and source include/exclude rules. Source mappings retains approved registry pins and payload mappings.
Release contains independent approval, publication, activation and next-version actions. Validation,
Preview, Versions and Advanced JSON remain available as dedicated tabs.

The summary derives counts and release state from the current definition and API response. It never
shows an assumed successful validation or simulated activation. Editing clears validation evidence;
a late validation response for a different definition is ignored. Unsupported prototype owner fields,
archive actions and runtime switches are not presented as working services.

The console uses host theme, typography, radius and density tokens with shared controls. On narrow
screens the summary is hidden and the worklist/editor stack; normal keyboard navigation, RTL and
reduced motion remain supported. Canonical translations include machine-drafted Arabic, Hindi and
Malayalam, with native review pending. See the [console delivery](../releases/unreleased/lifecycle-console-2026-09-18.md).
