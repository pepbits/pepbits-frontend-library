import '@testing-library/jest-dom/vitest';
import {cleanup, configure} from '@testing-library/react';
import {afterEach, vi} from 'vitest';
import {webcrypto} from 'node:crypto';
// Generous async timeouts: several demo suites share a loaded machine.
configure({asyncUtilTimeout: 20000});
Object.defineProperty(globalThis, 'crypto', {value: webcrypto, configurable: true});
Object.defineProperty(window, 'matchMedia', {value: () => ({matches: false, addEventListener() {}, removeEventListener() {}})});
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.scrollTo = vi.fn();
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
// jsdom has no layout observer; real layout is checked in Chromium.
globalThis.ResizeObserver = class {observe() {} unobserve() {} disconnect() {}};
afterEach(() => {cleanup(); localStorage.clear(); sessionStorage.clear(); window.history.replaceState(null, '', '/'); vi.clearAllMocks();});
