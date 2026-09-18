import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import {
  LifecycleRequestError, type LifecycleApi, type LifecyclePermissions, type LifecycleSource, type LifecycleSourceApi, type LifecycleVersionDetail,
} from '@pepbits/erp-config/lifecycle';
import {
  approvedMapping, metadataFixture, purchaseOrderDefinition, purchaseOrderSource, sourceCapabilitiesFixture, sourceSummaryOf, summaryOf, versionDetail,
} from '../../../erp-config/src/lifecycle/fixtures.test-support';
import { LifecycleConfigurationPage } from './page';

const all: LifecyclePermissions = { read: true, edit: true, approve: true, publish: true, activate: true, resolve: true };
function fakeApi(detail: LifecycleVersionDetail, overrides: Partial<LifecycleApi> = {}) {
  const api = {
    metadata: vi.fn().mockResolvedValue({ ...metadataFixture(), available: true }),
    list: vi.fn().mockResolvedValue({ items: [summaryOf(detail.version)], nextCursor: null }),
    detail: vi.fn().mockResolvedValue(detail),
    createDraft: vi.fn(), saveDraft: vi.fn(), approve: vi.fn(), publish: vi.fn(), activation: vi.fn(), activate: vi.fn(),
    validate: vi.fn(), validateVersion: vi.fn(), resolve: vi.fn(),
    ...overrides,
  };
  return api as typeof api & LifecycleApi;
}
function fakeSources(source: LifecycleSource = purchaseOrderSource(), overrides: Partial<LifecycleSourceApi> = {}) {
  const api = {
    capabilities: vi.fn().mockResolvedValue({ ...sourceCapabilitiesFixture(), available: true }),
    list: vi.fn().mockResolvedValue({ items: [sourceSummaryOf(source)], nextCursor: null }),
    source: vi.fn().mockResolvedValue(source),
    ...overrides,
  };
  return api as typeof api & LifecycleSourceApi;
}
async function open(api: LifecycleApi, props: Partial<React.ComponentProps<typeof LifecycleConfigurationPage>> = {}) {
  render(<LifecycleConfigurationPage api={api} scopeKey="tenant-a:erp:user" application={{ code: 'erp', label: 'ERP' }} permissions={all} {...props} />);
  fireEvent.click(await screen.findByRole('button', { name: /Open purchase-order version/ }));
  await screen.findByText(/purchase-order · version 1 · revision/);
}
const editor = () => document.querySelector('[data-lifecycle-editor]') as HTMLElement;
const mappingsTab = () => screen.getByRole('tab', { name: /Source mappings/ });
const optionValues = (select: HTMLElement) => [...(select as HTMLSelectElement).options].map(o => o.value).filter(Boolean);

