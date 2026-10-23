import '@testing-library/jest-dom/vitest';
import {cleanup} from '@testing-library/react';
import {afterEach,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
Object.defineProperty(window,'matchMedia',{value:()=>({matches:false,addEventListener(){},removeEventListener(){}})});
Element.prototype.scrollIntoView=vi.fn();
Element.prototype.scrollTo=vi.fn();
afterEach(()=>{cleanup();localStorage.clear();sessionStorage.clear();vi.restoreAllMocks();});

HTMLCanvasElement.prototype.getContext=(()=>null) as typeof HTMLCanvasElement.prototype.getContext;

Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(){this.setAttribute('open','');}});
Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(){this.removeAttribute('open');}});
Object.defineProperty(globalThis,'ResizeObserver',{configurable:true,value:class {observe(){} unobserve(){} disconnect(){}}});

/* findBy and waitFor give up after 1 s by default; under a parallel workspace
   run on a busy machine that produces false failures. See packages/patterns. */
import { configure as configureTestingLibrary } from "@testing-library/react";
configureTestingLibrary({ asyncUtilTimeout: 5000 });
