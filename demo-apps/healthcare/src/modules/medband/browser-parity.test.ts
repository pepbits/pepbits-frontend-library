import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
/** Real Chromium checks are run by the integration launcher, with services stopped in finally.
 * Set MEDBAND_BROWSER_PARITY_RESULT to its receipt to verify both original browser acceptance contracts.
 * Engine composition intentionally adopts effective host presentation rather than frozen default pixel geometry.
 */
const receipt=process.env.MEDBAND_BROWSER_PARITY_RESULT;
describe.skipIf(!receipt)('MEDBAND real-browser pages, interaction states and effective presentation',()=>{
 const checks=receipt?JSON.parse(readFileSync(receipt,'utf8')).medbandPresentation:[];
 it('ran page, state, interaction and preference checks',()=>expect(checks.length).toBeGreaterThan(20));
 it('every check passes',()=>expect(checks.filter((c:{failures:string[]})=>c.failures.length)).toEqual([]));
});
