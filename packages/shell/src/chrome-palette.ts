"use client";

import type React from "react";
import type { ChromeTone } from "@pepbits/preferences";

/**
 * The palette for a piece of shell chrome — the sidebar rail or the header bar.
 *
 * It RE-POINTS the generic token names rather than introducing new ones, so
 * every `bg-[var(--surface)]` and `text-[var(--text-muted)]` already inside the
 * element resolves to this palette with no change to the markup. There is no
 * dark variant of either component to keep in sync with a light one.
 *
 * Nine values from two seeds. A theme declares `--sidebar-surface` and
 * `--sidebar-text` (plus a `-light` pair); the ratios here hold the
 * relationships that make a panel readable, and each is a mix of the chrome's
 * TEXT toward its SURFACE — which stays correct whether the text is
 * light-on-dark or dark-on-light, so one set of ratios serves both tones.
 *
 * Mixed toward the chrome's own surface rather than `transparent`, so every
 * derived value is opaque: a translucent one would composite against whatever
 * sits behind, which for the sidebar is the page it floats over.
 *
 * Returns undefined for "surface", which leaves the element on the page's own
 * tokens — the historical behaviour, and the cheapest possible no-op.
 */
export function chromePalette(tone: ChromeTone): React.CSSProperties | undefined {
  if (tone === "surface") return undefined;
  const surface = tone === "light" ? "var(--sidebar-surface-light)" : "var(--sidebar-surface)";
  const text = tone === "light" ? "var(--sidebar-text-light)" : "var(--sidebar-text)";
  return {
    "--surface": surface,
    /* The header is translucent with a backdrop blur, so it needs its own
       near-opaque version of the chrome surface rather than the page's. */
    "--surface-translucent": `color-mix(in srgb, ${surface} 88%, transparent)`,
    "--surface-2": `color-mix(in srgb, ${text} 10%, ${surface})`,
    "--surface-3": `color-mix(in srgb, ${text} 18%, ${surface})`,
    "--text": text,
    /* 85 and 70, not 72 and 48. The original pair looked right and measured
       3.9:1 and 2.5:1 against the rail — below AA for text of any size, on the
       one surface a user reads on every screen. Three steps still, just a
       tighter spread: legibility is the constraint and the hierarchy is the
       preference. */
    "--text-muted": `color-mix(in srgb, ${text} 85%, ${surface})`,
    "--text-subtle": `color-mix(in srgb, ${text} 70%, ${surface})`,
    "--border": `color-mix(in srgb, ${text} 16%, ${surface})`,
    "--border-strong": `color-mix(in srgb, ${text} 30%, ${surface})`,
    /* The active row is primary-tinted against the CHROME, not the page, and
       its text lifts toward the chrome's own text so it stays legible on it. */
    "--primary-soft": `color-mix(in srgb, var(--primary) 30%, ${surface})`,
    "--primary-strong": `color-mix(in srgb, var(--primary) 35%, ${text})`,
  } as React.CSSProperties;
}