describe('Lifecycle source mappings', () => {
  test('hosts without a source port keep the page and the saved wire shape unchanged', async () => {
    const saveDraft = vi.fn().mockResolvedValue(versionDetail({ revision: 4 }));
    const api = fakeApi(versionDetail(), { saveDraft });
    await open(api);
    expect(screen.queryByRole('tab', { name: /Source mappings/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show source registry' })).toBeNull();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Purchase orders' } });
    fireEvent.change(screen.getByLabelText(/^Change reason/), { target: { value: 'Rename' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(saveDraft).toHaveBeenCalled());
    expect('sourceMappings' in saveDraft.mock.calls[0][0].definition).toBe(false);
  });

  test('creates a pinned mapping from a registered source and saves it through the governed draft', async () => {
    const saveDraft = vi.fn().mockResolvedValue(versionDetail({ revision: 4 }));
    const api = fakeApi(versionDetail(), { saveDraft }), sources = fakeSources();
    await open(api, { sources });
    fireEvent.click(mappingsTab());
    const source = await within(editor()).findByRole('combobox', { name: /^Source/ });
    expect(optionValues(source)).toEqual(['purchase_order']);
    fireEvent.change(source, { target: { value: 'purchase_order' } });
    await waitFor(() => expect(sources.source).toHaveBeenCalledWith('purchase_order'));
    fireEvent.click(await within(editor()).findByRole('button', { name: 'Add mapping' }));

    const inspector = () => editor().querySelector('[data-lifecycle-source-mapping]') as HTMLElement;
    await waitFor(() => expect(inspector()).not.toBeNull());
    expect(within(inspector()).getByText('Current release')).toBeInTheDocument();
    expect(within(inspector()).getByLabelText(/^Lifecycle stage event/)).toHaveValue('purchase-order/ORDER_APPROVAL/APPROVED');
    const add = within(inspector()).getByLabelText(/^Source field to add/);
    // No forbidden fields: tenant_id (denied) and notes_json (not selectable) are never offered.
    expect(optionValues(add)).toEqual(['amount', 'approved_at', 'order_number', 'status', 'supplier_email']);
    fireEvent.change(add, { target: { value: 'order_number' } });
    fireEvent.click(within(inspector()).getByRole('button', { name: 'Add field' }));
    fireEvent.change(add, { target: { value: 'supplier_email' } });
    fireEvent.click(within(inspector()).getByRole('button', { name: 'Add field' }));
    const transforms = within(inspector()).getAllByLabelText(/^Transform/);
    expect(optionValues(transforms[1])).toEqual(['PRESENT']);
    expect(within(inspector()).getByText('Sensitive value: only its presence can be sent.')).toBeInTheDocument();
    expect(within(inspector()).getByText('data.orderNumber')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Change reason/), { target: { value: 'Capture approvals' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(saveDraft).toHaveBeenCalled());
    const [request, mutation] = saveDraft.mock.calls[0];
    expect(request).toMatchObject({ code: 'purchase-order', version: 1, expectedRevision: 3 });
    expect(mutation.reason).toBe('Capture approvals');
    expect(request.definition.sourceMappings).toEqual([{
      key: 'mapping-1', source: { application: 'erp', source: 'purchase_order', release: 'erp-src-4', revision: 2, fingerprint: 'f'.repeat(64) },
      capture: 'SERVICE', operation: 'CREATED', lifecycle: 'purchase-order', stage: 'ORDER_APPROVAL', event: 'APPROVED', watch: [],
      fields: [{ target: 'orderNumber', source: 'order_number', transform: 'COPY', values: {} }, { target: 'supplierEmail', source: 'supplier_email', transform: 'PRESENT', values: {} }],
      applicability: { include: [], exclude: [] },
    }]);
  });

  test('explains invalid and stale mappings, and re-pins only from the registry', async () => {
    const stale = approvedMapping({ fields: [{ target: 'supplierEmail', source: 'supplier_email', transform: 'COPY', values: {} }] });
    const newer = purchaseOrderSource({ provenance: { release: 'erp-src-5', revision: 3, fingerprint: 'e'.repeat(64) } });
    const api = fakeApi(versionDetail({ definition: { ...purchaseOrderDefinition(), sourceMappings: [stale] } }));
    await open(api, { sources: fakeSources(newer) });
    fireEvent.click(mappingsTab());
    fireEvent.click(within(editor()).getByRole('button', { name: /po-approved/ }));
    expect(await screen.findByText('Newer release pinned')).toBeInTheDocument();
    expect(screen.getAllByText('This sensitive field can only be mapped as Present.').length).toBeGreaterThan(0);
    const target = screen.getByLabelText(/^Payload field/);
    fireEvent.change(target, { target: { value: 'tenantId' } });
    expect(target).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByText('This name is reserved and cannot be a payload field.').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Pin current release' }));
    expect(await screen.findByText('Current release')).toBeInTheDocument();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  test('published mappings are read-only', async () => {
    const api = fakeApi(versionDetail({ status: 'PUBLISHED', approvedChecksum: 'a'.repeat(64), definition: { ...purchaseOrderDefinition(), sourceMappings: [approvedMapping()] } }));
    await open(api, { sources: fakeSources() });
    fireEvent.click(mappingsTab());
    expect(within(editor()).queryByRole('button', { name: 'Add' })).toBeNull();
    fireEvent.click(within(editor()).getByRole('button', { name: /po-approved/ }));
    await screen.findByText('Current release');
    expect(screen.getByLabelText(/^Mapping key/)).toBeDisabled();
    expect(screen.getByLabelText(/^Capture mode/)).toBeDisabled();
    expect(screen.getAllByLabelText(/^Payload field/)[0]).toBeDisabled();
    expect(screen.queryByLabelText(/^Source field to add/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  test('existing mappings stay visible read-only when the host has no source port', async () => {
    const api = fakeApi(versionDetail({ definition: { ...purchaseOrderDefinition(), sourceMappings: [approvedMapping()] } }));
    await open(api);
    fireEvent.click(mappingsTab());
    expect(screen.getByText(/has not connected a source registry/)).toBeInTheDocument();
    fireEvent.click(within(editor()).getByRole('button', { name: /po-approved/ }));
    expect(screen.getByText('Not verified here')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Lifecycle stage event/)).toBeDisabled();
  });

  test('server validation issues on a mapping navigate to it', async () => {
    const validate = vi.fn().mockResolvedValue({ valid: false, activatable: false, checksum: 'd'.repeat(64),
      issues: [{ severity: 'ERROR', code: 'SOURCE_NOT_REGISTERED', path: 'sourceMappings[0].source', message: 'Source is not registered' }] });
    const api = fakeApi(versionDetail({ definition: { ...purchaseOrderDefinition(), sourceMappings: [approvedMapping()] } }), { validate });
    await open(api, { sources: fakeSources() });
    fireEvent.click(screen.getByRole('tab', { name: 'Validation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Validate editor content' }));
    expect(await screen.findByText('Source is not registered')).toBeInTheDocument();
    expect(validate.mock.calls[0][0].sourceMappings).toEqual([approvedMapping()]);
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(await screen.findByLabelText(/^Mapping key/)).toHaveValue('po-approved');
  });

  test('registry panel lists sources and shows metadata-only detail', async () => {
    const sources = fakeSources();
    await open(fakeApi(versionDetail()), { sources });
    fireEvent.click(screen.getByRole('button', { name: 'Show source registry' }));
    const panel = document.querySelector('[data-lifecycle-source-registry]') as HTMLElement;
    fireEvent.click(await within(panel).findByRole('button', { name: 'Open source purchase_order' }));
    const detail = await within(panel).findByRole('table', { name: 'Source fields' });
    expect(within(detail).getByText('supplier_email')).toBeInTheDocument();
    expect(within(panel).getByText('erp.purchase-order.updated v1')).toBeInTheDocument();
    expect(sources.list).toHaveBeenCalledWith({ cursor: null, limit: 25 });
  });

  test.each([
    ['not enabled', { capabilities: vi.fn().mockResolvedValue({ available: false, code: 'LIFECYCLE_SOURCES_NOT_ENABLED', message: null }) }, /not enabled on this host/],
    ['forbidden', { capabilities: vi.fn().mockRejectedValue(new LifecycleRequestError({ status: 403, code: 'LIFECYCLE_FORBIDDEN' })) }, /Source registry access not permitted/],
    ['empty', { list: vi.fn().mockResolvedValue({ items: [], nextCursor: null }) }, /No sources are registered/],
  ] as const)('registry %s state is explicit and offers no invented sources', async (_, overrides, text) => {
    const sources = fakeSources(purchaseOrderSource(), overrides as Partial<LifecycleSourceApi>);
    await open(fakeApi(versionDetail()), { sources });
    fireEvent.click(mappingsTab());
    expect((await within(editor()).findAllByText(text)).length).toBeGreaterThan(0);
    expect(within(editor()).queryByRole('button', { name: 'Add mapping' })?.hasAttribute('disabled') ?? true).toBe(true);
    expect(sources.source).not.toHaveBeenCalled();
  });

  test('a failed registry read keeps editor values and can be retried', async () => {
    const list = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce({ items: [sourceSummaryOf(purchaseOrderSource())], nextCursor: null });
    await open(fakeApi(versionDetail()), { sources: fakeSources(purchaseOrderSource(), { list }) });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Kept' } });
    fireEvent.click(mappingsTab());
    fireEvent.click(await within(editor()).findByRole('button', { name: 'Retry' }));
    expect(await within(editor()).findByRole('combobox', { name: /^Source/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Overview/ }));
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Kept');
  });
});
