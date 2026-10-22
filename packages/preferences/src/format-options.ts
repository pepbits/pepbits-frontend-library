import type {FormatOptions} from "@pepbits/i18n";
import type {UserPreferences} from "./types";

/** Pass effective preferences, after resolving the host's policy. */
export function formatOptionsFrom(preferences: UserPreferences): FormatOptions {
  const {currencyCode, numberLocale, dateFormat, decimalPlaces, timeFormat,
    currencyDisplay, negativeStyle, language} = preferences;
  return {currencyCode, numberLocale, dateFormat, decimalPlaces, timeFormat,
    currencyDisplay, negativeStyle, language};
}
