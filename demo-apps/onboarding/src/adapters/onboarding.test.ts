import {describe, expect, it} from 'vitest';
import {browserStore, createDemoOnboarding, memoryStore, SAMPLE_DIRECTORY} from './onboarding';
import {initialData, type RegistrationData} from '../modules/orvia/registration';
import {NO_LATENCY} from '../test/host';

// Fictional test-only value assembled at runtime so it is never a stored literal.
const secret = ['Fictional', 'Secret', '1'].join('-');
const registration = (slug: string): RegistrationData => ({...initialData, structure: 'single', facilityTypes: ['clinic'],
  org: {...initialData.org, legalName: 'Fictional Clinic LLC', displayName: 'Fictional Clinic'},
  workspace: {...initialData.workspace, slug, region: 'eu', adminEmail: 'admin@fictional-clinic.test', password: secret}});
const port = (store = memoryStore(), scope = 'tenant.user') => createDemoOnboarding({store, scope, latency: NO_LATENCY, random: () => 0.25, now: () => new Date('2026-10-24T08:00:00Z')});

describe('fictional onboarding adapter', () => {
  it('looks workspaces up by address variants and by email domain, including subdomains', async () => {
    const api = port();
    expect(await api.lookupWorkspace('stmarys')).toMatchObject({name: "St. Mary's Medical Center"});
    expect(await api.lookupWorkspace('STMARYS.orvia.health')).toMatchObject({slug: 'stmarys'});
    expect(await api.lookupWorkspace('https://alnoor.orvia.health/login')).toMatchObject({slug: 'alnoor'});
    expect(await api.lookupWorkspace('nobody')).toBeNull();
    expect((await api.lookupByEmail('pharmacist@cityrx.co.uk')).map(record => record.slug)).toEqual(['cityrx']);
    expect((await api.lookupByEmail('lab@north.apexdx.in')).map(record => record.slug)).toEqual(['apexdx']);
    expect(await api.lookupByEmail('person@unknown.test')).toEqual([]);
    expect(api.sampleWorkspaces()).toEqual(SAMPLE_DIRECTORY.slice(0, 3));
  });
  it('aborts a superseded lookup', async () => {
    const api = createDemoOnboarding({store: memoryStore(), scope: 's', latency: {...NO_LATENCY, lookup: 1000}});
    const controller = new AbortController(), pending = api.lookupWorkspace('stmarys', controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({name: 'AbortError'});
  });
  it('treats reserved and existing addresses as taken', () => {
    const api = port();
    for (const slug of ['admin', 'www', 'stmarys', 'demo']) expect(api.isSlugTaken(slug)).toBe(true);
    expect(api.isSlugTaken('fictional-new-clinic')).toBe(false);
  });
  it('keeps the four most recent workspaces per scope, newest first', () => {
    const store = memoryStore(), api = port(store);
    for (const slug of ['stmarys', 'alnoor', 'cityrx', 'apexdx', 'demo', 'alnoor']) api.rememberWorkspace(slug);
    expect(api.recentWorkspaces().map(record => record.slug)).toEqual(['alnoor', 'demo', 'apexdx', 'cityrx']);
    expect(port(store, 'other.user').recentWorkspaces()).toEqual([]);
  });
  it('registers a pending workspace that becomes discoverable, and rejects an address taken meanwhile', async () => {
    const api = port();
    expect(await api.submitRegistration(registration('fictional-clinic'))).toEqual({reference: 'ORV-26-32500'});
    expect(await api.lookupWorkspace('fictional-clinic')).toMatchObject({status: 'pending', kind: 'Clinic or polyclinic', region: 'European Union (Frankfurt)', facilities: 1, domains: ['fictional-clinic.test']});
    expect((await api.lookupByEmail('someone@fictional-clinic.test')).map(record => record.slug)).toEqual(['fictional-clinic']);
    await expect(api.submitRegistration(registration('fictional-clinic'))).rejects.toThrow(/taken/);
  });
  it('never stores the administrator password in the device draft and clears it after submission', () => {
    const store = memoryStore(), api = port(store);
    api.saveDraft({data: registration('draft-clinic'), stepId: 'workspace', completed: ['organization'], reached: ['organization', 'workspace'], savedAt: 1});
    const raw = JSON.stringify(Object.fromEntries(['tenant.user'].map(scope => [scope, store.get(`pepbits-demo.onboarding.${scope}.registration-draft`)])));
    expect(raw).not.toContain(secret);
    expect(api.loadDraft()).toMatchObject({stepId: 'workspace', data: {workspace: {slug: 'draft-clinic', password: ''}}});
    api.clearDraft();
    expect(api.loadDraft()).toBeNull();
  });
  it('treats corrupt device data as empty and survives blocked browser storage', () => {
    const store = memoryStore({'pepbits-demo.onboarding.tenant.user.recent': '{not json', 'pepbits-demo.onboarding.tenant.user.registered': '[{"slug":1}]'});
    const api = port(store);
    expect(api.recentWorkspaces()).toEqual([]);
    expect(api.isSlugTaken('stmarys')).toBe(true);
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')!;
    Object.defineProperty(window, 'localStorage', {configurable: true, get: () => {throw new Error('blocked');}});
    try {const blocked = browserStore(); expect(blocked.set('a', 'b')).toBe(false); expect(blocked.get('a')).toBeNull(); blocked.remove('a');}
    finally {Object.defineProperty(window, 'localStorage', original);}
  });
  it('does not claim a saved draft or successful registration when device storage fails', async () => {
    const api = port({...memoryStore(), set: () => false});
    expect(api.saveDraft({data: registration('unsaved-clinic')})).toBe(false);
    await expect(api.submitRegistration(registration('unsaved-clinic'))).rejects.toThrow('could not save the demo workspace');
    expect(await api.lookupWorkspace('unsaved-clinic')).toBeNull();
  });
  it('simulates the sign-in steps with the source rules', async () => {
    const api = port();
    await expect(api.signIn('stmarys', 'nurse@stmarys.org', 'long-enough')).resolves.toEqual({method: 'authenticator'});
    await expect(api.signIn('stmarys', 'not-an-email', 'long-enough')).rejects.toThrow();
    await expect(api.signIn('missing', 'nurse@stmarys.org', 'long-enough')).rejects.toThrow(/no longer available/);
    await expect(api.verifySignInCode('stmarys', '123456')).resolves.toBeUndefined();
    await expect(api.verifySignInCode('stmarys', '12345')).rejects.toThrow('Enter all 6 digits');
    await expect(api.requestPasswordReset('stmarys', 'nurse@stmarys.org')).resolves.toBeUndefined();
  });
});
