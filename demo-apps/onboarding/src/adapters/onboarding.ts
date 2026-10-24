/**
 * Orvia onboarding port and its fictional demo adapter.
 *
 * The unchanged demo API has no tenant directory, organization registration or Orvia
 * workspace sign-in endpoints. The source demo kept these behind async seams
 * (`lib/workspaces.ts`, `lib/api.ts`, `LoginFlow` callbacks); they stay behind this port so a
 * real tenant/registration/identity service can replace the adapter without touching screens.
 * The demo API supplies the session, preferences and runtime localization of the host.
 */
import type {RegistrationData, StepId} from '../modules/orvia/registration';
import {facilityType, regionLabel} from '../modules/orvia/catalog';
import {matchesDomain, normalizeSlug, RESERVED_SLUGS, type WorkspaceRecord} from '../modules/orvia/workspaces';
export type {WorkspaceRecord} from '../modules/orvia/workspaces';

export interface RegistrationReceipt {reference: string}
/** Device-local registration draft. The administrator password is never part of it. */
export interface StoredDraft {data?: Partial<RegistrationData>; stepId?: StepId; completed?: StepId[]; reached?: StepId[]; savedAt?: number}
export interface OnboardingPort {
  /** Live address lookup. Resolves null for an unknown workspace. */
  lookupWorkspace(slug: string, signal?: AbortSignal): Promise<WorkspaceRecord | null>;
  lookupByEmail(email: string, signal?: AbortSignal): Promise<WorkspaceRecord[]>;
  /** Synchronous availability check used by registration validation. */
  isSlugTaken(slug: string): boolean;
  sampleWorkspaces(): WorkspaceRecord[];
  recentWorkspaces(): WorkspaceRecord[];
  rememberWorkspace(slug: string): void;
  /** Password step of the workspace sign-in. Rejects with a user-facing message. */
  signIn(slug: string, email: string, password: string): Promise<{method: 'authenticator'}>;
  verifySignInCode(slug: string, code: string): Promise<void>;
  requestPasswordReset(slug: string, email: string): Promise<void>;
  submitRegistration(data: RegistrationData): Promise<RegistrationReceipt>;
  loadDraft(): StoredDraft | null;
  saveDraft(draft: StoredDraft): boolean;
  clearDraft(): void;
}

/** Minimal key/value store. The browser adapter is device-local; tests use memory. */
export interface DeviceStore {get(key: string): string | null; set(key: string, value: string): boolean; remove(key: string): void}
export function memoryStore(initial: Record<string, string> = {}): DeviceStore {
  const values = new Map(Object.entries(initial));
  return {get: key => values.get(key) ?? null, set: (key, value) => {values.set(key, value); return true;}, remove: key => {values.delete(key);}};
}
/** localStorage behind try/catch: blocked or full storage degrades to "not saved", never to a crash. */
export function browserStore(): DeviceStore {
  const storage = () => {try {return typeof window === 'undefined' ? null : window.localStorage;} catch {return null;}};
  return {
    get: key => {try {return storage()?.getItem(key) ?? null;} catch {return null;}},
    set: (key, value) => {try {const target = storage(); if (!target) return false; target.setItem(key, value); return true;} catch {return false;}},
    remove: key => {try {storage()?.removeItem(key);} catch {/* storage blocked */}},
  };
}

/** Fictional tenant directory from the source demo (`lib/workspaces.ts`). */
export const SAMPLE_DIRECTORY: readonly WorkspaceRecord[] = [
  {slug: 'stmarys', name: "St. Mary's Medical Center", kind: 'Hospital network', region: 'United States (Virginia)', facilities: 6, sso: true, status: 'active', domains: ['stmarys.org']},
  {slug: 'alnoor', name: 'Al Noor Healthcare Group', kind: 'Multi-facility network', region: 'United Arab Emirates (Dubai)', facilities: 14, sso: true, status: 'active', domains: ['alnoorhealth.ae']},
  {slug: 'cityrx', name: 'CityRx Pharmacies', kind: 'Pharmacy chain', region: 'United Kingdom (London)', facilities: 22, sso: false, status: 'active', domains: ['cityrx.co.uk']},
  {slug: 'apexdx', name: 'Apex Diagnostics', kind: 'Laboratory and imaging', region: 'India (Mumbai)', facilities: 9, sso: false, status: 'active', domains: ['apexdx.in']},
  {slug: 'demo', name: 'Orvia Demo Hospital', kind: 'Hospital', region: 'European Union (Frankfurt)', facilities: 1, sso: false, status: 'active', domains: ['demo.orvia.health']},
];

