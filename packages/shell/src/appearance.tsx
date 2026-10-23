"use client";
import {useEffect} from "react";
import {usePreferences} from "@pepbits/preferences/react";
import {useLocalization} from "@pepbits/i18n/react";
/* Hosts load the selected font families before rendering, so the picker changes what you see. Before this
   the list offered Inter and Manrope with neither loaded -- the choice did
   nothing on any machine that lacked them locally, which is most machines. */
const FONT_MAP: Record<string, string> = {
  inter: "Inter, ui-sans-serif, system-ui, sans-serif",
  plex: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
  "source-sans": "'Source Sans 3', ui-sans-serif, system-ui, sans-serif",
  nunito: "'Nunito Sans', ui-sans-serif, system-ui, sans-serif",
  manrope: "Manrope, Inter, ui-sans-serif, system-ui, sans-serif",
  system: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  georgia: "Georgia, 'Times New Roman', serif",
  "plex-mono": "'IBM Plex Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
};

/* 13px is the reference: the design as drawn. Each scale is the chosen px over
   that, applied by calc() at every text class -- see tokens.css for why the
   multiplication happens at the element and not here. */
const TYPE_REFERENCE_PX = 13;

/** Table/card row padding, as a variable so density has ONE definition. */
const ROW_PADDING = { compact: "6px", comfortable: "10px", spacious: "14px" };


/** Apply effective shell, form and result scales to the host document. Mount one shell per document. */
export function ShellAppearance() {
 const {preferences} = usePreferences();
 const {language, direction} = useLocalization();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = preferences.theme;
    root.dataset.reducedMotion = String(preferences.reducedMotion);
    root.style.setProperty("--font-ui", FONT_MAP[preferences.fontFamily] ?? FONT_MAP.inter!);
    root.style.setProperty("--fs-shell", String(preferences.fontSizeBase / TYPE_REFERENCE_PX));
    root.style.setProperty("--fs-form", String(preferences.fontSizeForm / TYPE_REFERENCE_PX));
    root.style.setProperty("--fs-result", String(preferences.fontSizeResult / TYPE_REFERENCE_PX));
    /* Written as variables rather than read as props by each component: one
       assignment restyles every card, table row and input at once, and there is
       no ternary to duplicate across DataTable and CardGrid. */
    root.style.setProperty("--radius", `${preferences.cornerRadius}px`);
    root.style.setProperty("--row-py", ROW_PADDING[preferences.density]);

    root.lang = language;
    root.dir = direction;
  }, [preferences, language, direction]);
 return null;
}
