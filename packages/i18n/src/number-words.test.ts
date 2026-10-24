import {expect,test} from 'vitest';
import {englishNumberWords} from './number-words';
test.each([[0,'Zero'],[105,'One Hundred Five'],[1234,'One Thousand Two Hundred Thirty Four'],[-20,'Minus Twenty'],[1000000001,'One Billion One']] as const)('spells the integer %s explicitly in English',(value,words) => {expect(englishNumberWords(value)).toBe(words);});
test('rejects fractional, non-finite and unsafe integer values',() => {for(const value of [1.5,Infinity,NaN,Number.MAX_SAFE_INTEGER+1])expect(()=>englishNumberWords(value)).toThrow(RangeError);});
