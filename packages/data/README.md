# @pepbits/data

Generic record editing, draft policy/storage contracts, CSV imports, approvals and record panels. This `0.1.0` ESM package exposes ESM JavaScript and declarations through its public export map. It has no React, product registry, environment configuration or default API host.

Published at **0.1.0** on GitHub Packages. Install with `npm install @pepbits/data` after adding the `@pepbits` registry `.npmrc` and a read token — see the [developer quick start](../../docs/development/PUBLISHING.md#developer-quick-start-for-product-apps). Working examples: the [component showcase](../../demo-apps/showcase/README.md) and the [demo apps](../../demo-apps/README.md).

## Public API

| Area | Exports |
| --- | --- |
| Records | `RecordSnapshot`, `DraftSnapshot`, `RecordBundle`, `RecordAdapter`, `EditorState`, `RecordEditor`, `createHttpRecordAdapter`, `RecordRequestFailure`, `RecordRejected`, `RecordConflict` |
| Memory records | `createMemoryRecordAdapter`, `MemoryRecordOptions` |
| Draft policy | `DraftPolicy`, `DEFAULT_DRAFT_POLICY`, `PROTECTED_DRAFT_FIELDS`, `parseDraftPolicy`, `filterDraftValues`, `mergeDraftValues` |
| Shared drafts | `DraftScope`, `DraftPayload`, `SharedDraft`, `SharedDraftBundle`, `DraftAdapter`, `createHttpDraftAdapter`, `draftContext` |
| Draft center | `DraftCenterItem`, `DraftCenterQuery`, `DraftCenterData`, `DraftCenterAdapter`, `createHttpDraftCenterAdapter` |
| CSV/imports | `parseCsv`, `suggestMapping`, `mapImportRows`, `ImportRowResult`, `ImportJob`, `ImportAdapter`, `ImportRequestError`, `createHttpImportAdapter` |
| Approvals | `ApprovalStage`, `ApprovalItem`, `ApprovalData`, `ApprovalChange`, `ApprovalAdapter`, `ApprovalError`, `createHttpApprovalAdapter` |
| Record panels | `RecordPanelScope`, `PanelItem`, `AttachmentItem`, `CommentItem`, `RelatedItem`, `ActivityItem`, `RecordPanels`, `PanelChange`, `RecordPanelsAdapter`, `RecordPanelsError`, `createHttpRecordPanelsAdapter` |
| Transport failure | `RequestFailure` (also re-exported by platform auth) |

## Host flow and integration

Install with `npm install` at the repository root. Hosts supply a request callback; every HTTP adapter uses relative paths, preserving the original request bodies, headers, operation IDs and response contracts. No adapter discovers a base URL or adds authentication itself.

```ts
import {createHttpRecordAdapter, createHttpDraftAdapter, RecordEditor} from '@pepbits/data';

export function connectRecords(apiBaseUrl: string, hostFetch: typeof fetch) {
  // The host configures authentication and endpoint routing in hostFetch.
  const request = (path: string, init?: RequestInit) => hostFetch(`${apiBaseUrl}${path}`, init);
  const records = createHttpRecordAdapter(request);
  const drafts = createHttpDraftAdapter(request);
  return {records, drafts};
}

export function openEditor(records: ReturnType<typeof createHttpRecordAdapter>, key: string) {
  const editor = new RecordEditor(records, key, {name: ''});
  const unsubscribe = editor.subscribe(() => renderEditor(editor.snapshot()));
  editor.start();
  return {editor, unsubscribe};
}
declare function renderEditor(state: ReturnType<RecordEditor<{name: string}>['snapshot']>): void;
```

1. Supply the server-authorized record key and initial shape; keep one editor per document. Subscribe to loading/ready/error state. Render through shared components and the host's effective preferences and localization.
2. Recover a compatible saved draft explicitly with `restore()`, or discard it. Partial redacted drafts merge with the saved record/defaults; an incompatible schema cannot restore.
3. `update()` retains local edits and schedules an 800 ms draft save when policy permits. `save()` confirms business persistence; acknowledging a draft never marks the record clean. Edits made during a save remain dirty.
4. A failed request retains its exact operation for `retry()`. A definitive rejection allows correction and a new operation ID. A conflict requires `review()` and an explicit `keepEdits()` before overwriting. Never automatically retry a mutation with a new ID.
5. `close()` waits for an outstanding request, discards the acknowledged draft revision and stops the editor. `stop()` only disposes timers/listeners. The host chooses the appropriate document lifecycle action.

For bearer authentication, pass the result of `createAuthedFetch` from [platform](../platform/README.md) to any adapter. Cookie/BFF hosts can inject their own request function. The server must enforce tenant/user permissions: scope fields and `X-Product-Id` are routing metadata, not authorization.

## Draft policy and volatile transport

`parseDraftPolicy` requires a nonnegative revision, boolean enablement, integer retention of 1–30 days, and at most 100 valid excluded field names/paths. Defaults retain the original seven days. Sensitive field names and prototype keys are excluded recursively, including nested arrays; exclusion names are case-insensitive. HTTP adapters carry policy; the backend must enforce filtering and retention. `draftContext` hashes context with SHA-256, never storing raw context in the draft scope.

```ts
import {createMemoryRecordAdapter, type DraftPolicy} from '@pepbits/data';
export function localRecords(effectivePolicy: () => DraftPolicy) {
  return createMemoryRecordAdapter({draftPolicy: effectivePolicy});
}
```

The memory adapter starts empty, clones inputs/results, and holds one authenticated scope per instance. It checks revisions, replays at most 200 successful operations per key, rejects ID reuse with different commands, and consumes drafts on save/create/discard. `list()` accepts a JSON pair `[applicationId, recordPrefix]` and matches keys shaped as `[applicationId, recordId]`. No application identifier is supplied by the library. Policy changes and expiry are enforced lazily on access to each key, including removal of obsolete draft replay values; business records are not redacted. `now` can be supplied for deterministic tests. No browser storage, durable recovery, background pruning, cross-user sharing, production transaction store or server authorization is provided. Recreate the adapter when the authenticated scope changes.

## Errors, localization and preferences

Existing failure classes remain distinct: record 400/413/422 responses become `RecordRejected` with status 422 and string field errors; 409 becomes `RecordConflict`; other failures retain status/reference. Malformed record/import/panel/approval payloads retain their original errors; malformed draft/center envelopes report 502. No retries are added by an adapter. `RequestFailure` exposes only status/reference and the fixed message `Request failed`; platform recovery supplies the timeout/monitoring behavior. Display mapping stays in `@pepbits/components`; this package does not duplicate it.

These services do not render controls or format values. Hosts apply effective preferences/tenant locks to their views and use canonical catalogs through i18n for labels, recovery keys, API message wrappers and field errors. Draft policies are mandatory tenant rules, separate from personal preferences. No canonical catalog or generated example changed in this copy-only port.

## Differences from the original

- Import generic data exports from `@pepbits/data`; draft policy moves here from shared configuration. The retained HTTP factory signatures, controller behavior, comments and error classes are unchanged. Strict indexed-access annotations erase at runtime.
- `RequestFailure` is extracted unchanged from auth recovery into data; platform re-exports the same class. No general-purpose HTTP client or presentation mapper is added.
- `createMemoryRecordAdapter` and `MemoryRecordOptions` are additive: the original frontend exported no memory transport, only mocked adapters in tests. Its volatile implementation follows the generic version/replay/filter/retention contract, without the backend's filesystem, tenant/user multiplexing or product validation. Its local malformed-command errors are `RecordRejected` with descriptive messages, not an HTTP server response. It is not evidence of backend equivalence or persistence.
- Compatibility literals `DraftScope.kind = 'import' | 'approval' | 'dcp'`, draft-center kinds, and the CSV non-default-limit error key `designer.datasetLimit` remain unchanged. They are wire/catalog values, not a DCP adapter or product rules. Hosts supply the matching catalog entry.
- Product exports, fixtures and the customer import-definition validation case are omitted. No other retained public signatures change.

## Intentionally not included and acceptance

Excluded: `report-data.ts` (hardcoded branch metrics), `mock.ts`/`mock.test.ts` (registry-driven product datasets), `care-pages`, `clinic-billing`, every `clinical-*`, `comprehensive-consultation`, `op-registration`. Product datasets remain for demo/product ownership in phase 6. Phase 4c now adds the generic DCP, label, identity and device contracts/adapters/tests and synthetic v1 fixtures; product maps and the runtime demo wrapper remain excluded. Approval and record-panel transports are generic and are included in full.

Ported source tests: records 11, CSV 4 of 5 (customer-specific schema validation omitted), draft center 2, draft policy 2. Added HTTP-contract and memory-transport cases cover injection, malformed responses, operation identity, scope isolation, retention and controller integration. Run `npm run typecheck -w @pepbits/data` and `npm test -w @pepbits/data`. Full counts and exclusions are in the [phase 3 record](../../docs/releases/unreleased/restructure-phase-3-2026-10-22.md). Tests use synthetic data and mocked/in-memory requests; real backend acceptance and publication remain pending.

## Volatile shared drafts (phase 6a)

`createMemoryDraftAdapter(options?: MemoryRecordOptions): DraftAdapter` adapts the existing memory-record transport to shared draft envelopes. Create one instance per host identity. Scope includes application, page, record and draft kind. Revision checks, operation replay, returned-value isolation, retention, exclusions and disabled-policy acknowledgements come from the existing transport. Its tests cover replay/conflicts, scope and instance isolation, discard, redaction, expiry and disabled policy. This is session memory, never durable drafts or server authorization.

## Phase 4c designer, label and device adapters

New subpaths (also root exports) are `./dcp-designer`, `./dcp-host`, `./dcp-runtime`, `./label-printing`, `./identity-devices`, `./device-integrations` and `./workflow-failure`. They expose `DesignerAdapter`/`createDesignerAdapter`, `DcpHostContract`/`createDcpHostAdapter`, `DcpRuntimeAdapter`/`createDcpRuntimeAdapter`, `LabelAdapter`/`createLabelAdapter`, `IdentityAdapter`/`createIdentityAdapter`, `IntegrationAdapter`/`createIntegrationAdapter`, and `WorkflowRequestFailure`. Serializable configuration, guards, rules, catalog/repeating helpers and lifecycle types are exported with their areas. Patterns reuses these contracts; data never imports patterns or page engines.

Designer, label, identity and integration factories now take `(authenticatedRequest, applicationId, path)` with an explicit host endpoint. The application header remains `X-Product-Id` for wire compatibility. There is no request/session/default URL. Host codecs and runtime record-bound paths keep their source signatures and relative-path validation, 30-second cancellation, v1 header, exact string revisions, 422 filtered validation, reference and conflict handling. Save calls are never automatically retried. The product-only `createDcpRuntimeDemoAdapter` is excluded.

`WorkflowRequestFailure(status, fieldErrors, reference?)` replaces the product-named error class, preserving structured fields/status/reference and using a generic message. Identity wire names become `IdentitySubject`, `subjects`, `subjectId`; the host maps old domain names. Product page maps, subject lists and device/label catalogs stay outside the package. The designer's minimal `TemplateField`, `TemplateSection`, `TemplateValue` structures are independent contracts. The existing DCP v1 contract implementation moves here unchanged and patterns re-exports it; no consumer import change is required.

Hosts enforce permissions, tenant policy, identity/consent, storage, device tickets and trusted artwork. Platform device bridges handle opaque ticket/acknowledgement exchange; HTTP adapters perform no driver or native call. The identity contract retains `authenticated: false` and does not claim authentication. New fixtures are synthetic and tests mock every request. See the [phase 4c evidence](../../docs/releases/unreleased/restructure-phase-4c-2026-10-23.md) for all per-file port decisions and exact local scope.
