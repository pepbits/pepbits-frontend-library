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

HTMLCanvasElement.prototype.getContext=(()=>null) as typeof HTMLCanvasElement.prototype.getContext;

// jsdom has no layout observer; actual chart layout is checked by Chromium.
globalThis.ResizeObserver=class {observe(){} unobserve(){} disconnect(){}};

// Deterministic measurements for pagination logic only. Chromium verifies actual
// fonts, wrapping, physical A4 geometry and generated PDFs separately.
const originalRect = HTMLElement.prototype.getBoundingClientRect;
function invoiceHeight(element: HTMLElement) {
  if (element.matches('[data-print-heading]')) return 250;
  if (element.matches('[data-print-footer]')) return 70;
  if (element.matches('[data-print-final]')) return element.querySelector('.invoice-terms') ? 220 : 160;
  if (element.matches('[data-print-brought],[data-print-carried],thead')) return 36;
  if (element.matches('[data-print-line]')) return 36;
  if (element.matches('.erp-invoice')) return 1122;
  return 0;
}
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {configurable:true,get(){return this.closest('.invoice-measure') ? invoiceHeight(this) : 0;}});
HTMLElement.prototype.getBoundingClientRect = function() {
  if (this.closest('.invoice-measure') || this.matches('.invoice-measure')) return {x:0,y:0,top:0,left:0,right:794,bottom:invoiceHeight(this),width:794,height:invoiceHeight(this),toJSON(){return this;}};
  return originalRect.call(this);
};
