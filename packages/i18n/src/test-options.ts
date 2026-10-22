import type {FormatOptions} from "./index";

// Explicit fixture matching the original formatter test defaults, without preferences.
export const FORMAT_OPTIONS: FormatOptions = {currencyCode: "AED", numberLocale: "en-US",
  dateFormat: "iso", decimalPlaces: 0, timeFormat: "24h", currencyDisplay: "symbol",
  negativeStyle: "minus", language: "en"};
