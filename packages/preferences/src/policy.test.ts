import {expect, test} from "vitest";
import {DEFAULT_PREFERENCES, PREFERENCE_OPTIONS, PREFERENCE_RANGES, sanitizePreferences,
  preferenceOverrides, changedPreferenceCount, parsePreferencePolicy, validPreference,
  policyDefaults, effectivePreferences, editablePreferenceOverrides, EMPTY_PREFERENCE_POLICY,
  THEME_OPTIONS, formatOptionsFrom, type PreferencePolicy, type UserPreferences} from "@pepbits/preferences";
import {createFormatters} from "@pepbits/i18n";

test.each([null, undefined, [], "bad", 17])("invalid stored preferences %j use fresh defaults", stored => {
  const result = sanitizePreferences(stored);
  expect(result).toEqual(DEFAULT_PREFERENCES);
  expect(result).not.toBe(DEFAULT_PREFERENCES);
});

test("enumerations and ranges preserve the original validation and clamping behavior", () => {
  for (const [key, options] of Object.entries(PREFERENCE_OPTIONS)) {
    for (const value of options!) expect(sanitizePreferences({[key]: value})[key as keyof UserPreferences]).toBe(value);
    expect(sanitizePreferences({[key]: "invalid"})[key as keyof UserPreferences]).toBe(DEFAULT_PREFERENCES[key as keyof UserPreferences]);
  }
  for (const [key, [min, max]] of Object.entries(PREFERENCE_RANGES)) {
    expect(sanitizePreferences({[key]: min - 10})[key as keyof UserPreferences]).toBe(min);
    expect(sanitizePreferences({[key]: max + 10})[key as keyof UserPreferences]).toBe(max);
    for (const value of [NaN, Infinity, "12"]) expect(sanitizePreferences({[key]: value})[key as keyof UserPreferences]).toBe(DEFAULT_PREFERENCES[key as keyof UserPreferences]);
    expect(validPreference(key, max + 1)).toBe(false);
  }
});

test("unknown keys and wrong primitive types are discarded; generic host module codes are validated", () => {
  expect(sanitizePreferences({other: true, reducedMotion: "yes", pageSize: "20", defaultModule: "Bad/Code"})).toEqual(DEFAULT_PREFERENCES);
  expect(sanitizePreferences({reducedMotion: true, defaultModule: "custom-area"})).toMatchObject({reducedMotion: true, defaultModule: "custom-area"});
  expect(sanitizePreferences(JSON.parse('{"__proto__":{"theme":"midnight"}}'))).toEqual(DEFAULT_PREFERENCES);
  expect(sanitizePreferences(Object.create({theme: "midnight"}))).toEqual(DEFAULT_PREFERENCES);
});

test("override count and theme choices stay aligned with defaults", () => {
  expect(preferenceOverrides(DEFAULT_PREFERENCES)).toEqual({});
  const preferences = {...DEFAULT_PREFERENCES, theme: "midnight" as const, pageSize: 50 as const};
  expect(preferenceOverrides(preferences)).toEqual({theme: "midnight", pageSize: 50});
  expect(changedPreferenceCount(preferences)).toBe(2);
  expect(THEME_OPTIONS.map(theme => theme.id)).toEqual(PREFERENCE_OPTIONS.theme);
  expect(DEFAULT_PREFERENCES.theme).toBe("nexora");
});

const policy: PreferencePolicy = {revision: 7, rules: {
  theme: {value: "midnight", locked: true},
  pageSize: {value: 50, locked: false, allowedValues: [20, 50]},
  language: {value: "ar", locked: false},
}};

test("policy defaults, effective values and editable overrides enforce locks and allowed values", () => {
  expect(parsePreferencePolicy(policy)).toEqual(policy);
  expect(policyDefaults(policy)).toMatchObject({theme: "midnight", pageSize: 50, language: "ar"});
  const values = effectivePreferences({theme: "rose", pageSize: 100, language: "hi"}, policy);
  expect(values).toMatchObject({theme: "midnight", pageSize: 50, language: "hi"});
  expect(editablePreferenceOverrides(values, policy)).toEqual({language: "hi"});
  expect(editablePreferenceOverrides({...values, pageSize: 100}, policy)).toEqual({language: "hi"});
  expect(effectivePreferences({pageSize: 20}, policy).pageSize).toBe(20);
  expect(effectivePreferences({}, EMPTY_PREFERENCE_POLICY)).toEqual(DEFAULT_PREFERENCES);
});

test.each([null, {}, {revision: -1, rules: {}}, {revision: 0.5, rules: {}}, {revision: 0, rules: []},
  {revision: 0, rules: {unknown: {value: true, locked: false}}},
  {revision: 0, rules: {theme: {value: "midnight", locked: "yes"}}},
  {revision: 0, rules: {theme: {value: "midnight", locked: false, extra: true}}},
  {revision: 0, rules: {fontSizeBase: {value: 40, locked: false}}},
])("invalid policy %j is rejected", value => {
  expect(() => parsePreferencePolicy(value)).toThrow("Invalid preference policy.");
});

test.each([[], [100], [50, 17], "50", Array(101).fill(50)])("invalid allowed values %j are rejected", allowedValues => {
  expect(() => parsePreferencePolicy({revision: 0, rules: {pageSize: {value: 50, locked: false, allowedValues}}})).toThrow("Invalid allowed preference values.");
});

test("formatOptionsFrom passes only formatter settings after policy resolution", () => {
  const preferences = effectivePreferences({currencyCode: "USD"}, {revision: 1, rules: {
    currencyCode: {locked: true, value: "INR"}, numberLocale: {locked: true, value: "en-IN"},
  }});
  const options = formatOptionsFrom(preferences);
  expect(Object.keys(options).sort()).toEqual(['currencyCode', 'numberLocale', 'dateFormat', 'decimalPlaces',
    'timeFormat', 'currencyDisplay', 'negativeStyle', 'language'].sort());
  expect(options.currencyCode).toBe("INR");
  expect(createFormatters(options).money(1234567)).toBe(createFormatters(preferences).money(1234567));
});

test('legacy rail migrates in storage, imports, defaults, locks and allowed sets',()=>{
 expect(sanitizePreferences({formNavigation:'rail'}).formNavigation).toBe('scroll');
 const policy=parsePreferencePolicy({revision:1,rules:{formNavigation:{value:'rail',locked:false,allowedValues:['rail','scroll','tabs']}}});
 expect(policy.rules.formNavigation).toEqual({value:'scroll',locked:false,allowedValues:['scroll','tabs']});
 expect(effectivePreferences({formNavigation:'rail'},policy).formNavigation).toBe('scroll');
 expect(effectivePreferences({formNavigation:'accordion'},{revision:2,rules:{formNavigation:{value:'rail',locked:true,allowedValues:['rail']}}}).formNavigation).toBe('scroll');
 expect(sanitizePreferences({formColumns:5,formValidateOn:'never',formKeepUnsaved:'yes'})).toMatchObject({formColumns:3,formValidateOn:'blur',formKeepUnsaved:true});
});
