import { describe, expect, test, vi } from 'vitest';
import {
  LifecycleContractError, LifecycleRequestError, canonicalLifecycleJson, createLifecycleHttpApi, createLifecycleSourceHttpApi, diffLifecycleDefinitions,
  emptyLifecycleSourceMapping, lifecycleIssueTarget, lifecyclePayloadTargetSuggestion, lifecycleReferences, lifecycleSourceFields,
  lifecycleSourceMappingProblems, lifecycleSourceOperations, lifecycleSourceSlots, lifecycleTableCapture, lifecycleTableSuppliedFields, lifecycleTransformsFor,
  parseLifecycleReleaseDefinition, parseLifecycleSource, parseLifecycleSourceCapabilities, parseLifecycleSourcePage, parseLifecycleVersionDetail,
  renameLifecycleKey, repinLifecycleSourceMapping, sameLifecycleDefinition,
  type LifecycleReleaseDefinition, type LifecycleSourceMapping,
} from './index.ts';
import {
  approvedMapping, purchaseOrderDefinition, purchaseOrderSource, sourceCapabilitiesFixture, sourceSummaryOf, versionDetail,
} from './fixtures.test-support.ts';

const json = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body, headers: { get: () => null } });
const withMappings = (...sourceMappings: LifecycleSourceMapping[]): LifecycleReleaseDefinition => ({ ...purchaseOrderDefinition(), sourceMappings });
const caps = sourceCapabilitiesFixture();
const field = (name: string) => purchaseOrderSource().fields.find(f => f.name === name)!;
const codes = (m: LifecycleSourceMapping, source = purchaseOrderSource(), definition = withMappings(m)) =>
  lifecycleSourceMappingProblems({ definition, mapping: m, source, capabilities: caps }).map(p => `${p.path}:${p.code}`);

describe('source mapping wire compatibility', () => {
  test('mapping-free definitions keep their original wire shape', () => {
    const original = purchaseOrderDefinition(), parsed = parseLifecycleReleaseDefinition(original);
    expect('sourceMappings' in parsed).toBe(false);
    expect(JSON.stringify(parsed)).toBe(JSON.stringify(original));
    const detail = versionDetail();
    expect(canonicalLifecycleJson(parseLifecycleVersionDetail(detail))).toBe(canonicalLifecycleJson(detail));
  });
  test('definitions with source mappings parse, and an empty list equals an absent one for dirty checks', () => {
    const parsed = parseLifecycleReleaseDefinition(withMappings(approvedMapping()));
    expect(parsed.sourceMappings?.[0]).toEqual(approvedMapping());
    expect(sameLifecycleDefinition({ ...purchaseOrderDefinition(), sourceMappings: [] }, purchaseOrderDefinition())).toBe(true);
    expect(sameLifecycleDefinition(withMappings(approvedMapping()), purchaseOrderDefinition())).toBe(false);
  });
  test('reject unknown transforms, capture modes and operations with the JSON path; null MAP values read as empty', () => {
    const bad = withMappings(approvedMapping({ fields: [{ target: 'x', source: 'order_number', transform: 'SCRIPT' as never, values: {} }] }));
    try { parseLifecycleReleaseDefinition(bad); throw new Error('expected rejection'); } catch (e) {
      expect(e).toBeInstanceOf(LifecycleContractError);
      expect((e as LifecycleContractError).path).toBe('$.sourceMappings[0].fields[0].transform');
    }
    expect(() => parseLifecycleReleaseDefinition(withMappings(approvedMapping({ capture: 'SQL' as never })))).toThrow(/capture/);
    expect(() => parseLifecycleSource({ ...purchaseOrderSource(), serviceOperations: ['UPSERTED'] })).toThrow(/serviceOperations\[0\]/);
    const nullValues = withMappings(approvedMapping({ fields: [{ target: 'orderNumber', source: 'order_number', transform: 'COPY', values: null as never }] }));
    expect(parseLifecycleReleaseDefinition(nullValues).sourceMappings?.[0].fields[0].values).toEqual({});
  });
  test('registry records parse strictly and keep additive properties', () => {
    const source = { ...purchaseOrderSource(), future: 1 };
    expect(parseLifecycleSource(source)).toEqual(source);
    expect(parseLifecycleSourcePage({ items: [sourceSummaryOf(purchaseOrderSource())], nextCursor: 'c2' }).nextCursor).toBe('c2');
    expect(parseLifecycleSourceCapabilities(caps).transforms).toContain('PRESENT');
    expect(() => parseLifecycleSource({ ...purchaseOrderSource(), fields: [{ ...field('status'), selectable: 'yes' }] })).toThrow(/fields\[0\]\.selectable/);
  });
});

