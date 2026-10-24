import {describe, expect, it} from 'vitest';
import {recommendedCareSettings, recommendedModules} from './catalog';
import {evaluatePassword} from './password';
import {hydrateDraft, initialData, isFreeEmail, needsCareSettings, pluralize, validateStep, visibleSteps, type RegistrationData} from './registration';
import {initials, normalizeSlug, slugify} from './workspaces';

const ctx = {isSlugTaken: (slug: string) => slug === 'stmarys'};
const strong = ['Clinic', 'Strong', 'Pass', '42'].join('-'), weak = 'short', personal = ['Amira', 'fictional', '42'].join('-');
const complete: RegistrationData = {...initialData, structure: 'single', facilityTypes: ['hospital'],
  org: {...initialData.org, legalName: 'Fictional Hospital LLC', licenseNumber: 'DEMO-1', country: 'AE', city: 'Dubai', address: '1 Demo Street', phone: '04 123 4567', timezone: 'Asia/Dubai', currency: 'AED', beds: '120'},
  careSettings: ['opd'], modules: ['mpi'],
  workspace: {...initialData.workspace, slug: 'fictional-hospital', region: 'me-uae', adminName: 'Amira Haddad', adminRole: 'Medical director', adminEmail: 'amira@fictional-hospital.test', adminPhone: '50 123 4567', password: strong},
  consents: {terms: true, baa: true, dpa: true, updates: false}};

describe('registration rules (source lib/registration.ts)', () => {
  it('shows the facilities step only for networks', () => {
    expect(visibleSteps(complete).map(step => step.id)).toEqual(['organization', 'details', 'scope', 'modules', 'workspace', 'review']);
    expect(visibleSteps({...complete, structure: 'network'})).toHaveLength(7);
  });
  it('accepts a complete single-hospital registration on every step', () => {
    for (const step of visibleSteps(complete)) expect(validateStep(step.id, complete, ctx)).toEqual({});
  });
  it('reports each step’s source rules', () => {
    expect(Object.keys(validateStep('organization', initialData, ctx))).toEqual(['structure', 'facilityTypes']);
    expect(Object.keys(validateStep('details', {...complete, org: {...initialData.org, website: 'not a site'}}, ctx)).sort()).toEqual(['org.address', 'org.beds', 'org.city', 'org.country', 'org.currency', 'org.legalName', 'org.licenseNumber', 'org.phone', 'org.timezone', 'org.website']);
    expect(validateStep('details', {...complete, structure: 'network', org: {...complete.org, beds: ''}}, ctx)).toEqual({});
    expect(validateStep('facilities', {...complete, facilities: [{id: 'a', name: '', type: 'hospital', city: '', beds: ''}]}, ctx)).toMatchObject({facilities: expect.any(String), 'facilities.0.name': 'Enter a name', 'facilities.0.city': 'Enter a city', 'facilities.0.beds': 'Enter beds'});
    expect(validateStep('scope', {...complete, careSettings: []}, ctx)).toEqual({careSettings: 'Select at least one care setting'});
    expect(validateStep('scope', {...complete, facilityTypes: ['pharmacy'], careSettings: []}, ctx)).toEqual({});
    expect(validateStep('modules', {...complete, modules: []}, ctx)).toEqual({modules: 'Select at least one module to start with'});
    expect(validateStep('review', {...complete, consents: initialData.consents}, ctx)).toEqual({'consents.terms': expect.any(String), 'consents.baa': expect.any(String), 'consents.dpa': expect.any(String)});
  });
  it('validates the workspace address, administrator and password', () => {
    const workspace = (patch: Partial<RegistrationData['workspace']>) => validateStep('workspace', {...complete, workspace: {...complete.workspace, ...patch}}, ctx);
    expect(workspace({slug: 'ab'})).toEqual({'workspace.slug': 'Use 3 to 32 lowercase letters, numbers or hyphens'});
    expect(workspace({slug: 'stmarys'})).toEqual({'workspace.slug': 'That address is taken. Try adding your city or a short code'});
    expect(workspace({adminName: 'Amira'})).toHaveProperty('workspace.adminName');
    expect(workspace({adminEmail: 'amira@'})).toHaveProperty('workspace.adminEmail');
    expect(workspace({password: weak})).toEqual({'workspace.password': 'Password needs 12+ characters with upper- and lowercase letters and a number'});
    expect(workspace({password: personal})).toEqual({'workspace.password': "Don't include your name, email or workspace address in the password"});
  });
  it('scores passwords and flags personal content', () => {
    expect(evaluatePassword('').score).toBe(0);
    expect(evaluatePassword(strong)).toMatchObject({acceptable: true, score: 4});
    expect(evaluatePassword('lowercase-only-12')).toMatchObject({acceptable: false});
    expect(evaluatePassword('Stmarys-Secure-12', ['stmarys'])).toMatchObject({containsPersonal: true, score: 1, acceptable: false});
  });
  it('hydrates old drafts without the password and keeps recommendations deterministic', () => {
    const draft = hydrateDraft({structure: 'network', workspace: {...complete.workspace}, facilities: 'bad' as never});
    expect(draft.workspace.password).toBe('');
    expect(draft.facilities).toEqual([]);
    expect(draft.org).toEqual(initialData.org);
    expect(recommendedCareSettings(['pharmacy'])).toEqual(['retail']);
    expect(recommendedModules([], false)).toEqual(['mpi', 'billing']);
    expect(recommendedModules(['laboratory'], true)).toContain('samples');
    expect(needsCareSettings({...complete, facilityTypes: ['laboratory']})).toBe(false);
  });
  it('normalizes addresses and names', () => {
    expect(normalizeSlug(' https://St-Marys.orvia.health/login ')).toBe('st-marys');
    expect(slugify("St. Mary's Médical & Care Center")).toBe('st-marys-medical-and-care-center');
    expect(slugify('x'.repeat(40))).toHaveLength(32);
    expect(initials('Al Noor Healthcare Group')).toBe('AN');
    expect(isFreeEmail('person@gmail.com')).toBe(true);
    expect(pluralize('pharmacy', 2)).toBe('pharmacies');
    expect(pluralize('clinic', 2)).toBe('clinics');
  });
});
