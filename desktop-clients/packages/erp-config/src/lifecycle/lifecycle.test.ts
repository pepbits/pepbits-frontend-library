import { describe, expect, test, vi } from 'vitest';
import {
  LifecycleContractError, LifecycleRequestError, createLifecycleHttpApi, createLifecycleOperationKeys, diffLifecycleDefinitions,
  emptyLifecycleDefinition, isLifecycleUnavailable, lifecycleActionState, lifecycleCatalogueTree, lifecycleEventTypeValid,
  lifecycleIssueTarget, lifecycleKeyValid, lifecycleReferences, parseLifecycleMetadata, parseLifecycleReleaseDefinition,
  lifecycleReasonHeaderValue, lifecycleReasonTransmittable, parseLifecycleResolveResult, parseLifecycleVersionDetail, parseLifecycleVersionPage, renameLifecycleKey, sameLifecycleDefinition,
  type LifecycleCatalogueNode, type LifecyclePermissions,
} from './index.ts';
import { metadataFixture, purchaseOrderDefinition, releaseVersion, summaryOf, versionDetail } from './fixtures.test-support.ts';

const all: LifecyclePermissions = { read: true, edit: true, approve: true, publish: true, activate: true, resolve: true };
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  ({ ok: status < 300, status, json: async () => body, headers: { get: (n: string) => headers[n.toLowerCase()] ?? null } });

describe('lifecycle contract guards', () => {
  test('accept contract v1 records', () => {
    const detail = versionDetail({}, null);
    expect(parseLifecycleVersionDetail({ ...detail, extra: true })).toEqual({ ...detail, extra: true });
    expect(parseLifecycleVersionPage({ items: [summaryOf(detail.version)], nextCursor: null }).items).toHaveLength(1);
    expect(parseLifecycleMetadata(metadataFixture()).supportedTargetKinds).toEqual(['FORM', 'WORKFLOW']);
  });
  test('carry additive properties through so saves never strip newer server fields', () => {
    const d = { ...purchaseOrderDefinition(), futureField: { x: 1 } } as Record<string, unknown>;
    (d.lifecycles as Record<string, unknown>[])[0].module = 'Procurement';
    const parsed = parseLifecycleReleaseDefinition(d) as unknown as Record<string, unknown>;
    expect(parsed.futureField).toEqual({ x: 1 });
    expect((parsed.lifecycles as Record<string, unknown>[])[0].module).toBe('Procurement');
    expect(() => parseLifecycleReleaseDefinition({ ...purchaseOrderDefinition(), lifecycles: [{ ...purchaseOrderDefinition().lifecycles[0], domain: 4 }] })).toThrow(/domain/);
  });
  test('reject unknown enum values and missing lists with the JSON path', () => {
    const bad = purchaseOrderDefinition() as unknown as { bindings: { target: { kind: string } }[] };
    bad.bindings[0].target.kind = 'SCRIPT';
    expect(() => parseLifecycleReleaseDefinition(bad)).toThrow(LifecycleContractError);
    try { parseLifecycleReleaseDefinition(bad); } catch (e) { expect((e as LifecycleContractError).path).toBe('$.bindings[0].target.kind'); }
    expect(() => parseLifecycleVersionPage({ nextCursor: null })).toThrow(/\$\.items/);
    expect(() => parseLifecycleResolveResult({ application: 'erp', code: 'x', version: 1, checksum: 'c', activationRevision: 0,
      slots: [{ purpose: 'p', event: null, outcome: 'MAYBE', bindingKey: null, target: null, missing: [], candidates: [] }] })).toThrow(/outcome/);
  });
});

