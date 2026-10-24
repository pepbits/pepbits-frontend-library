import React, {type ReactNode} from 'react';
import {readFileSync} from 'node:fs';
import {createTranslator, directionOf, type LanguageKey} from '@pepbits/i18n';
import {LocalizationProvider} from '@pepbits/i18n/react';

/** Canonical demo API catalogs (read-only). Tests use the same messages the running app loads from /localization. */
export const catalog = (language: string) => JSON.parse(readFileSync(process.cwd() + `/../../dummy-api/config/localization/shared/${language}.json`, 'utf8')).messages as Record<string, string>;
export const sharedMessages = catalog('en');
export function LocaleWrapper({children, language = 'en'}: {children: ReactNode; language?: LanguageKey}) {
  const t = createTranslator({language, catalogs: {en: sharedMessages, [language]: catalog(language)}});
  return <LocalizationProvider value={{t, language, direction: directionOf(language), dateTime: String}}>{children}</LocalizationProvider>;
}
