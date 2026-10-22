import {expect, test} from "vitest";
import {createFormatters} from "@pepbits/i18n";
import {FORMAT_OPTIONS} from "./test-options";

test.each([['iso', '2026-09-08'], ['dmy', '08/09/2026'], ['mdy', '09/08/2026'],
  ['medium', '08 Sep 2026']] as const)("calendar dates respect %s without UTC conversion", (dateFormat, expected) => {
  const f = createFormatters({...FORMAT_OPTIONS, dateFormat});
  expect(f.date("2026-09-08")).toBe(expected);
  expect(f.date(new Date(2026, 8, 8, 0, 5))).toBe(expected);
  expect(f.date("2026-13-08")).toBe("2026-13-08");
  expect(f.date("not a date")).toBe("not a date");
});

test.each([['00:00', '12:00 AM'], ['12:00', '12:00 PM'], ['23:59', '11:59 PM']] as const)(
  "12-hour clock formats %s", (value, expected) => {
    expect(createFormatters({...FORMAT_OPTIONS, timeFormat: "12h"}).time(value)).toBe(expected);
  });

test("clock times preserve optional seconds and local Date parts", () => {
  const f = createFormatters(FORMAT_OPTIONS);
  expect(f.time("9:05")).toBe("09:05");
  expect(f.time("09:05", {seconds: true})).toBe("09:05");
  expect(f.time("09:05:07", {seconds: true})).toBe("09:05:07");
  expect(f.time("2026-09-08T09:05:07Z")).toBe("09:05");
  expect(f.time(new Date(2026, 8, 8, 9, 5, 7), {seconds: true})).toBe("09:05:07");
  expect(f.time("25:00")).toBe("25:00");
  expect(f.time("unknown")).toBe("unknown");
  expect(f.dateTime("2026-09-08")).toBe("2026-09-08");
  expect(f.dateTime(new Date(2026, 8, 8, 9, 5, 7))).toBe("2026-09-08 09:05");
});

test.each(['symbol', 'code', 'none'] as const)("accounting currency with %s avoids doubled parentheses", currencyDisplay => {
  const f = createFormatters({...FORMAT_OPTIONS, currencyCode: "USD", decimalPlaces: 2,
    negativeStyle: "parentheses", currencyDisplay});
  const expected = currencyDisplay === "none" ? "(1,234.50)" : new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", currencyDisplay, currencySign: "accounting",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(-1234.5);
  expect(f.money(-1234.5)).toBe(expected);
  expect(f.cell({type: "money"}, -1234.5)).toBe(expected);
  expect(f.number(-1234.5)).toBe("(1,234.5)");
});

test("cell dispatch handles empty, numeric, untyped dates and unknown values", () => {
  const f = createFormatters({...FORMAT_OPTIONS, dateFormat: "dmy"});
  for (const value of [null, undefined, ""]) expect(f.cell(undefined, value)).toBe("—");
  expect(f.cell({type: "number"}, "1234")).toBe("1,234");
  expect(f.cell({type: "number"}, "bad")).toBe("0");
  expect(f.cell({type: "percent"}, "12")).toBe("12%");
  expect(f.cell({type: "date"}, "2026-09-08T13:05:09")).toBe("08/09/2026 13:05");
  expect(f.cell(undefined, "2026-09-08")).toBe("08/09/2026");
  expect(f.cell({type: "custom"}, false)).toBe("false");
  expect(f.compact(1200)).toBe("1.2K");
  expect(f.money(NaN)).toBe(f.money(0));
});
