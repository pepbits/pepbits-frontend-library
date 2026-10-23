import {createFormatters, type Formatters} from '@pepbits/i18n';
import {type UserPreferences, type CurrencyCode} from '@pepbits/preferences';
/** Ledger cents must remain visible even when general number display uses whole units. */
export function createClinicFormatters(
  preferences: UserPreferences,
  currency: CurrencyCode,
): Formatters {
  const base = createFormatters(preferences),
    money = createFormatters({
      ...preferences,
      currencyCode: currency,
      decimalPlaces:
        preferences.decimalPlaces === 0 ? 2 : preferences.decimalPlaces,
    }).money;
  return {
    ...base,
    money,
    cell: (column, value) =>
      column?.type === "money" &&
      value !== null &&
      value !== undefined &&
      value !== ""
        ? money(Number(value))
        : base.cell(column, value),
  };
}
