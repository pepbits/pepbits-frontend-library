import {describe, expect, test} from "vitest";
import {CORE_CATALOG, LANGUAGE_OPTIONS, createTranslator, directionOf, createFormatters,
  localizeApiMessage, localizeFieldError, localizeImportError, localizeApprovalNotice,
  type LanguageKey, type TranslationCatalog} from "@pepbits/i18n";
import {FORMAT_OPTIONS} from "./test-options";

describe("ported localization contracts", () => {
  test("ships exactly the 18 core keys in all four languages", () => {
    const tokens = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
    expect(Object.keys(CORE_CATALOG.en)).toHaveLength(18);
    for (const {value} of LANGUAGE_OPTIONS) {
      expect(Object.keys(CORE_CATALOG[value]).sort()).toEqual(Object.keys(CORE_CATALOG.en).sort());
      for (const [key, message] of Object.entries(CORE_CATALOG[value])) {
        expect(message.trim(), `${value}: ${key}`).not.toBe("");
        expect(tokens(message)).toEqual(tokens(CORE_CATALOG.en[key]!));
      }
      expect(directionOf(value)).toBe(value === "ar" ? "rtl" : "ltr");
    }
  });

  test("falls back safely and applies host overrides before shared messages", () => {
    expect(createTranslator({language: "ar"})("Unknown feature")).toBe("Unknown feature");
    expect(createTranslator({language: "xx" as LanguageKey})("save")).toBe("Save");
    expect(createTranslator({language: "ar", overrides: {ar: {Save: "CUSTOM"}}})("Save")).toBe("CUSTOM");
    expect(createTranslator({language: "ml", overrides: {en: {"host.custom": "Fallback"}}})("host.custom")).toBe("Fallback");
    expect(createTranslator({language: "hi"})("Import {page}", {page: "R-001"})).toContain("R-001");
    expect(createTranslator({language: "en"})("{missing}")).toBe("{missing}");
    expect(createTranslator({language: "en"})("toString")).toBe("toString");
  });

  test("translates known validation errors and preserves unknown server detail", () => {
    const t = createTranslator({language: "ar", catalogs: {ar: {
      "Legal name": "الاسم القانوني", "{field} is required": "{field} مطلوب",
    }}});
    expect(localizeFieldError("Legal name is required", "Legal name", t)).toBe("الاسم القانوني مطلوب");
    expect(localizeFieldError("Credit limit must be at least 0", "Credit limit", t)).toContain("0");
    expect(localizeFieldError("Custom backend constraint X-19", "Legal name", t)).toBe("Custom backend constraint X-19");
  });

  test("localizes months without changing explicit numeric and calendar preferences", () => {
    const en = createFormatters({...FORMAT_OPTIONS, language: "en", dateFormat: "medium"});
    const ar = createFormatters({...FORMAT_OPTIONS, language: "ar", dateFormat: "medium"});
    expect(ar.date("2026-09-08")).not.toBe(en.date("2026-09-08"));
    expect(ar.money(1234.5)).toBe(en.money(1234.5));
    expect(createFormatters({...FORMAT_OPTIONS, language: "ar", dateFormat: "dmy"}).date("2026-09-08")).toBe("08/09/2026");
  });
});

test("lookup order is locale override, host, core, then English override, host, core, then key", () => {
  const catalogs: TranslationCatalog = {ar: {save: "host-ar"}, en: {save: "host-en", custom: "host-en"}};
  const overrides: TranslationCatalog = {ar: {save: "override-ar"}, en: {save: "override-en", custom: "override-en"}};
  const t = createTranslator({language: "ar", catalogs, overrides});
  expect(t("save")).toBe("override-ar");
  delete overrides.ar!.save;
  expect(t("save")).toBe("host-ar");
  delete catalogs.ar!.save;
  expect(t("save")).toBe("حفظ");
  expect(t("custom")).toBe("override-en");
  delete overrides.en!.custom;
  expect(t("custom")).toBe("host-en");
  delete catalogs.en!.custom;
  expect(t("custom")).toBe("custom");
  expect(createTranslator({language: "en"})("save")).toBe("Save");
});

