import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { LifecycleRequestError, type LifecycleApi, type LifecyclePermissions, type LifecycleVersionDetail } from '@pepbits/erp-config/lifecycle';
import { metadataFixture, summaryOf, versionDetail } from '../../../erp-config/src/lifecycle/fixtures.test-support';
import { LifecycleConfigurationPage } from './page';

const all: LifecyclePermissions = { read: true, edit: true, approve: true, publish: true, activate: true, resolve: true };
function fakeApi(detail: LifecycleVersionDetail, overrides: Partial<LifecycleApi> = {}) {
  const api = {
    metadata: vi.fn().mockResolvedValue({ ...metadataFixture(), available: true }),
    list: vi.fn().mockResolvedValue({ items: [summaryOf(detail.version, detail.activation?.version === detail.version.version)], nextCursor: null }),
    detail: vi.fn().mockResolvedValue(detail),
    createDraft: vi.fn(), saveDraft: vi.fn(), approve: vi.fn(), publish: vi.fn(), activation: vi.fn(), activate: vi.fn(),
    validate: vi.fn(), validateVersion: vi.fn(), resolve: vi.fn(),
    ...overrides,
  };
  return api as typeof api & LifecycleApi;
}
async function openFirst(api: LifecycleApi, props: Partial<React.ComponentProps<typeof LifecycleConfigurationPage>> = {}) {
  render(<LifecycleConfigurationPage api={api} scopeKey="tenant-a:erp:user" application={{ code: 'erp', label: 'ERP' }} permissions={all} {...props} />);
  fireEvent.click(await screen.findByRole('button', { name: /Open purchase-order version 1/ }));
  await screen.findByText(/purchase-order · version 1 · revision/);
}
const saveButton = () => screen.getByRole('button', { name: 'Save draft' });

