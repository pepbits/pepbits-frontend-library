import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export type StoreResult = {status: number; headers?: Record<string, string>; body: unknown};
export interface ReportsStore {handle(user: unknown, scope: unknown, request: {method: string; path: string; body?: unknown; headers?: Record<string, string>}): StoreResult}
// Test-only: the unchanged plain-ESM demo store is loaded from the repository's demo API (like the canonical
// catalogs read in ./locale), never bundled into the app. Run tests from this workspace (npm test -w).
const location = pathToFileURL(resolve(process.cwd(), '../../dummy-api/reference-reports-store.mjs')).href;
const {createReferenceReportsStore} = await import(/* @vite-ignore */ location) as {createReferenceReportsStore: (options: {jobStepMs: number}) => ReportsStore};
/** The fictional in-memory Lumen Reports store the demo API serves, created per test (no network, no shared state). */
export function createStore(): ReportsStore {return createReferenceReportsStore({jobStepMs: 0});}
