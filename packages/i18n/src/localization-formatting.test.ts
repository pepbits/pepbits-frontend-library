import {describe, expect, it} from 'vitest';
import {createFormatters} from './format';
import {FORMAT_OPTIONS} from "./test-options";
import {LANGUAGE_LOCALES, LANGUAGE_OPTIONS, localizeApprovalNotice, createTranslator} from './index';

describe('localized financial and workflow presentation', () => {
  for (const {value: language} of LANGUAGE_OPTIONS) {
    it(`${language}: preserves calendar dates and uses native month/day-period text`, () => {
      const format = createFormatters({...FORMAT_OPTIONS, language, dateFormat:'medium', timeFormat:'12h'});
      const locale = LANGUAGE_LOCALES[language];
      const month = new Intl.DateTimeFormat(locale, {month:'short', timeZone:'UTC'}).format(new Date('2026-09-08T00:00:00Z'));
      const period = new Intl.DateTimeFormat(locale, {hour:'numeric', hour12:true, timeZone:'UTC'}).formatToParts(new Date('2026-09-08T13:05:00Z')).find(part => part.type === 'dayPeriod')!.value;
      expect(format.date('2026-09-08')).toBe(`08 ${month} 2026`);
      expect(format.time('13:05:09', {seconds:true})).toBe(`1:05:09 ${period}`);
      expect(format.dateTime('2026-09-08T13:05:09')).toBe(`08 ${month} 2026 1:05 ${period}`);
    });

    it(`${language}: explicit number preferences win without changing the value`, () => {
      const format = createFormatters({...FORMAT_OPTIONS, language, numberLocale:'en-IN', currencyCode:'INR', currencyDisplay:'code', decimalPlaces:2, negativeStyle:'minus'});
      expect(format.number(1234567.89)).toBe('12,34,567.89');
      expect(format.money(1234567.89)).toBe(new Intl.NumberFormat('en-IN', {style:'currency', currency:'INR', currencyDisplay:'code', minimumFractionDigits:2, maximumFractionDigits:2}).format(1234567.89));
    });

    it(`${language}: translates workflow notices while preserving custom stage names`, () => {
      const t = createTranslator({language, catalogs: {[language]: {'Submitted for {stage}': '[submitted] {stage}', 'Advanced to {stage}': '[advanced] {stage}'}}});
      const stage = 'Finance review A-19';
      expect(localizeApprovalNotice(`Submitted for ${stage}`,t)).toBe(t('Submitted for {stage}',{stage}));
      expect(localizeApprovalNotice(`Advanced to ${stage}`,t)).toContain(stage);
      expect(localizeApprovalNotice('Unknown backend message X-91',t)).toBe('Unknown backend message X-91');
    });
  }

  it('keeps negative percentages negative with accounting notation', () => {
    const format = createFormatters({...FORMAT_OPTIONS, numberLocale:'en-US', decimalPlaces:2, negativeStyle:'parentheses'});
    expect(format.percent(-12.5)).toBe('(12.5%)');
    expect(format.cell({type:'percent'}, -12.5)).toBe('(12.5%)');
    expect(format.percent(12.5)).toBe('12.5%');
  });
});
