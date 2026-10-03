import { DEFAULT_PREFERENCES, type PreferencePolicy } from "@pepbits/erp-config";
import { describe, expect, it, vi } from "vitest";
import { planThemeToggle } from "./lib/theme";

const host = (theme: string, policy?: PreferencePolicy, extra: { available?: boolean; change?: boolean } = {}) => ({
  preferences: { ...DEFAULT_PREFERENCES, theme: theme as never },
  preferenceHost: { preferences: DEFAULT_PREFERENCES, preferencePolicy: policy, preferencesAvailable: extra.available, onPreferenceChange: extra.change === false ? undefined : vi.fn() },
});

describe("theme switch through the host preference path", () => {
  it("moves between a light and a dark host theme", () => {
    expect(planThemeToggle(host("nexora"))).toMatchObject({ theme: "light", canChange: true, target: "midnight" });
    expect(planThemeToggle(host("graphite"))).toMatchObject({ theme: "dark", canChange: true, target: "nexora" });
  });

  it("is disabled when the tenant locks the theme", () => {
    const locked: PreferencePolicy = { revision: 1, rules: { theme: { value: "nexora", locked: true } } };
    expect(planThemeToggle(host("nexora", locked))).toMatchObject({ canChange: false, target: null });
  });

  it("only offers themes the policy allows, and is disabled when none of the other polarity is allowed", () => {
    const some: PreferencePolicy = { revision: 1, rules: { theme: { value: "nexora", locked: false, allowedValues: ["nexora", "nord"] } } };
    expect(planThemeToggle(host("nexora", some)).target).toBe("nord");
    const none: PreferencePolicy = { revision: 1, rules: { theme: { value: "nexora", locked: false, allowedValues: ["nexora", "sand"] } } };
    expect(planThemeToggle(host("nexora", none))).toMatchObject({ canChange: false, target: null });
  });

  it("is disabled when the host cannot persist preferences", () => {
    expect(planThemeToggle(host("nexora", undefined, { available: false })).canChange).toBe(false);
    expect(planThemeToggle(host("nexora", undefined, { change: false })).canChange).toBe(false);
  });
});
