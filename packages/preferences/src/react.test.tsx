// @vitest-environment jsdom
import React from "react";
import {afterEach, expect, test, vi} from "vitest";
import {cleanup, fireEvent, render, renderHook, screen} from "@testing-library/react";
import {DEFAULT_PREFERENCES, type PreferencePolicy, type UserPreferences} from "@pepbits/preferences";
import {PreferenceHost, usePreference, usePreferences, type PreferenceHostProps} from "@pepbits/preferences/react";

afterEach(cleanup);

function Choice() {
  const {value, locked, update} = usePreference("resultView");
  return <button disabled={locked} onClick={() => update({resultView: "cards"})}>{value}</button>;
}

test("host receives one patch and controls when an accepted change becomes visible", () => {
  const update = vi.fn();
  const {rerender} = render(<PreferenceHost preferences={DEFAULT_PREFERENCES} update={update}><Choice /></PreferenceHost>);
  fireEvent.click(screen.getByRole("button"));
  expect(update).toHaveBeenCalledExactlyOnceWith({resultView: "cards"});
  expect(screen.getByRole("button").textContent).toBe("table");
  rerender(<PreferenceHost preferences={{...DEFAULT_PREFERENCES, resultView: "cards"}} update={update}><Choice /></PreferenceHost>);
  expect(screen.getByRole("button").textContent).toBe("cards");
});

// Adapted from the existing template PreferenceHost locking regression.
test("live policy changes replace conflicting preferences and unlocking restores the host snapshot", () => {
  const update = vi.fn();
  const host = {preferences: DEFAULT_PREFERENCES, update};
  const {rerender} = render(<PreferenceHost {...host}><Choice /></PreferenceHost>);
  fireEvent.click(screen.getByRole("button"));
  const locked: PreferencePolicy = {revision: 1, rules: {resultView: {locked: true, value: "cards"}}};
  rerender(<PreferenceHost {...host} preferencePolicy={locked}><Choice /></PreferenceHost>);
  expect(screen.getByRole("button").textContent).toBe("cards");
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button"));
  expect(update).toHaveBeenCalledTimes(1);
  rerender(<PreferenceHost {...host} preferencePolicy={{revision: 2, rules: {}}}><Choice /></PreferenceHost>);
  expect(screen.getByRole("button").textContent).toBe("table");
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);
  rerender(<PreferenceHost {...host} preferencesAvailable={false}><Choice /></PreferenceHost>);
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
});

test("allowed values, locked page size, invalid keys and unavailable updates are guarded", () => {
  const update = vi.fn();
  let props: PreferenceHostProps = {preferences: {pageSize: 100, density: "compact"}, update,
    preferencePolicy: {revision: 1, rules: {
      pageSize: {locked: true, value: 10},
      density: {locked: false, value: "comfortable", allowedValues: ["comfortable", "spacious"]},
    }}};
  const {result, rerender} = renderHook(() => ({all: usePreferences(), size: usePreference("pageSize")}), {
    wrapper: ({children}) => <PreferenceHost {...props}>{children}</PreferenceHost>,
  });
  expect(result.current.size.value).toBe(10);
  expect(result.current.size.locked).toBe(true);
  expect(result.current.all.preferences.density).toBe("comfortable");
  expect(result.current.all.allowedValues("density")).toEqual(["comfortable", "spacious"]);
  expect(result.current.all.allowedValues("language")).toBeUndefined();
  expect(result.current.size.update).toBe(result.current.all.update);
  result.current.all.update({pageSize: 50, density: "compact", language: "ml", fontSizeBase: 100,
    unknown: true} as Partial<UserPreferences>);
  expect(update).toHaveBeenCalledExactlyOnceWith({language: "ml"});
  result.current.all.update({density: "spacious"});
  expect(update).toHaveBeenLastCalledWith({density: "spacious"});
  result.current.all.update({pageSize: 50});
  expect(update).toHaveBeenCalledTimes(2);
  props = {...props, preferencesAvailable: false};
  rerender();
  result.current.all.update({language: "hi"});
  expect(update).toHaveBeenCalledTimes(2);
  expect(result.current.all.isLocked("language")).toBe(true);
});

test("retained update callbacks obey the latest policy and host callback", () => {
  const first = vi.fn(), second = vi.fn();
  let props: PreferenceHostProps = {preferences: {}, update: first};
  const {result, rerender} = renderHook(usePreferences, {
    wrapper: ({children}) => <PreferenceHost {...props}>{children}</PreferenceHost>,
  });
  const retained = result.current.update;
  props = {...props, update: second, preferencePolicy: {revision: 1, rules: {language: {locked: true, value: "ar"}}}};
  rerender();
  retained({language: "hi", pageSize: 50});
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledExactlyOnceWith({pageSize: 50});
  expect(result.current.preferences.language).toBe("ar");
});

test("host persistence failures propagate without optimistic state or automatic retries", async () => {
  const update = vi.fn(async () => {throw new Error("save failed");});
  const {result} = renderHook(usePreferences, {
    wrapper: ({children}) => <PreferenceHost preferences={{}} update={update}>{children}</PreferenceHost>,
  });
  await expect(result.current.update({pageSize: 50})).rejects.toThrow("save failed");
  expect(result.current.preferences.pageSize).toBe(20);
  expect(update).toHaveBeenCalledTimes(1);
});

test("a missing host fails clearly; separate hosts do not share state", () => {
  expect(() => renderHook(usePreferences)).toThrow("usePreferences requires a PreferenceHost.");
  const one = renderHook(usePreferences, {wrapper: ({children}) => <PreferenceHost preferences={{language: "ar"}} update={() => {}}>{children}</PreferenceHost>});
  const two = renderHook(usePreferences, {wrapper: ({children}) => <PreferenceHost preferences={{language: "hi"}} update={() => {}}>{children}</PreferenceHost>});
  expect(one.result.current.preferences.language).toBe("ar");
  expect(two.result.current.preferences.language).toBe("hi");
});
