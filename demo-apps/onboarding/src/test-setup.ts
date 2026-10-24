import '@testing-library/jest-dom/vitest';
import {cleanup,configure} from '@testing-library/react';
import {afterEach,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
configure({asyncUtilTimeout:10000});
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
Object.defineProperty(window,'matchMedia',{value:()=>({matches:false,addEventListener(){},removeEventListener(){}})});
Element.prototype.scrollIntoView=vi.fn();
Element.prototype.scrollTo=vi.fn();
afterEach(()=>{cleanup();localStorage.clear();sessionStorage.clear();vi.clearAllMocks();});



// axe probes icon ligatures with canvas; jsdom has none. Real Chromium axe runs separately.
HTMLCanvasElement.prototype.getContext=(()=>null) as typeof HTMLCanvasElement.prototype.getContext;
