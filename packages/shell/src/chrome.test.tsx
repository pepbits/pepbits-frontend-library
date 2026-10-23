import React from "react";
import { render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { chromePalette } from "./chrome-palette.ts";
import { useClock } from "./use-clock.ts";

/**
 * The shell's small pieces. Each is a rule the rest of the chrome depends on
 * and none of them renders anything a screen test would notice going wrong.
 */

describe("chromePalette", () => {
  /* "surface" leaves the element on the page's own tokens. Returning an empty
     object instead would still set a style attribute and win over inherited
     values; undefined is the actual no-op. */
  test("the page's own surface is a no-op, not an empty override", () => {
    expect(chromePalette("surface")).toBeUndefined();
  });

  test("re-points the generic tokens rather than introducing new names", () => {
    const palette = chromePalette("contrast") as Record<string, string>;
    /* Every `bg-[var(--surface)]` already inside the element has to resolve to
       this palette with no change to the markup. A `--sidebar-bg` would need
       every component to know it exists. */
    for (const token of ["--surface", "--text", "--text-muted", "--border", "--primary-soft"]) {
      expect(Object.keys(palette)).toContain(token);
    }
  });

  test("light and contrast are the same recipe over different seeds", () => {
    const contrast = chromePalette("contrast") as Record<string, string>;
    const light = chromePalette("light") as Record<string, string>;
    expect(Object.keys(contrast)).toEqual(Object.keys(light));
    expect(contrast["--surface"]).toBe("var(--sidebar-surface)");
    expect(light["--surface"]).toBe("var(--sidebar-surface-light)");
    expect(contrast["--text"]).toBe("var(--sidebar-text)");
    expect(light["--text"]).toBe("var(--sidebar-text-light)");
  });

  /* Mixed toward the chrome's own surface, never toward `transparent`. A
     translucent value composites against whatever sits behind it, which for the
     sidebar is the page it floats over. */
  test.each(["contrast", "light"] as const)("every derived value on the %s rail is opaque", (tone) => {
    const palette = chromePalette(tone) as Record<string, string>;
    for (const [token, value] of Object.entries(palette)) {
      if (!value.startsWith("color-mix")) continue;
      if (token === "--surface-translucent") continue;
      expect(value, token).not.toContain("transparent");
    }
  });

  /* The one deliberate exception: the header is translucent with a backdrop
     blur, so it needs its own near-opaque version of the chrome surface rather
     than the page's. */
  test("the header's translucent surface is the exception, and mixes its own", () => {
    const contrast = chromePalette("contrast") as Record<string, string>;
    expect(contrast["--surface-translucent"]).toContain("var(--sidebar-surface)");
    expect(contrast["--surface-translucent"]).toContain("transparent");
  });

  test("each derived value is mixed toward the chrome, not the page", () => {
    const contrast = chromePalette("contrast") as Record<string, string>;
    for (const token of ["--text-muted", "--text-subtle", "--border", "--border-strong", "--surface-2", "--surface-3"]) {
      expect(contrast[token], token).toContain("var(--sidebar-surface)");
    }
  });

  /* The active row is primary-tinted against the CHROME, and its text lifts
     toward the chrome's own text so it stays legible on either tone. */
  test("the active row is tinted against the chrome rather than the page", () => {
    const contrast = chromePalette("contrast") as Record<string, string>;
    expect(contrast["--primary-soft"]).toContain("var(--primary)");
    expect(contrast["--primary-soft"]).toContain("var(--sidebar-surface)");
    expect(contrast["--primary-strong"]).toContain("var(--sidebar-text)");
  });
});

describe("useClock", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function Clock({ every }: { every: number }) {
    const now = useClock(every);
    return <output data-testid="clock">{now ? now.toISOString() : "-"}</output>;
  }
  const shown = () => screen.getByTestId("clock").textContent;

  /* NULL FIRST IS THE POINT. Rendering a time during SSR bakes the server's
     clock into the HTML, and React reports a hydration mismatch the moment the
     client disagrees — which it always will. */
  test("is null on the first render, before any effect has run", () => {
    const seen: unknown[] = [];
    function Probe() {
      seen.push(useClock(1000));
      return null;
    }
    /* Every render is recorded, and the FIRST is the one asserted. Reading a
       single variable after render() returns catches the second render, by
       which time the answer is already a Date — the check passed against a
       hook that never returned null at all. */
    render(<Probe />);
    expect(seen[0]).toBeNull();
    expect(seen.at(-1)).toBeInstanceOf(Date);
  });

  test("fills in once the client has mounted", () => {
    render(<Clock every={1000} />);
    expect(shown()).not.toBe("-");
  });

  test("ticks at the interval it was given, and not before", () => {
    render(<Clock every={60_000} />);
    const first = shown();
    act(() => { vi.advanceTimersByTime(59_000); });
    expect(shown()).toBe(first);
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(shown()).not.toBe(first);
  });

  /* The interval is the caller's choice because the cost is theirs: a display
     with minute resolution ticking every second is 59 wasted renders a minute. */
  test("a display asking for minutes is not woken every second", () => {
    let renders = 0;
    function Counting() {
      renders += 1;
      useClock(60_000);
      return null;
    }
    render(<Counting />);
    const settled = renders;
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(renders).toBe(settled);
  });

  test("stops when the component goes away", () => {
    const { unmount } = render(<Clock every={1000} />);
    unmount();
    expect(() => act(() => { vi.advanceTimersByTime(5_000); })).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  test("changing the interval re-subscribes at the new rate", () => {
    const { rerender } = render(<Clock every={60_000} />);
    rerender(<Clock every={1_000} />);
    const first = shown();
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(shown()).not.toBe(first);
  });
});

