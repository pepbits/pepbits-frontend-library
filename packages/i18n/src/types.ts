export type LanguageKey = "en" | "ar" | "hi" | "ml";
export type TranslationValues = Record<string, string | number>;
export type Messages = Record<string, string>;
export type TranslationCatalog = Partial<Record<LanguageKey, Messages>>;
export type Translator = (key: string, values?: TranslationValues) => string;

export interface FormatColumn { type?: string }

/** Explicit presentation options; no dependency on a preference store or page schema. */
export interface FormatOptions {
  currencyCode: string;
  numberLocale: string;
  dateFormat: "iso" | "dmy" | "mdy" | "medium";
  decimalPlaces: number;
  timeFormat: "12h" | "24h";
  currencyDisplay: "symbol" | "code" | "none";
  negativeStyle: "minus" | "parentheses";
  language?: LanguageKey;
}