describe('lifecycle HTTP adapter', () => {
  test('accepts the host metadata envelope and plain library metadata', async () => {
    const envelope = { available: true, code: null, message: 'ok', application: 'healthcare', schema: { ready: true }, library: metadataFixture(),
      capabilities: [{ kind: 'FORM', status: 'INSTALLED', mode: 'RESOLVE_ONLY', targets: ['registration'], message: 'Forms' },
        { kind: 'WORKFLOW', status: 'UNAVAILABLE', mode: 'NONE', targets: [], message: null }],
      events: { verifier: 'HOST_PRODUCERS', producers: [] }, execution: { triggerExecution: false, eventWorkersEnabled: false, message: 'Preview only' } };
    const request = vi.fn().mockResolvedValueOnce(json(200, envelope)).mockResolvedValueOnce(json(200, metadataFixture()))
      .mockResolvedValueOnce(json(200, { available: false, code: 'LIFECYCLE_SCHEMA_NOT_READY', message: 'x', library: null, capabilities: [] }));
    const api = createLifecycleHttpApi({ request });
    const hosted = await api.metadata();
    if (!hosted.available) throw new Error('expected available');
    expect(hosted.supportedTargetKinds).toEqual(['FORM', 'WORKFLOW']);
    expect(hosted.host?.capabilities.map(c => [c.kind, c.status])).toEqual([['FORM', 'INSTALLED'], ['WORKFLOW', 'UNAVAILABLE']]);
    expect(hosted.host?.execution).toEqual({ triggerExecution: false, eventWorkersEnabled: false, message: 'Preview only' });
    const plain = await api.metadata();
    expect(plain.available && plain.host).toBeNull();
    expect(await api.metadata()).toEqual({ available: false, code: 'LIFECYCLE_SCHEMA_NOT_READY', message: 'x' });
    await expect(createLifecycleHttpApi({ request: vi.fn().mockResolvedValue(json(200, { available: true, library: null })) }).metadata())
      .rejects.toBeInstanceOf(LifecycleContractError);
  });
  test('supports a JSON transport that throws host ApiErrors', async () => {
    class ApiError extends Error { constructor(public status: number, public body: Record<string, unknown>) { super('x'); } }
    const issues = [{ severity: 'ERROR', code: 'UNSUPPORTED_TARGET_KIND', path: 'bindings[0].target.kind', message: 'No verifier' }];
    const send = vi.fn().mockResolvedValueOnce(versionDetail())
      .mockRejectedValueOnce(new ApiError(422, { code: 'LIFECYCLE_UNSUPPORTED_CAPABILITY', message: 'blocked', issues }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const api = createLifecycleHttpApi({ send, basePath: '/lifecycle', reasonHeader: 'X-Change-Reason' });
    await api.createDraft({ definition: purchaseOrderDefinition() }, { operationKey: 'lifecycle:k3', reason: 'New purchase approval' });
    expect(send.mock.calls[0][0]).toBe('/lifecycle/drafts');
    expect(send.mock.calls[0][1].headers).toMatchObject({ 'Idempotency-Key': 'lifecycle:k3', 'X-Change-Reason': 'New purchase approval' });
    const error = await api.activate({ code: 'purchase-order', version: 1, expectedRevision: 0, reason: 'go', idempotencyKey: 'lifecycle:k4' }, { operationKey: 'lifecycle:k4' }).catch(e => e);
    expect(error).toMatchObject({ status: 422, code: 'UNSUPPORTED_CAPABILITY' });
    expect(error.issues).toEqual(issues);
    expect(send.mock.calls[1][1].headers['X-Change-Reason']).toBeUndefined();
    await expect(api.list({ code: null, status: null, cursor: null, limit: 0 })).rejects.toBeInstanceOf(TypeError);
  });
  test('refuses to send a reason the header cannot carry', async () => {
    const request = vi.fn();
    const api = createLifecycleHttpApi({ request, reasonHeader: 'X-Change-Reason' });
    const error = await api.createDraft({ definition: purchaseOrderDefinition() }, { operationKey: 'lifecycle:k5', reason: 'تغيير' }).catch(e => e);
    expect(error).toMatchObject({ status: 400, code: 'REASON_NOT_TRANSMITTABLE' });
    expect(request).not.toHaveBeenCalled();
    expect(lifecycleReasonTransmittable('Café update')).toBe(true);
    expect(lifecycleReasonTransmittable('line\nbreak')).toBe(false);
  });
  test('percent-encodes Unicode reasons as ASCII UTF-8 with decoded bounds', async () => {
    const request = vi.fn().mockResolvedValue(json(200, versionDetail()));
    const api = createLifecycleHttpApi({ request, reasonHeader: 'X-Change-Reason', reasonEncoding: 'percent-utf8' });
    for (const reason of ['تغيير الموافقة', 'स्वीकृति बदलें', 'അംഗീകാരം മാറ്റുക', 'Café 100% + ok 😀']) {
      await api.createDraft({ definition: purchaseOrderDefinition() }, { operationKey: 'lifecycle:k6', reason: `  ${reason} ` });
      const value = request.mock.lastCall![1].headers['X-Change-Reason'] as string;
      expect(value.startsWith("UTF-8''")).toBe(true);
      expect(/^[\x21-\x7e]+$/.test(value)).toBe(true);
      expect(decodeURIComponent(value.slice(7))).toBe(reason);
    }
    // Java URLDecoder reads '+' as a space, so a literal plus must be escaped.
    expect(lifecycleReasonHeaderValue('a+b', 'percent-utf8')).toEqual({ ok: true, value: "UTF-8''a%2Bb" });
    expect(lifecycleReasonHeaderValue('ക'.repeat(500), 'percent-utf8')).toEqual({ ok: true, value: "UTF-8''" + '%E0%B4%95'.repeat(500) });
    expect(lifecycleReasonHeaderValue('ക'.repeat(501), 'percent-utf8')).toEqual({ ok: false, code: 'REASON_TOO_LONG' });
    expect(lifecycleReasonHeaderValue('a'.repeat(1001), 'percent-utf8')).toEqual({ ok: false, code: 'REASON_TOO_LONG' });
    expect(lifecycleReasonHeaderValue('a'.repeat(1000), 'percent-utf8').ok).toBe(true);
    for (const bad of ['line\nbreak', 'tab\there', 'c1', 'del', 'lone\ud800'])
      expect(lifecycleReasonHeaderValue(bad, 'percent-utf8')).toEqual({ ok: false, code: 'REASON_INVALID_CHARACTERS' });
    const calls = request.mock.calls.length;
    const error = await api.saveDraft({ code: 'purchase-order', version: 1, expectedRevision: 1, definition: purchaseOrderDefinition() },
      { operationKey: 'lifecycle:k7', reason: 'ക'.repeat(501) }).catch(e => e);
    expect(error).toMatchObject({ status: 400, code: 'REASON_TOO_LONG' });
    expect(request.mock.calls.length).toBe(calls);
    // Default stays raw for generic hosts.
    expect(lifecycleReasonHeaderValue('Café')).toEqual({ ok: true, value: 'Café' });
    expect(lifecycleReasonHeaderValue('ക')).toEqual({ ok: false, code: 'REASON_NOT_TRANSMITTABLE' });
  });
  test('uses contract routes, idempotency keys and expected revisions', async () => {
    const request = vi.fn().mockResolvedValue(json(200, versionDetail()));
    const api = createLifecycleHttpApi({ request, basePath: '/bff/erp/lifecycle/' });
    await api.saveDraft({ code: 'purchase-order', version: 1, expectedRevision: 3, definition: purchaseOrderDefinition() }, { operationKey: 'lifecycle:k1' });
    const [path, init] = request.mock.calls[0];
    expect(path).toBe('/bff/erp/lifecycle/releases/purchase-order/versions/1');
    expect(init.method).toBe('PUT');
    expect(init.headers).toMatchObject({ 'Idempotency-Key': 'lifecycle:k1', 'If-Match': '"3"', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body).expectedRevision).toBe(3);
    request.mockResolvedValue(json(200, { items: [], nextCursor: null }));
    await api.list({ code: 'purchase-order', status: 'PUBLISHED', cursor: 'c1', limit: 25 });
    expect(request.mock.calls[1][0]).toBe('/bff/erp/lifecycle/releases?code=purchase-order&status=PUBLISHED&cursor=c1&limit=25');
    expect(api.resolveEvent).toBeUndefined();
  });
  test('maps library error codes, issues and references', async () => {
    const issues = [{ severity: 'ERROR', code: 'UNKNOWN_STAGE', path: 'bindings[0].stage', message: 'Unknown stage' }];
    const api = createLifecycleHttpApi({ request: vi.fn().mockResolvedValue(json(422, { code: 'LIFECYCLE_INVALID_DEFINITION', message: 'x', issues }, { 'x-correlation-id': 'abc-123' })) });
    const error = await api.validate(purchaseOrderDefinition()).catch(e => e);
    expect(error).toBeInstanceOf(LifecycleRequestError);
    expect(error).toMatchObject({ status: 422, code: 'INVALID_DEFINITION', reference: 'abc-123' });
    expect(error.issues).toEqual(issues);
  });
  test('treats NOT_ACTIVE as no activation and reports explicit host unavailability', async () => {
    const request = vi.fn().mockResolvedValueOnce(json(404, { code: 'LIFECYCLE_NOT_ACTIVE' }))
      .mockResolvedValueOnce(json(200, { available: false, code: 'LIFECYCLE_NOT_ENABLED', message: 'off' }))
      .mockResolvedValueOnce(json(503, { code: 'LIFECYCLE_SCHEMA_NOT_READY' }));
    const api = createLifecycleHttpApi({ request });
    expect(await api.activation('purchase-order')).toBeNull();
    expect(await api.metadata()).toEqual({ available: false, code: 'LIFECYCLE_NOT_ENABLED', message: 'off' });
    const error = await api.list({ code: null, status: null, cursor: null, limit: 0 }).catch(e => e);
    expect(isLifecycleUnavailable(error)).toBe(true);
    expect(error.code).toBe('LIFECYCLE_SCHEMA_NOT_READY');
  });
  test('rejects responses that do not match the contract', async () => {
    const api = createLifecycleHttpApi({ request: vi.fn().mockResolvedValue(json(200, { version: { status: 'LIVE' }, activation: null })) });
    await expect(api.detail('purchase-order', 1)).rejects.toBeInstanceOf(LifecycleContractError);
  });
  test('sends the mutation reason only through a host-named header', async () => {
    const request = vi.fn().mockResolvedValue(json(200, versionDetail({ status: 'APPROVED' })));
    await createLifecycleHttpApi({ request, reasonHeader: 'X-Change-Reason' })
      .approve({ code: 'purchase-order', version: 1, expectedRevision: 3, comment: 'ok' }, { operationKey: 'lifecycle:k2', reason: 'ok' });
    expect(request.mock.calls[0][1].headers['X-Change-Reason']).toBe('ok');
    expect(request.mock.calls[0][0]).toBe('/lifecycle/releases/purchase-order/versions/1/approve');
  });
});

describe('lifecycle model', () => {
  test('operation keys are stable per payload and fresh after a change or completion', () => {
    let n = 0; const keys = createLifecycleOperationKeys(() => `id-${++n}`);
    const a = keys.key('save', { b: 1, a: [1, 2] });
    expect(keys.key('save', { a: [1, 2], b: 1 })).toBe(a);
    expect(keys.key('save', { a: [2, 1], b: 1 })).not.toBe(a);
    keys.complete('save');
    expect(keys.key('save', { a: [2, 1], b: 1 })).toBe('lifecycle:id-3');
    expect(/^[A-Za-z0-9:_.-]{1,70}$/.test(`lifecycle:${crypto.randomUUID()}`)).toBe(true);
  });
  test('governance gating follows contract rules', () => {
    const draft = releaseVersion();
    expect(lifecycleActionState('approve', { version: draft, permissions: all, dirty: false, actorId: 'editor-1' }))
      .toEqual({ allowed: false, reason: 'lifecycle.reason.independent' });
    expect(lifecycleActionState('approve', { version: draft, permissions: all, dirty: false, actorId: 'approver-1' }).allowed).toBe(true);
    expect(lifecycleActionState('approve', { version: draft, permissions: all, dirty: true }).reason).toBe('lifecycle.reason.saveFirst');
    const approved = releaseVersion({ status: 'APPROVED', approvedChecksum: 'b'.repeat(64) });
    expect(lifecycleActionState('publish', { version: approved, permissions: all, dirty: false }).reason).toBe('lifecycle.reason.checksumChanged');
    const published = releaseVersion({ status: 'PUBLISHED', approvedChecksum: 'a'.repeat(64) });
    expect(lifecycleActionState('save', { version: published, permissions: all, dirty: true }).reason).toBe('lifecycle.reason.immutable');
    expect(lifecycleActionState('activate', { version: published, permissions: { ...all, activate: false }, dirty: false }).allowed).toBe(false);
    expect(lifecycleActionState('activate', { version: published, permissions: all, dirty: false,
      activation: { application: 'erp', code: 'purchase-order', version: 1, checksum: 'a'.repeat(64), revision: 1, reason: 'r', idempotencyKey: 'k', activatedBy: 'u', activatedAt: 'now' } }).reason)
      .toBe('lifecycle.reason.alreadyActive');
  });
  test('renaming cascades to every reference and removal lists blocking references', () => {
    const d = purchaseOrderDefinition();
    const renamed = renameLifecycleKey(d, 'stages', 'ORDER_APPROVAL', 'MANAGER_APPROVAL');
    expect(renamed.lifecycles[0].stages).toContain('MANAGER_APPROVAL');
    expect(renamed.lifecycles[0].stageEvents[0].stage).toBe('MANAGER_APPROVAL');
    expect(renamed.bindings[0].stage).toBe('MANAGER_APPROVAL');
    expect(d.bindings[0].stage).toBe('ORDER_APPROVAL');
    expect(renameLifecycleKey(d, 'dimensions', 'amount', 'total').bindings[0].applicability.include[0].dimension).toBe('total');
    expect(lifecycleReferences(d, 'stages', 'ORDER_APPROVAL')).toEqual(['bindings:approval-form-large', 'lifecycles:purchase-order']);
    expect(lifecycleReferences(d, 'events', 'APPROVED')).toEqual(['lifecycles:purchase-order']);
  });
  test('structural diff reports by stable key', () => {
    const before = purchaseOrderDefinition(), after = structuredClone(before);
    after.label = 'Purchase orders';
    after.bindings[0].priority = 30;
    after.events.push({ key: 'REJECTED', eventType: 'erp.purchase-order.rejected', schemaVersion: 1, label: 'Rejected' });
    const diff = diffLifecycleDefinitions(before, after);
    expect(diff.map(d => [d.section, d.key, d.kind])).toEqual([
      ['definition', 'definition', 'changed'], ['events', 'REJECTED', 'added'], ['bindings', 'approval-form-large', 'changed']]);
    expect(diff[2].fields).toEqual(['priority']);
    expect(diffLifecycleDefinitions(before, structuredClone(before))).toEqual([]);
    expect(sameLifecycleDefinition(before, structuredClone(before))).toBe(true);
  });
  test('catalogue tree projects Application/Module/Domain/Definition/Lifecycle/Stage/Event', () => {
    const draft = releaseVersion(), published = releaseVersion({ version: 2, status: 'PUBLISHED' });
    const other = { ...summaryOf(releaseVersion({ code: 'supplier', definition: { ...purchaseOrderDefinition(), code: 'supplier', label: 'Supplier' } })) };
    const tree = lifecycleCatalogueTree({
      application: { code: 'erp', label: 'ERP' }, summaries: [summaryOf(draft), summaryOf(published), other],
      classify: s => (s.code === 'purchase-order' ? { module: { code: 'procurement', label: 'Procurement' }, domain: { code: 'purchasing', label: 'Purchasing' } } : null),
      open: purchaseOrderDefinition(),
    });
    expect(tree.children.map(m => [m.kind, m.label])).toEqual([['module', 'Procurement'], ['definition', 'Supplier']]);
    const definition = tree.children[0].children[0].children[0];
    expect(definition.summary?.version).toBe(2);
    // No lifecycle taxonomy supplied: lifecycles sit directly under the definition, nothing invented.
    const lifecycle = definition.children[0], stage = lifecycle.children[1];
    expect([lifecycle.kind, stage.kind, stage.code, stage.children[0].kind, stage.children[0].code]).toEqual(['lifecycle', 'stage', 'ORDER_APPROVAL', 'event', 'APPROVED']);
    expect(tree.children[1].children).toEqual([]);
  });
  test('catalogue tree groups the loaded definition by its lifecycles\' module and domain', () => {
    const base = purchaseOrderDefinition(), graph = base.lifecycles[0];
    const open = { ...base, lifecycles: [
      { ...graph, key: 'purchase-order', module: 'procurement', domain: 'purchasing' },
      { ...graph, key: 'supplier-onboarding', label: 'Supplier onboarding', module: 'procurement', domain: 'supplier-management' },
      { ...graph, key: 'po-return', label: 'Return', module: 'procurement', domain: 'purchasing' },
      { ...graph, key: 'unfiled', label: 'Unfiled', module: null, domain: null },
      { ...graph, key: 'domain-only', label: 'Domain only', domain: 'audit' },
    ] };
    const summaries = [summaryOf(releaseVersion()), summaryOf(releaseVersion({ code: 'supplier' }))];
    const tree = lifecycleCatalogueTree({ application: { code: 'erp', label: 'ERP' }, summaries, open });
    const shape = (n: LifecycleCatalogueNode): unknown => n.kind === 'lifecycle' ? n.code : { [`${n.kind}:${n.code}`]: n.children.map(shape) };
    expect(shape(tree.children[0])).toEqual({ 'definition:purchase-order': [
      { 'module:procurement': [{ 'domain:purchasing': ['purchase-order', 'po-return'] }, { 'domain:supplier-management': ['supplier-onboarding'] }] },
      'unfiled', { 'domain:audit': ['domain-only'] },
    ] });
    const module = tree.children[0].children[0];
    expect([module.label, module.definition, module.children[1].definition]).toEqual(['procurement', 'purchase-order', 'purchase-order']);
    expect(new Set(JSON.stringify(tree).match(/"id":"[^"]+"/g)).size).toBe(JSON.stringify(tree).match(/"id":"[^"]+"/g)!.length);
    // Only the open definition is expanded; other summaries are never fetched or classified.
    expect(tree.children[1]).toMatchObject({ kind: 'definition', code: 'supplier', children: [] });
  });
  test('key, event type and issue path helpers', () => {
    expect(lifecycleKeyValid('code', 'purchase-order')).toBe(true);
    expect(lifecycleKeyValid('code', 'Purchase')).toBe(false);
    expect(lifecycleKeyValid('key', 'ORDER_APPROVAL')).toBe(true);
    expect(lifecycleEventTypeValid('erp', 'erp.purchase-order.approved')).toBe(true);
    expect(lifecycleEventTypeValid('erp', 'healthcare.patient.created')).toBe(false);
    expect(lifecycleIssueTarget(purchaseOrderDefinition(), 'bindings[0].target.code')).toEqual({ section: 'bindings', key: 'approval-form-large' });
    expect(lifecycleIssueTarget(purchaseOrderDefinition(), 'label')).toEqual({ section: 'overview', key: null });
    expect(emptyLifecycleDefinition('school', 'admission', 'Admission')).toMatchObject({ application: 'school', stages: [], bindings: [] });
  });
});
