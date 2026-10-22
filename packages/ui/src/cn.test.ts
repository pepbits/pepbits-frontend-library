import { describe, expect, test } from "vitest";
import { cn, formatCompact } from "./cn";

import {createFormatters} from "@pepbits/i18n";

const money = (value: number, currency = "GBP") => createFormatters({
  currencyCode: currency, numberLocale: "en-GB", decimalPlaces: 0, dateFormat: "iso",
  timeFormat: "24h", currencyDisplay: currency === "USD" ? "symbol" : "code",
  negativeStyle: "minus", language: "en",
}).money(value).replace(/\u00a0/g, " ");

describe("cn", () => {
  test("joins what is there and drops what is not", () => {
    expect(cn("a", "b")).toBe("a b");
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
    expect(cn()).toBe("");
  });

  /* Every component builds its class list as cn("base", flag && "extra"). If a
     falsy branch leaked through as the string "false", the class would be
     harmless but the ones after it would be joined by two spaces -- and any
     class equal to "undefined" silently matches nothing while looking fine. */
  test("a falsy branch contributes nothing, not a word", () => {
    expect(cn("base", false && "active")).toBe("base");
    expect(cn("base", undefined, "end")).not.toContain("undefined");
    expect(cn("base", false && "x", "end")).toBe("base end");
  });
});

/* Spaces are normalised before comparing. Intl separates the currency code
   from the number with U+00A0, not a space -- invisible in a failure diff, and
   changed by ICU between Node releases. A test that goes red on a Node upgrade
   for a character nobody can see is a test people delete.

   Pinned because these are read as money on a dashboard. The negative form in
   particular: a caller that wraps negatives in its own parentheses on top of a
   format that already signs them produces ((GBP 1,200)), which reads as a
   different number than it is. */
describe("host-supplied currency formatter", () => {
  test("shows the currency and thousands separators, and no decimals", () => {
    expect(money(1200)).toBe("GBP 1,200");
    expect(money(42160000)).toBe("GBP 42,160,000");
  });

  test("rounds rather than truncating", () => {
    expect(money(1234.56)).toBe("GBP 1,235");
  });

  test("a negative is signed once, with a minus and no brackets", () => {
    expect(money(-1200)).toBe("-GBP 1,200");
  });

  test("zero is zero, not an empty string", () => {
    expect(money(0)).toBe("GBP 0");
  });

  test("another currency uses its own symbol", () => {
    expect(money(1200, "USD")).toBe("US$1,200");
  });
});

describe("formatCompact", () => {
  test("shortens above a thousand and leaves smaller numbers alone", () => {
    expect(formatCompact(999)).toBe("999");
    expect(formatCompact(1250)).toBe("1.3K");
    expect(formatCompact(1250000)).toBe("1.3M");
  });

  test("keeps the sign", () => {
    expect(formatCompact(-1250000)).toBe("-1.3M");
    expect(formatCompact(0)).toBe("0");
  });
});
