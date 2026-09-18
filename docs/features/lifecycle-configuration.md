# Feature: Shared lifecycle configuration

Feature ID: LCA. State: implemented and tested locally (components, contract guards and HTTP adapter). Not deployed; no live host acceptance.
Affected applications/pages: any host that mounts `LifecycleConfigurationPage` (healthcare first; ERP, School, CRM and POS can reuse it unchanged). No Library demo route is registered.
Related records: [release record](../releases/unreleased/lifecycle-configuration-2026-09-18.md), [testing guide 1.0.0](../testing/README.md), shared guide `saas-shared-document/cross-dev/SHARED-LIFECYCLE-DEVELOPMENT-GUIDE.md` (phase LC-05), backend wire contract v1 (`pepbits-backend-library/lifecycle`).

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

An ERP host supplies `application={{code: 'erp', …}}` and its own BFF path; nothing else changes. The page has no product namespace default. Tenant, application and actor must come from the host's verified session; the server authorises every call. Permission props only shape the UI.

## Compatibility, localization and accessibility

New, additive exports; existing packages and pages are unchanged. The page uses `PresentationProvider` with effective preferences (density, table stripes, sticky headers, font scale), semantic theme tokens and the radius token. Dates use the host localization `dateTime` formatter. It uses shared ops-ui controls (Input, Select, Textarea, Checkbox, DateInput, Tabs, Segmented, Table, Card, Badge, Modal, ConfirmDialog, RecoveryNotice, DescriptionList). The two-pane tree and editor layout use a CSS module because no shared primitive covers a master/detail editor. It collapses to one column below 900 px and respects reduced motion.

350 `lifecycle.*` messages are in the canonical catalogs for en, ar, hi and ml and are regenerated into fallbacks. The Arabic, Hindi and Malayalam texts are machine-drafted and not native-reviewed. Definition labels are business data and are shown untranslated. Keys, codes, event types and checksums are shown verbatim.

## Acceptance, completed and pending work

Completed locally: contract guards, HTTP adapter, model helpers and the page with 34 Vitest cases (19 contract/adapter/model, 15 page). Contract tests cover Unicode (Arabic, Hindi, Malayalam, emoji) percent-encoded reason round-trips, the character and byte bounds, controls and lone surrogates, and lifecycle module/domain grouping across two domains. The guards also accept 13 real Java-produced wire fixtures unchanged; that check is the parent's `healthcare/scripts/lifecycle/check-wire.mjs`. The page tests cover not-enabled state, access denial, saves with expected revision and operation-key reuse on retry, conflict recovery with edits kept, published read-only, the unsaved-change guard, the independent-approval hint, activation (reason, confirmation, expected revision, idempotency key), server validation issues with navigation, read-only preview, key renames that cascade, and module/domain editing that regroups the catalogue and is saved. Typecheck, form-control, shared-component, preference, example and localization gates pass. See the release record for exact commands.

Pending: healthcare host adoption, packaging and live API/browser acceptance (parent/host repositories); an ERP or other second consumer; native-speaker review; browser checks for Arabic RTL and long Hindi/Malayalam strings; event-type resolution in the UI; persisted drafts through the shared draft service (edits are held in memory only). No clinical scoring, assessment authoring or workflow execution is provided by this page.

## Operations and support

Failures use the shared recovery notice (retry only where retryable, with the same operation key) plus a lifecycle-specific explanation for each library error code. `CONFLICT` means a stale revision, a duplicate open draft or a reused idempotency key: reload, then reapply the change. Edits are kept on screen after a failed save. A response that does not match contract v1 is rejected with its JSON path rather than partly rendered. Rollback is activating an earlier published version. It changes future resolution only and does not undo executed actions.
