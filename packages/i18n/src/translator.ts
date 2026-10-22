import {CORE_CATALOG, LANGUAGE_LOCALES} from "./core";
import type {LanguageKey, TranslationCatalog, Translator} from "./types";

export interface TranslatorOptions {
  language: LanguageKey;
  catalogs?: TranslationCatalog;
  overrides?: TranslationCatalog;
}

/** Locale overrides → host catalog → core, then the same sequence in English.
 * Read catalogs at call time so a completed lazy load is visible to this translator. */
export function createTranslator({language, catalogs, overrides}: TranslatorOptions): Translator {
  const locale = Object.hasOwn(LANGUAGE_LOCALES, language) ? language : "en";
  return (key, values = {}) => {
    const own = (catalog: Record<string, string> | undefined) =>
      catalog && Object.hasOwn(catalog, key) && typeof catalog[key] === "string" ? catalog[key] : undefined;
    const message = own(overrides?.[locale]) ?? own(catalogs?.[locale]) ?? own(CORE_CATALOG[locale])
      ?? own(overrides?.en) ?? own(catalogs?.en) ?? own(CORE_CATALOG.en) ?? key;
    return message.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
  };
}