describe('source registry HTTP adapter', () => {
  test('uses the contract routes under the host base path with cursor paging', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(json(200, caps))
      .mockResolvedValueOnce(json(200, { items: [sourceSummaryOf(purchaseOrderSource())], nextCursor: null }))
      .mockResolvedValueOnce(json(200, purchaseOrderSource()));
    const api = createLifecycleSourceHttpApi({ request, basePath: '/bff/erp/lifecycle/' });
    expect(await api.capabilities()).toEqual({ ...caps, available: true });
    await api.list({ cursor: 'c 1', limit: 10 });
    expect((await api.source('purchase_order')).code).toBe('purchase_order');
    expect(request.mock.calls.map(c => [c[0], c[1].method])).toEqual([
      ['/bff/erp/lifecycle/source-capabilities', 'GET'], ['/bff/erp/lifecycle/sources?cursor=c+1&limit=10', 'GET'], ['/bff/erp/lifecycle/sources/purchase_order', 'GET'],
    ]);
    expect(request.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store' });
    expect(request.mock.calls[0][1].headers['Idempotency-Key']).toBeUndefined();
  });
  test('reports a host without a registry and maps failures', async () => {
    const api = createLifecycleSourceHttpApi({ request: vi.fn()
      .mockResolvedValueOnce(json(200, { available: false, code: 'LIFECYCLE_SOURCES_NOT_ENABLED', message: null }))
      .mockResolvedValueOnce(json(403, { code: 'LIFECYCLE_FORBIDDEN', message: 'no' })) });
    expect(await api.capabilities()).toEqual({ available: false, code: 'LIFECYCLE_SOURCES_NOT_ENABLED', message: null });
    const error = await api.source('purchase_order').catch(e => e);
    expect(error).toBeInstanceOf(LifecycleRequestError);
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
  test('the release adapter is unchanged and saves mappings inside the draft definition', async () => {
    const request = vi.fn().mockResolvedValue(json(200, versionDetail({ definition: withMappings(approvedMapping()) })));
    const api = createLifecycleHttpApi({ request });
    const definition = withMappings(approvedMapping());
    await api.saveDraft({ code: 'purchase-order', version: 1, expectedRevision: 3, definition }, { operationKey: 'lifecycle:k1' });
    const [path, init] = request.mock.calls[0];
    expect(path).toBe('/lifecycle/releases/purchase-order/versions/1');
    expect(JSON.parse(init.body).definition.sourceMappings[0].source).toEqual(approvedMapping().source);
    expect(init.headers['If-Match']).toBe('"3"');
  });
});

describe('source mapping helpers', () => {
  test('never offer denied, non-selectable or uncaptured fields', () => {
    const source = purchaseOrderSource();
    const service = lifecycleSourceFields(source, 'SERVICE', null).map(f => f.name);
    expect(service).not.toContain('tenant_id');
    expect(service).not.toContain('notes_json');
    expect(service).toContain('supplier_email');
    const table = lifecycleSourceFields(source, 'TABLE', lifecycleTableCapture(source, 'UPDATED')).map(f => f.name);
    expect(table).toEqual(['order_number', 'status']);
    expect(lifecycleSourceFields({ ...source, fields: [{ ...field('tenant_id'), selectable: true }] }, 'SERVICE', null)).toEqual([]);
  });
  test('values that may not be disclosed can only be mapped as PRESENT; text transforms follow the type', () => {
    expect(lifecycleTransformsFor(field('supplier_email'), caps)).toEqual(['PRESENT']);
    expect(lifecycleTransformsFor(field('amount'), caps)).toEqual(['PRESENT']);
    expect(lifecycleTransformsFor(field('order_number'), caps)).toEqual(['COPY', 'TRIM', 'LOWERCASE', 'UPPERCASE', 'PRESENT', 'MAP']);
    expect(lifecycleTransformsFor(field('approved_at'), caps)).toEqual(['COPY', 'PRESENT', 'DATE']);
    expect(lifecycleTransformsFor(field('order_number'), { ...caps, transforms: ['COPY'] })).toEqual(['COPY']);
  });
  test('operations and slots come only from the registry and declared stage events', () => {
    const source = purchaseOrderSource();
    expect(lifecycleSourceOperations(source, 'SERVICE', caps)).toEqual(['CREATED', 'UPDATED']);
    expect(lifecycleSourceOperations(source, 'TABLE', caps)).toEqual(['UPDATED']);
    expect(lifecycleSourceOperations(source, 'SERVICE', { ...caps, operations: ['UPDATED'] })).toEqual(['UPDATED']);
    const d = purchaseOrderDefinition();
    expect(lifecycleSourceSlots(d, 'SERVICE', null)).toEqual([{ lifecycle: 'purchase-order', stage: 'ORDER_APPROVAL', event: 'APPROVED' }]);
    // The table capture emits erp.purchase-order.updated, which no declared event carries.
    expect(lifecycleSourceSlots(d, 'TABLE', lifecycleTableCapture(source, 'UPDATED'))).toEqual([]);
    const created = emptyLifecycleSourceMapping(d, source, caps, 'mapping-1');
    expect(created).toMatchObject({ capture: 'SERVICE', operation: 'CREATED', lifecycle: 'purchase-order', stage: 'ORDER_APPROVAL', event: 'APPROVED', fields: [] });
    expect(created.source).toEqual({ application: 'erp', source: 'purchase_order', release: 'erp-src-4', revision: 2, fingerprint: 'f'.repeat(64) });
  });
  test('a valid pinned mapping has no local problems', () => {
    expect(codes(approvedMapping())).toEqual([]);
  });
  test('invalid mappings are reported with contract issue codes and paths', () => {
    expect(codes(approvedMapping({ fields: [{ target: 'supplierEmail', source: 'supplier_email', transform: 'COPY', values: {} }] })))
      .toEqual(['fields[0].transform:SENSITIVE_FIELD']);
    expect(codes(approvedMapping({ fields: [
      { target: 'constructor', source: 'order_number', transform: 'COPY', values: {} },
      { target: '__proto__', source: 'order_number', transform: 'COPY', values: {} },
      { target: 'tenantId', source: 'order_number', transform: 'COPY', values: {} },
      { target: 'status', source: 'tenant_id', transform: 'COPY', values: {} },
      { target: 'notes', source: 'notes_json', transform: 'COPY', values: {} },
      { target: 'code', source: 'status', transform: 'MAP', values: {} },
      { target: 'code', source: 'missing_col', transform: 'COPY', values: { a: 'b' } },
    ] }))).toEqual([
      'fields[0].target:RESERVED_FIELD', 'fields[1].target:INVALID_FORMAT', 'fields[2].target:RESERVED_FIELD',
      'fields[3].source:DENIED_FIELD', 'fields[5].target:DUPLICATE_KEY', 'fields[5].values:INVALID_TRANSFORM',
      'fields[6].target:DUPLICATE_KEY', 'fields[6].values:INVALID_TRANSFORM',
      'fields[3].source:FIELD_NOT_SELECTABLE', 'fields[4].source:FIELD_NOT_SELECTABLE', 'fields[6].source:UNKNOWN_SOURCE_FIELD',
    ]);
    expect(codes(approvedMapping({ fields: [{ target: 'status', source: 'status', transform: 'MAP', values: { approved: ' ' } }] })))
      .toEqual(['fields[0].values:INVALID_TRANSFORM']);
    expect(codes(approvedMapping({ operation: 'CREATED', stage: 'ORDER_DRAFT', fields: [] })))
      .toEqual(['event:EVENT_NOT_MAPPED', 'watch:INVALID_WATCH', 'fields:REQUIRED']);
    expect(codes(approvedMapping({ source: { ...approvedMapping().source, application: 'school' } }))).toContain('source.application:NAMESPACE_MISMATCH');
    expect(codes(approvedMapping({ capture: 'TABLE' }))).toEqual(expect.arrayContaining(['event:TABLE_EVENT_MISMATCH', 'fields[1].source:TABLE_FIELD_MISMATCH']));
    expect(codes(approvedMapping({ operation: 'DELETED', watch: [] }))).toEqual(['operation:CAPTURE_NOT_SUPPORTED']);
  });
  test('a changed registry pin is reported until the mapping is re-pinned', () => {
    const newer = purchaseOrderSource({ provenance: { release: 'erp-src-5', revision: 3, fingerprint: 'e'.repeat(64) } });
    expect(codes(approvedMapping(), newer)).toEqual(['source:SOURCE_VERSION_MISMATCH']);
    const repinned = repinLifecycleSourceMapping(approvedMapping(), newer);
    expect(repinned.source).toMatchObject({ release: 'erp-src-5', revision: 3 });
    expect(codes(repinned, newer)).toEqual([]);
  });
  test('renames, references, diffs and server issue paths include source mappings', () => {
    const d = withMappings(approvedMapping({ applicability: { include: [{ dimension: 'amount', operator: 'RANGE', values: [], min: '1', max: null }], exclude: [] } }));
    const renamed = renameLifecycleKey(renameLifecycleKey(d, 'stages', 'ORDER_APPROVAL', 'MANAGER_APPROVAL'), 'dimensions', 'amount', 'total');
    expect(renamed.sourceMappings?.[0]).toMatchObject({ stage: 'MANAGER_APPROVAL', applicability: { include: [{ dimension: 'total' }] } });
    expect('sourceMappings' in renameLifecycleKey(purchaseOrderDefinition(), 'stages', 'ORDER_APPROVAL', 'X')).toBe(false);
    expect(lifecycleReferences(d, 'events', 'APPROVED')).toEqual(['sourceMappings:po-approved', 'lifecycles:purchase-order']);
    expect(diffLifecycleDefinitions(purchaseOrderDefinition(), d)).toEqual([expect.objectContaining({ section: 'sourceMappings', key: 'po-approved', kind: 'added' })]);
    expect(lifecycleIssueTarget(d, 'sourceMappings[0].fields[1].source')).toEqual({ section: 'sourceMappings', key: 'po-approved' });
  });
  test('TABLE follows the governed trigger: same-name COPY of captured columns only, sensitive ones included (v1.2)', () => {
    const base = purchaseOrderSource();
    const source = purchaseOrderSource({
      tableCaptures: [{ ...base.tableCaptures[0], payloadFields: ['order_number', 'status', 'supplier_email', 'tenant_id'] }],
      fields: base.fields.map(f => (f.name === 'supplier_email' ? { ...f, tableCapturable: true } : f)),
    });
    const table = lifecycleTableCapture(source, 'UPDATED'), email = source.fields.find(f => f.name === 'supplier_email')!;
    expect(lifecycleSourceFields(source, 'TABLE', table, caps).map(f => f.name)).toEqual(['order_number', 'status', 'supplier_email']);
    expect(lifecycleTransformsFor(email, caps, 'TABLE')).toEqual(['COPY']);
    expect(lifecycleTransformsFor(email, caps, 'SERVICE')).toEqual(['PRESENT']);
    expect(lifecycleTableSuppliedFields(table, caps)).toEqual(['tenant_id']);
    const base2 = purchaseOrderDefinition();
    const d: LifecycleReleaseDefinition = { ...base2,
      events: [...base2.events, { key: 'ORDER_ROW_UPDATED', eventType: 'erp.purchase-order.updated', schemaVersion: 1, label: 'Row updated' }],
      lifecycles: [{ ...base2.lifecycles[0], stageEvents: [...base2.lifecycles[0].stageEvents, { stage: 'ORDER_DRAFT', event: 'ORDER_ROW_UPDATED' }] }] };
    expect(lifecycleSourceSlots(d, 'TABLE', table)).toEqual([{ lifecycle: 'purchase-order', stage: 'ORDER_DRAFT', event: 'ORDER_ROW_UPDATED' }]);
    const m = approvedMapping({ capture: 'TABLE', stage: 'ORDER_DRAFT', event: 'ORDER_ROW_UPDATED', watch: [], fields: [
      { target: 'supplier_email', source: 'supplier_email', transform: 'COPY', values: {} },
      { target: 'orderNo', source: 'order_number', transform: 'COPY', values: {} },
      { target: 'status', source: 'status', transform: 'UPPERCASE', values: {} },
    ] });
    expect(lifecycleSourceMappingProblems({ definition: { ...d, sourceMappings: [m] }, mapping: m, source, capabilities: caps }).map(p => `${p.path}:${p.code}`))
      .toEqual(['fields[1].target:TABLE_FIELD_MISMATCH', 'fields[2].transform:TABLE_FIELD_MISMATCH']);
  });
  test('host denied fields (v1.2 capabilities) are honoured; v1.1 capabilities without them still parse', () => {
    const v12 = parseLifecycleSourceCapabilities(JSON.parse('{"captureModes":["SERVICE","TABLE"],"operations":["CREATED","UPDATED","RETIRED","DELETED"],'
      + '"transforms":["COPY","TRIM","LOWERCASE","UPPERCASE","PRESENT","DATE","MAP"],"sensitiveClasses":["RESTRICTED","PII","PHI","FINANCIAL","SECURITY_SENSITIVE"],'
      + '"deniedFields":["tenant_id","status"],"mappingLimit":256,"fieldLimit":128,"mapValueLimit":64}'));
    expect(lifecycleSourceFields(purchaseOrderSource(), 'SERVICE', null, v12).map(f => f.name)).toEqual(['amount', 'approved_at', 'order_number', 'supplier_email']);
    const m = approvedMapping({ fields: [{ target: 'state', source: 'status', transform: 'COPY', values: {} }] });
    expect(lifecycleSourceMappingProblems({ definition: withMappings(m), mapping: m, source: purchaseOrderSource(), capabilities: v12 }).map(p => `${p.path}:${p.code}`))
      .toEqual(['fields[0].source:DENIED_FIELD', 'fields[0].source:FIELD_NOT_SELECTABLE']);
    expect('deniedFields' in parseLifecycleSourceCapabilities(caps)).toBe(false);
  });
  test('suggested payload names are camelCase, unique and never reserved', () => {
    expect(lifecyclePayloadTargetSuggestion('order_number', [])).toBe('orderNumber');
    expect(lifecyclePayloadTargetSuggestion('order_number', ['orderNumber'])).toBe('orderNumber2');
    expect(lifecyclePayloadTargetSuggestion('entity_id', [])).toBe('entityId2');
  });
});