export interface DemoOnboardingOptions {
  store: DeviceStore;
  /** Isolation key from the authenticated session (tenant/user); not proof of authority. */
  scope: string;
  /** Simulated latency in milliseconds; tests pass 0. */
  latency?: {lookup: number; email: number; signIn: number; verify: number; reset: number; submit: number};
  now?: () => Date;
  random?: () => number;
}
const SOURCE_LATENCY = {lookup: 450, email: 700, signIn: 900, verify: 800, reset: 800, submit: 1600};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function createDemoOnboarding({store, scope, latency = SOURCE_LATENCY, now = () => new Date(), random = Math.random}: DemoOnboardingOptions): OnboardingPort {
  const key = (name: string) => `pepbits-demo.onboarding.${scope}.${name}`;
  const read = <T,>(name: string, fallback: T): T => {try {const raw = store.get(key(name)); return raw ? JSON.parse(raw) as T : fallback;} catch {return fallback;}};
  const write = (name: string, value: unknown) => store.set(key(name), JSON.stringify(value));
  const wait = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    if (!ms) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError'));}, {once: true});
  });
  const registered = () => {const list = read<unknown>('registered', []); return Array.isArray(list) ? list.filter(isRecord) : [];};
  const all = () => [...registered(), ...SAMPLE_DIRECTORY];
  const find = (slug: string) => {const normalized = normalizeSlug(slug); return all().find(record => record.slug === normalized) ?? null;};
  const isSlugTaken = (slug: string) => RESERVED_SLUGS.has(slug) || all().some(record => record.slug === slug);
  return {
    async lookupWorkspace(slug, signal) {await wait(latency.lookup, signal); return find(slug);},
    async lookupByEmail(email, signal) {await wait(latency.email, signal); return all().filter(record => matchesDomain(record, email));},
    isSlugTaken,
    sampleWorkspaces: () => SAMPLE_DIRECTORY.slice(0, 3),
    recentWorkspaces: () => {const slugs = read<unknown>('recent', []); return (Array.isArray(slugs) ? slugs : []).map(slug => typeof slug === 'string' ? find(slug) : null).filter((record): record is WorkspaceRecord => !!record);},
    rememberWorkspace(slug) {const slugs = read<unknown>('recent', []); write('recent', [slug, ...(Array.isArray(slugs) ? slugs : []).filter(item => item !== slug)].slice(0, 4));},
    async signIn(slug, email, password) {
      // Source behaviour: any fictional address and an 8+ character password reach the code step.
      await wait(latency.signIn);
      if (!find(slug)) throw new Error('This workspace is no longer available.');
      if (!EMAIL_RE.test(email.trim()) || password.length < 8) throw new Error('Check your email and password.');
      return {method: 'authenticator'};
    },
    async verifySignInCode(_slug, code) {await wait(latency.verify); if (!/^\d{6}$/.test(code)) throw new Error('Enter all 6 digits');},
    async requestPasswordReset() {await wait(latency.reset);},
    async submitRegistration(data) {
      await wait(latency.submit);
      const slug = data.workspace.slug;
      if (isSlugTaken(slug)) throw new Error('That address was taken while you were registering. Choose another workspace address.');
      const stored = write('registered', [{slug, name: data.org.displayName || data.org.legalName, kind: data.structure === 'network' ? 'Multi-facility network' : facilityType(data.facilityTypes[0] ?? '')?.label ?? 'Healthcare provider', region: regionLabel(data.workspace.region),
        facilities: data.structure === 'network' ? data.facilities.length : 1, sso: false, status: 'pending', domains: [data.workspace.adminEmail.split('@')[1]?.toLowerCase() ?? '']} satisfies WorkspaceRecord,
      ...registered().filter(record => record.slug !== slug)]);
      if (!stored) throw new Error('This browser could not save the demo workspace. Allow site storage and try again.');
      return {reference: `ORV-${now().getFullYear().toString().slice(2)}-${Math.floor(10000 + random() * 90000)}`};
    },
    loadDraft: () => {const draft = read<unknown>('registration-draft', null); return draft && typeof draft === 'object' ? draft as StoredDraft : null;},
    saveDraft: draft => write('registration-draft', {...draft, data: draft.data && {...draft.data, workspace: draft.data.workspace && {...draft.data.workspace, password: ''}}}),
    clearDraft: () => store.remove(key('registration-draft')),
  };
}
function isRecord(value: unknown): value is WorkspaceRecord {
  const record = value as WorkspaceRecord;
  return !!record && typeof record === 'object' && typeof record.slug === 'string' && typeof record.name === 'string' && Array.isArray(record.domains);
}
