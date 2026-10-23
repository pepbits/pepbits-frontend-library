import { describe, expect, test } from "vitest";
import { DEFAULT_LIMITS, resolveWorkspacePolicy } from "./policy.ts";

describe("resolveWorkspacePolicy — modes", () => {
  /* Safe by default. Modes are a permission, and an unconfigured permission
     grants nothing: a workspace nobody has configured must not silently allow
     detached windows on a tablet because no file said otherwise. */
  test("an unconfigured workspace permits nothing", () => {
    expect(resolveWorkspacePolicy({}).modes).toEqual([]);
  });

  test("the first level to name a set establishes it", () => {
    const { modes } = resolveWorkspacePolicy({ platform: { modes: ["SINGLE", "TAB", "SPLIT", "WINDOW"] } });
    expect(modes).toEqual(["SINGLE", "TAB", "SPLIT", "WINDOW"]);
  });

  test("later levels can only remove", () => {
    const { modes } = resolveWorkspacePolicy({
      platform: { modes: ["SINGLE", "TAB", "SPLIT", "WINDOW"] },
      shell: { modes: ["SINGLE", "TAB", "SPLIT"] },
    });
    expect(modes).toEqual(["SINGLE", "TAB", "SPLIT"]);
  });

  /* The framework document's own example: WINDOW is enabled at platform level,
     the web shell turns it off, Tauri leaves it on, and consultation turns it
     off even on Tauri. */
  test("a page can remove a mode the shell allows", () => {
    const { modes } = resolveWorkspacePolicy({
      platform: { modes: ["SINGLE", "TAB", "SPLIT", "WINDOW"] },
      shell: { modes: ["SINGLE", "TAB", "SPLIT", "WINDOW"] },
      page: { modes: ["TAB", "SPLIT"] },
    });
    expect(modes).toEqual(["TAB", "SPLIT"]);
  });

  /* "A user preference can only choose between modes already permitted." A
     preference naming WINDOW where the shell has removed it is a request, not a
     grant, and it must not reintroduce the mode. */
  test("a user preference cannot add a mode policy removed", () => {
    const { modes } = resolveWorkspacePolicy({
      platform: { modes: ["SINGLE", "TAB", "SPLIT", "WINDOW"] },
      shell: { modes: ["SINGLE", "TAB"] },
      user: { modes: ["SINGLE", "TAB", "WINDOW"] },
    });
    expect(modes).toEqual(["SINGLE", "TAB"]);
  });

  /* The same escalation by another route: if the only level that speaks is a
     narrowing one, it would be DEFINING the set rather than reducing one. */
  test("a narrowing level alone establishes nothing", () => {
    expect(resolveWorkspacePolicy({ user: { modes: ["SINGLE", "TAB", "WINDOW"] } }).modes).toEqual([]);
    expect(resolveWorkspacePolicy({ role: { modes: ["WINDOW"] } }).modes).toEqual([]);
  });

  test("a user preference still narrows within what is permitted", () => {
    const { modes } = resolveWorkspacePolicy({
      shell: { modes: ["SINGLE", "TAB", "SPLIT"] },
      user: { modes: ["SINGLE", "TAB"] },
    });
    expect(modes).toEqual(["SINGLE", "TAB"]);
  });

  /* Without this the refusal reads "WINDOW is not available", and an
     administrator has six files to search to find out why. */
  test("says which level removed each mode", () => {
    const { deniedBy } = resolveWorkspacePolicy({
      platform: { modes: ["SINGLE", "TAB", "SPLIT", "WINDOW"] },
      shell: { modes: ["SINGLE", "TAB", "SPLIT"] },
      page: { modes: ["SINGLE", "TAB"] },
    });
    expect(deniedBy.WINDOW).toBe("shell");
    expect(deniedBy.SPLIT).toBe("page");
    expect(deniedBy.TAB).toBeUndefined();
  });
});

describe("resolveWorkspacePolicy — limits", () => {
  /* Limits are a resource guard, not a permission, so an unconfigured limit is
     a sane number rather than zero. Zero would be safe-by-default in the way
     that bricks the application. */
  test("unconfigured limits fall back to the defaults", () => {
    expect(resolveWorkspacePolicy({}).limits).toEqual(DEFAULT_LIMITS);
  });

  test("the most restrictive level wins, whichever it is", () => {
    const { limits } = resolveWorkspacePolicy({
      platform: { limits: { maxOpenDocuments: 20 } },
      role: { limits: { maxOpenDocuments: 10 } },
      user: { limits: { maxOpenDocuments: 15 } },
    });
    expect(limits.maxOpenDocuments).toBe(10);
  });

  test("a level that says nothing about a limit does not change it", () => {
    const { limits } = resolveWorkspacePolicy({
      platform: { limits: { maxOpenDocuments: 20, maxSplitPanes: 3 } },
      page: { modes: ["TAB"] },
    });
    expect(limits.maxOpenDocuments).toBe(20);
    expect(limits.maxSplitPanes).toBe(3);
  });

  /* The mirror of the modes rule. A preference that could raise a cap nobody
     else set would be establishing the limit, not choosing within it. */
  test("a user preference may lower a limit but never raise one", () => {
    expect(resolveWorkspacePolicy({ user: { limits: { maxOpenDocuments: 4 } } }).limits.maxOpenDocuments).toBe(4);
    expect(resolveWorkspacePolicy({ user: { limits: { maxOpenDocuments: 99 } } }).limits.maxOpenDocuments).toBe(DEFAULT_LIMITS.maxOpenDocuments);
    expect(resolveWorkspacePolicy({
      platform: { limits: { maxOpenDocuments: 8 } },
      user: { limits: { maxOpenDocuments: 99 } },
    }).limits.maxOpenDocuments).toBe(8);
  });

  /* A tablet profile lowering maxOpenDocuments to 4 must hold even when the
     tenant raised it to 20 — the device is the binding constraint. */
  test("a lower device limit beats a higher tenant limit", () => {
    const { limits } = resolveWorkspacePolicy({
      platform: { limits: { maxOpenDocuments: 20 } },
      shell: { limits: { maxOpenDocuments: 4 } },
    });
    expect(limits.maxOpenDocuments).toBe(4);
  });
});

describe("resolveWorkspacePolicy — flags", () => {
  test("false anywhere wins", () => {
    expect(resolveWorkspacePolicy({ platform: { allowDetach: true }, page: { allowDetach: false } }).allowDetach).toBe(false);
    expect(resolveWorkspacePolicy({ platform: { allowDetach: true }, user: { allowDetach: true } }).allowDetach).toBe(true);
  });

  test("a flag nobody sets defaults to off", () => {
    const resolved = resolveWorkspacePolicy({ platform: { modes: ["TAB"] } });
    expect(resolved.allowDetach).toBe(false);
    expect(resolved.allowDuplicate).toBe(false);
  });
});