describe('LifecycleConfigurationPage', () => {
  test('shows an explicit not-enabled state instead of an empty list', async () => {
    const api = fakeApi(versionDetail(), { metadata: vi.fn().mockResolvedValue({ available: false, code: 'LIFECYCLE_NOT_ENABLED', message: null }) });
    render(<LifecycleConfigurationPage api={api} scopeKey="s" application={{ code: 'erp', label: 'ERP' }} permissions={all} />);
    expect(await screen.findByText('Lifecycle configuration is not enabled here')).toBeInTheDocument();
    expect(api.list).not.toHaveBeenCalled();
  });

  test('saves a draft with the expected revision and reuses the operation key on retry', async () => {
    const saved = versionDetail({ revision: 4, definition: { ...versionDetail().version.definition, label: 'Purchase orders' } });
    const saveDraft = vi.fn().mockRejectedValueOnce(Object.assign(new TypeError('offline'))).mockResolvedValueOnce(saved);
    const api = fakeApi(versionDetail(), { saveDraft });
    const dirty = vi.fn();
    await openFirst(api, { onDirtyChange: dirty });
    expect(saveButton()).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Purchase orders' } });
    expect(dirty).toHaveBeenLastCalledWith(true);
    expect(saveButton()).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Change reason/), { target: { value: 'സംഭരണത്തിനായി പേര് മാറ്റി' } });
    fireEvent.click(saveButton());
    const retry = await screen.findByRole('button', { name: 'Retry' });
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Purchase orders');
    fireEvent.click(retry);
    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(2));
    const [first, second] = saveDraft.mock.calls;
    expect(first[0]).toMatchObject({ code: 'purchase-order', version: 1, expectedRevision: 3 });
    expect(first[0].definition.label).toBe('Purchase orders');
    expect(second[1].operationKey).toBe(first[1].operationKey);
    expect(first[1].reason).toBe('സംഭരണത്തിനായി പേര് മാറ്റി');
    expect(await screen.findByText('Saved purchase-order version 1.')).toBeInTheDocument();
    expect(dirty).toHaveBeenLastCalledWith(false);
  });

  test('keeps edits and explains a stale-revision conflict', async () => {
    const api = fakeApi(versionDetail(), { saveDraft: vi.fn().mockRejectedValue(new LifecycleRequestError({ status: 409, code: 'LIFECYCLE_CONFLICT' })) });
    await openFirst(api);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Changed' } });
    fireEvent.change(screen.getByLabelText(/^Change reason/), { target: { value: 'Correction' } });
    fireEvent.click(saveButton());
    expect(await screen.findByText(/Someone else changed this record/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Changed');
  });

  test('published versions are read-only and cannot be saved', async () => {
    const api = fakeApi(versionDetail({ status: 'PUBLISHED', approvedChecksum: 'a'.repeat(64) }));
    await openFirst(api);
    expect(screen.getByLabelText(/^Name/)).toBeDisabled();
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText(/Published versions are immutable/)).toBeInTheDocument();
  });

  test('unsaved changes are protected when leaving the definition', async () => {
    const api = fakeApi(versionDetail());
    await openFirst(api);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Back to catalogue' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Discard unsaved changes?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Changed');
  });

  test('approval is explained as independent when the actor edited the version', async () => {
    const api = fakeApi(versionDetail());
    await openFirst(api, { actorId: 'editor-1' });
    fireEvent.click(screen.getByRole('tab', { name: 'Approval and activation' }));
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.getByText(/another person must approve it/)).toBeInTheDocument();
  });

  test('activation requires a reason, confirmation, expected revision and a stable idempotency key', async () => {
    const current = { application: 'erp', code: 'purchase-order', version: 1, checksum: 'c'.repeat(64), revision: 2, reason: 'initial', idempotencyKey: 'k0', activatedBy: 'admin', activatedAt: '2026-09-18T09:00:00Z' };
    const detail = versionDetail({ version: 2, status: 'PUBLISHED', approvedChecksum: 'a'.repeat(64) }, current);
    const activate = vi.fn().mockResolvedValue({ ...current, version: 2, checksum: 'a'.repeat(64), revision: 3, reason: 'go live' });
    const api = fakeApi(detail, { activate, list: vi.fn().mockResolvedValue({ items: [summaryOf(detail.version)], nextCursor: null }) });
    render(<LifecycleConfigurationPage api={api} scopeKey="s" application={{ code: 'erp', label: 'ERP' }} permissions={all} />);
    fireEvent.click(await screen.findByRole('button', { name: /Open purchase-order version 2/ }));
    fireEvent.click(await screen.findByRole('tab', { name: 'Approval and activation' }));
    const button = screen.getByRole('button', { name: 'Activate' });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Activation reason/), { target: { value: 'go live' } });
    fireEvent.click(button);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/replace active version 1/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Activate' }));
    await waitFor(() => expect(activate).toHaveBeenCalled());
    const [body, mutation] = activate.mock.calls[0];
    expect(body).toMatchObject({ code: 'purchase-order', version: 2, expectedRevision: 2, reason: 'go live' });
    expect(body.idempotencyKey).toBe(mutation.operationKey);
    expect(await screen.findByText('Activated purchase-order version 2.')).toBeInTheDocument();
  });

  test('validation shows server issues and navigates to the affected item', async () => {
    const validate = vi.fn().mockResolvedValue({ valid: false, activatable: false, checksum: 'd'.repeat(64),
      issues: [{ severity: 'ERROR', code: 'UNKNOWN_STAGE', path: 'bindings[0].stage', message: 'Stage is not declared' }] });
    const api = fakeApi(versionDetail(), { validate });
    await openFirst(api);
    fireEvent.click(screen.getByRole('tab', { name: 'Validation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Validate editor content' }));
    expect(await screen.findByText('Stage is not declared')).toBeInTheDocument();
    expect(validate).toHaveBeenCalledWith(expect.objectContaining({ code: 'purchase-order' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(await screen.findByLabelText('Binding key')).toHaveValue('approval-form-large');
  });

  test('resolution preview is read-only and shows outcomes with missing context', async () => {
    const resolve = vi.fn().mockResolvedValue({ application: 'erp', code: 'purchase-order', version: 1, checksum: 'a'.repeat(64), activationRevision: 0,
      slots: [{ purpose: 'approval-form', event: null, outcome: 'UNKNOWN', bindingKey: null, target: null, missing: ['amount'],
        candidates: [{ bindingKey: 'approval-form-large', priority: 20, outcome: 'UNKNOWN', reasons: ['include:amount:UNKNOWN'], missing: ['amount'] }] }] });
    const api = fakeApi(versionDetail(), { resolve });
    await openFirst(api);
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview resolution' }));
    await waitFor(() => expect(resolve).toHaveBeenCalled());
    expect(resolve.mock.calls[0][0]).toMatchObject({ code: 'purchase-order', version: 1, lifecycle: 'purchase-order', stage: 'ORDER_DRAFT', event: null,
      context: { subjectType: 'purchase-order', attributes: {} } });
    expect(await screen.findAllByText('Unknown')).not.toHaveLength(0);
    for (const write of [api.saveDraft, api.approve, api.publish, api.activate, api.createDraft]) expect(write).not.toHaveBeenCalled();
  });

  test('visual editor renames a stage key and updates binding references', async () => {
    const api = fakeApi(versionDetail());
    await openFirst(api);
    fireEvent.click(screen.getByRole('tab', { name: /Stages/ }));
    const editor = document.querySelector('[data-lifecycle-editor]') as HTMLElement;
    fireEvent.click(within(editor).getByRole('button', { name: /Order approval/ }));
    const key = screen.getByLabelText('Stage key');
    fireEvent.change(key, { target: { value: 'MANAGER_APPROVAL' } });
    act(() => { fireEvent.keyDown(key, { key: 'Enter' }); });
    fireEvent.click(screen.getByRole('tab', { name: /Bindings/ }));
    fireEvent.click(within(document.querySelector('[data-lifecycle-editor]') as HTMLElement).getByRole('button', { name: /approval-form-large/ }));
    expect(screen.getByLabelText('Stage')).toHaveValue('MANAGER_APPROVAL');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  test('lifecycle module and domain are editable codes that drive catalogue navigation', async () => {
    const saveDraft = vi.fn().mockResolvedValue(versionDetail({ revision: 4 }));
    const api = fakeApi(versionDetail(), { saveDraft });
    await openFirst(api);
    const tree = () => screen.getByRole('navigation', { name: 'Lifecycle catalogue' });
    expect(tree().querySelector('[data-lifecycle-node="module"]')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Lifecycles/ }));
    fireEvent.click(within(document.querySelector('[data-lifecycle-editor]') as HTMLElement).getByRole('button', { name: /purchase-order/ }));
    fireEvent.change(screen.getByLabelText(/^Module/), { target: { value: 'Procurement' } });
    expect(screen.getByLabelText(/^Module/)).toHaveAttribute('aria-invalid', 'true');
    expect(tree().querySelector('[data-lifecycle-node="module"]')).toBeNull();
    fireEvent.change(screen.getByLabelText(/^Module/), { target: { value: 'procurement' } });
    fireEvent.change(screen.getByLabelText(/^Domain/), { target: { value: 'purchasing' } });
    const moduleNode = within(tree()).getByRole('button', { name: /procurement/ });
    expect(moduleNode).toHaveAttribute('data-lifecycle-node', 'module');
    expect(within(tree()).getByRole('button', { name: /purchasing/ })).toHaveAttribute('data-lifecycle-node', 'domain');
    fireEvent.change(screen.getByLabelText(/^Change reason/), { target: { value: 'Classify' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveDraft).toHaveBeenCalled());
    expect(saveDraft.mock.calls[0][0].definition.lifecycles[0]).toMatchObject({ module: 'procurement', domain: 'purchasing' });
  });

  test('approval sends its comment in the body without a change reason', async () => {
    const approve = vi.fn().mockResolvedValue(versionDetail({ status: 'APPROVED', revision: 4, approvedChecksum: 'a'.repeat(64) }));
    const api = fakeApi(versionDetail(), { approve });
    await openFirst(api, { actorId: 'approver-1' });
    fireEvent.click(screen.getByRole('tab', { name: 'Approval and activation' }));
    fireEvent.change(screen.getByLabelText('Comment'), { target: { value: 'Checked' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(approve).toHaveBeenCalled());
    expect(approve.mock.calls[0][0]).toEqual({ code: 'purchase-order', version: 1, expectedRevision: 3, comment: 'Checked' });
    expect(approve.mock.calls[0][1].reason).toBeUndefined();
  });

  test('preview policy limits context to one verified organisation selector and no subject reference', async () => {
    const resolve = vi.fn().mockResolvedValue({ application: 'erp', code: 'purchase-order', version: 1, checksum: 'a'.repeat(64), activationRevision: 0, slots: [] });
    const api = fakeApi(versionDetail(), { resolve });
    await openFirst(api, { previewPolicy: { allowSubjectId: false, organisationMode: 'selector', organisationTypes: [{ value: 'branch', label: 'Branch' }] } });
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    expect(screen.queryByLabelText(/Subject reference/)).toBeNull();
    expect(screen.queryByLabelText(/Organisation path/)).toBeNull();
    fireEvent.change(screen.getByLabelText(/Organisation unit ID/), { target: { value: 'b-12' } });
    fireEvent.change(screen.getByLabelText(/Approval amount/), { target: { value: 'ten' } });
    expect(screen.getByText('Enter decimal numbers separated by commas.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview resolution' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Approval amount/), { target: { value: '12000.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview resolution' }));
    await waitFor(() => expect(resolve).toHaveBeenCalled());
    expect(resolve.mock.calls[0][0].context).toEqual({ subjectType: 'purchase-order', subjectId: null, organisation: [{ type: 'branch', id: 'b-12' }], attributes: { amount: 12000.5 } });
  });

  test('states when the host does not execute bindings and lists its installed capabilities', async () => {
    const api = fakeApi(versionDetail(), { metadata: vi.fn().mockResolvedValue({ ...metadataFixture(), available: true,
      host: { application: 'erp', capabilities: [{ kind: 'FORM', status: 'INSTALLED', mode: 'RESOLVE_ONLY', targets: ['po-approval'], message: null }],
        execution: { triggerExecution: false, eventWorkersEnabled: false, message: 'Preview only' } } }) });
    render(<LifecycleConfigurationPage api={api} scopeKey="s" application={{ code: 'erp', label: 'ERP' }} permissions={all} />);
    expect(await screen.findByText(/does not run lifecycle bindings automatically/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show installed capabilities' }));
    expect(screen.getByText('INSTALLED')).toBeInTheDocument();
    expect(screen.getByText('po-approval')).toBeInTheDocument();
  });

  test('denies the page without read permission', () => {
    const api = fakeApi(versionDetail());
    render(<LifecycleConfigurationPage api={api} scopeKey="s" application={{ code: 'erp', label: 'ERP' }} permissions={{ ...all, read: false }} />);
    expect(screen.getByText('Lifecycle configuration is not available to your account')).toBeInTheDocument();
    expect(api.metadata).not.toHaveBeenCalled();
  });
});