test("uses own string messages, permits empty strings, and substitutes only own word placeholders", () => {
  const catalogs = {en: Object.assign(Object.create({inherited: "bad"}), {empty: "", invalid: 42})};
  const t = createTranslator({language: "en", catalogs});
  expect(t("inherited")).toBe("inherited");
  expect(t("invalid")).toBe("invalid");
  expect(t("empty")).toBe("");
  expect(t("{count}/{count} {missing} {not-word} {toString}", {count: 0})).toBe("0/0 {missing} {not-word} {toString}");
  expect(t("{value}", {value: "$& {other}"})).toBe("$& {other}");
});

const t = createTranslator({language: "en", catalogs: {en: {
  fallback: "Readable fallback", failure: "Could not save {id}",
  "{field} cannot be empty.": "empty: {field}", "{field} must be a number.": "number: {field}",
  "{field} cannot be negative.": "negative: {field}", "{field} is required": "required: {field}",
  "{field} must be a number": "number: {field}", "{field} must be at least {value}": "min: {field} {value}",
  "{field} must be at most {value}": "max: {field} {value}", Amount: "Localized amount",
  "Data row {row} has {actual} cells; expected {expected}.": "Row {row}: {actual}/{expected}",
  "Submitted for {stage}": "Submitted: {stage}", "Advanced to {stage}": "Advanced: {stage}",
}}});

test("API descriptors translate finite values and preserve readable unknown-key fallbacks", () => {
  expect(localizeApiMessage({messageKey: "failure", messageValues: {id: 7}}, "fallback", t)).toBe("Could not save 7");
  expect(localizeApiMessage({messageKey: "unknown", messageValues: {}}, "fallback", t)).toBe("Readable fallback");
});

test.each([null, "error", {}, {messageKey: "failure"}, {messageKey: "", messageValues: {}},
  {messageKey: "failure", messageValues: []}, {messageKey: "failure", messageValues: {id: NaN}},
  {messageKey: "failure", messageValues: {id: Infinity}}, {messageKey: "failure", messageValues: {id: true}},
  {messageKey: "failure", messageValues: {id: {}}}, {messageKey: 1, messageValues: {}}])(
  "invalid API descriptor %j uses fallback", descriptor => {
    expect(localizeApiMessage(descriptor, "fallback", t)).toBe("Readable fallback");
  });

test.each([
  [" cannot be empty.", "empty: Localized amount"], [" must be a number.", "number: Localized amount"],
  [" cannot be negative.", "negative: Localized amount"], [" is required", "required: Localized amount"],
  [" must be a number", "number: Localized amount"], [" must be at least 0", "min: Localized amount 0"],
  [" must be at most 99", "max: Localized amount 99"],
])("localizes field error %s", (suffix, expected) => {
  expect(localizeFieldError("Amount" + suffix, "Amount", t)).toBe(expected);
});

test("empty errors, CSV errors and approval stages retain their data", () => {
  expect(localizeFieldError(undefined, "Amount", t)).toBeUndefined();
  expect(localizeFieldError("", "Amount", t)).toBe("");
  expect(localizeImportError("Data row 7 has 2 cells; expected 4.", t)).toBe("Row 7: 2/4");
  expect(localizeImportError("Adapter-specific error ABC", t)).toBe("Adapter-specific error ABC");
  expect(localizeApprovalNotice("Submitted for Custom stage A-19", t)).toBe("Submitted: Custom stage A-19");
  expect(localizeApprovalNotice("Advanced to Custom stage A-19", t)).toBe("Advanced: Custom stage A-19");
  expect(localizeApprovalNotice("Unknown notice", t)).toBe("Unknown notice");
});
