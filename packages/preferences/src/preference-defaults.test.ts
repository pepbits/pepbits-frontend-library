import { describe, expect, test } from "vitest";
import { DEFAULT_PREFERENCES } from "./preference-defaults.ts";

describe("optional features stay off", () => {
  /* Asserted here rather than in a browser: the preference persists per account,
     so a session that has ever turned it on reports "on" for ever after and a
     browser check would be testing the last run rather than the default.
     What "default" means lives in this file. */
  test("floating windows are off unless asked for", () => {
    expect(DEFAULT_PREFERENCES.floatingWindows).toBe(false);
  });

  test("and the arrangement everyone had is still the one they get", () => {
    expect(DEFAULT_PREFERENCES.openRecordsInTabs).toBe(true);
  });
});

import {validPreference, effectivePreferences} from "./preference-policy";
test("inline preview is a valid persisted preference and respects managed policy",()=>{
 expect(validPreference("previewMode","inline")).toBe(true);
 expect(effectivePreferences({previewMode:"inline"},{revision:1,rules:{previewMode:{locked:true,value:"left-drawer"}}}).previewMode).toBe("left-drawer");
});
