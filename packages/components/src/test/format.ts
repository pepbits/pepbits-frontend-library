import {createFormatters} from "@pepbits/i18n";
const selected = createFormatters({currencyCode: "GBP", numberLocale: "en-GB",
  dateFormat: "iso", decimalPlaces: 0, timeFormat: "24h", currencyDisplay: "code",
  negativeStyle: "minus", language: "en"});

// Match visible text independent of the nonbreaking separator selected by ICU.
export const format = {...selected, money: (value: number) => selected.money(value).replace(/\u00a0/g, " ")};
