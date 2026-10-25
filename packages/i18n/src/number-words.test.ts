import {expect,test} from 'vitest';
import {englishNumberWords, indianNumberWords} from './number-words';
test.each([[0,'Zero'],[105,'One Hundred Five'],[1234,'One Thousand Two Hundred Thirty Four'],[-20,'Minus Twenty'],[1000000001,'One Billion One']] as const)('spells the integer %s explicitly in English',(value,words) => {expect(englishNumberWords(value)).toBe(words);});
test('rejects fractional, non-finite and unsafe integer values',() => {for(const value of [1.5,Infinity,NaN,Number.MAX_SAFE_INTEGER+1])expect(()=>englishNumberWords(value)).toThrow(RangeError);});
test.each([[0,'Zero'],[999,'Nine Hundred Ninety Nine'],[1000,'One Thousand'],[125000,'One Lakh Twenty Five Thousand'],[12345678,'One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight'],[1000000000,'One Hundred Crore'],[-100000,'Minus One Lakh']] as const)('spells %s in the Indian numbering system',(value,words) => {expect(indianNumberWords(value)).toBe(words);});
test('Indian spelling rejects fractional, non-finite and unsafe integer values',() => {for(const value of [2.5,-Infinity,NaN,Number.MAX_SAFE_INTEGER+1])expect(()=>indianNumberWords(value)).toThrow(RangeError);});
