import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {expect, test, vi} from 'vitest';
import {EMPTY_PREFERENCE_POLICY, type PreferencePolicy} from '@pepbits/preferences';
import {TestHost} from '../test/render';
import {LifecycleConfigurationPage} from './page';
import {metadataFixture, summaryOf, versionDetail, sourceCapabilitiesFixture} from './config/fixtures.test-support';
import type {LifecycleApi, LifecyclePermissions} from './config';

const permissions: LifecyclePermissions = {read: true, edit: true, approve: true, publish: true, activate: true, resolve: true};
function api(): LifecycleApi {
  return {metadata: vi.fn().mockResolvedValue({...metadataFixture(), available: true}),
    list: vi.fn().mockResolvedValue({items: [summaryOf(versionDetail().version)], nextCursor: null}), detail: vi.fn().mockResolvedValue(versionDetail()),
    createDraft: vi.fn(), saveDraft: vi.fn().mockResolvedValue(versionDetail({revision: 4})), approve: vi.fn(), publish: vi.fn(),
    activation: vi.fn(), activate: vi.fn(), validate: vi.fn(), validateVersion: vi.fn(), resolve: vi.fn()};
}
test('live policy overrides explicit list sizes and updates managed presentation', async () => {
  const service = api(), sources = {capabilities: vi.fn().mockResolvedValue({...sourceCapabilitiesFixture(), available: true}),
    list: vi.fn().mockResolvedValue({items: [], nextCursor: null}), source: vi.fn()};
  const page = <LifecycleConfigurationPage api={service} sources={sources} scopeKey="scope" application={{code: 'application', label: 'Application'}}
    permissions={permissions} pageSize={50} sourcePageSize={50}/>;
  const host = (policy: PreferencePolicy) => <TestHost preferences={{density: 'comfortable', pageSize: 20}} preferencePolicy={policy}>{page}</TestHost>;
  const {rerender} = render(host(EMPTY_PREFERENCE_POLICY));
  await waitFor(() => expect(service.list).toHaveBeenCalledWith(expect.objectContaining({limit: 50})));
  rerender(host({...EMPTY_PREFERENCE_POLICY, rules: {pageSize: {locked: true, value: 10}, density: {locked: true, value: 'compact'}}}));
  await waitFor(() => expect(document.querySelector('[data-lifecycle-page]')).toHaveAttribute('data-density', 'compact'));
  fireEvent.click(screen.getByRole('button', {name: 'Search'}));
  await waitFor(() => expect(service.list).toHaveBeenLastCalledWith(expect.objectContaining({limit: 10})));
  fireEvent.click(screen.getByRole('button', {name: 'Show source registry'}));
  await waitFor(() => expect(sources.list).toHaveBeenLastCalledWith({cursor: null, limit: 10}));
});

test('lifecycle forwards dirty changes and localized notifications to the screen host', async () => {
  const service = api(), reportDirty = vi.fn(), notify = vi.fn();
  render(<TestHost screenHost={{notify, document: {reportDirty}}}><LifecycleConfigurationPage api={service} scopeKey="scope"
    application={{code: 'application', label: 'Application'}} permissions={permissions}/></TestHost>);
  fireEvent.click(await screen.findByRole('button', {name: /Open sample-record version 1/}));
  fireEvent.change(await screen.findByLabelText(/^Name/), {target: {value: 'Changed'}});
  expect(reportDirty).toHaveBeenLastCalledWith(true);
  fireEvent.change(screen.getByLabelText(/^Change reason/), {target: {value: 'Reviewed'}});
  fireEvent.click(screen.getByRole('button', {name: 'Save draft'}));
  await waitFor(() => expect(notify).toHaveBeenCalledWith('Saved sample-record version 1.', {tone: 'success'}));
  expect(reportDirty).toHaveBeenLastCalledWith(false);
});
