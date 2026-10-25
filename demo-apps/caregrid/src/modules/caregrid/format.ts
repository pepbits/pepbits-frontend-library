import {useMemo} from 'react';
import {LANGUAGE_LOCALES, formatShortDate, type LanguageKey} from '@pepbits/i18n';
import {useLocalization} from '@pepbits/i18n/react';
import {formatOptionsFrom} from '@pepbits/preferences';
import {usePreferences} from '@pepbits/preferences/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {DAY, addDays, nowLocal, toMin} from './time';

/** Source date/duration wording rendered through the effective preference formatters (PREF-06). */
export function useCaregridFormat() {
  const format = useFormatters(), {t, language} = useLocalization(), {preferences} = usePreferences();
  return useMemo(() => {
    const options = formatOptionsFrom(preferences);
    const weekday = new Intl.DateTimeFormat(LANGUAGE_LOCALES[language as LanguageKey] ?? 'en-US', {weekday: 'short', timeZone: 'UTC'});
    const wd = (date: string) => weekday.format(new Date(toMin(date.slice(0, 10) + 'T00:00') * 60000));
    const time = (value?: string | null) => value ? format.time(value) : '';
    const niceDate = (value: string, today?: string) => {
      const date = value.slice(0, 10);
      if (today) {
        if (date === today) return t('Today');
        if (date === addDays(today, 1)) return t('Tomorrow');
        if (date === addDays(today, -1)) return t('Yesterday');
      }
      return `${wd(date)} ${formatShortDate(options, date)}`;
    };
    const dur = (minutes: number) => {
      const n = format.number;
      if (minutes < 60) return t('{n} min', {n: n(minutes)});
      if (minutes < DAY) {const h = Math.floor(minutes / 60), m = minutes % 60; return m ? t('{h} h {m} min', {h: n(h), m: n(m)}) : t('{h} h', {h: n(h)});}
      const d = Math.floor(minutes / DAY), h = Math.round((minutes % DAY) / 60);
      return h ? t('{d} d {h} h', {d: n(d), h: n(h)}) : d > 1 ? t('{d} days', {d: n(d)}) : t('{d} day', {d: n(d)});
    };
    const ago = (value: string, now = nowLocal()) => {
      const diff = toMin(now) - toMin(value);
      if (diff < 1) return t('just now');
      if (diff < 60) return t('{n} min ago', {n: format.number(diff)});
      if (diff < DAY) return t('{n} h ago', {n: format.number(Math.floor(diff / 60))});
      return t('{n} d ago', {n: format.number(Math.floor(diff / DAY))});
    };
    return {
      t, wd, time, niceDate, dur, ago, number: format.number, date: format.date,
      niceDateTime: (value: string, today?: string) => `${niceDate(value, today)}, ${time(value)}`,
      percent: (value: number) => format.percent(value),
    };
  }, [format, t, language, preferences]);
}
export type CaregridFormat = ReturnType<typeof useCaregridFormat>;
