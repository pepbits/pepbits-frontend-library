import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { NavigationProvider, targetKey, useNavigation } from "./navigation.tsx";
import type { NavigationPort } from "./navigation.tsx";
import { NULL_WINDOW_PORT, WindowPortProvider, useWindowPort } from "./windows.tsx";
import type { WindowPort } from "./windows.tsx";

/**
 * The two ports the shells implement differently.
 *
 * Small files, and load-bearing out of proportion to their size: `targetKey` is
 * the identity three separate things agree on — the web shell compares the
 * current location with it, the desktop shell uses it as a tab id, and the
 * workspace derives a document key from it. A change here is a change to all
 * three, and only one of them would notice.
 */

const port = (over: Partial<NavigationPort> = {}): NavigationPort => ({
  current: { pageId: "customer-master" },
  open: vi.fn(),
  openInNewContext: vi.fn(),
  hrefFor: () => "#",
  ...over,
});

describe("targetKey", () => {
  test("is stable for the same target", () => {
    const target = { pageId: "customer-master", mode: "view" as const, recordId: "C-100" };
    expect(targetKey(target)).toBe(targetKey({ ...target }));
  });

  /* The title is a label, not identity. Opening the same record from a row that
     says "Acme Ltd" and from a search result that says "ACME LIMITED" must
     reuse one tab, not open two. */
  test("ignores the title, which is a label rather than identity", () => {
    expect(targetKey({ pageId: "customer-master", recordId: "C-100" }))
      .toBe(targetKey({ pageId: "customer-master", recordId: "C-100", title: "Acme Ltd" }));
  });

  test("separates a list, a record, an edit and a new form", () => {
    const keys = [
      targetKey({ pageId: "customer-master" }),
      targetKey({ pageId: "customer-master", mode: "view", recordId: "C-100" }),
      targetKey({ pageId: "customer-master", mode: "edit", recordId: "C-100" }),
      targetKey({ pageId: "customer-master", mode: "new" }),
    ];
    expect(new Set(keys).size).toBe(4);
  });

  test("two records on the same page are two targets", () => {
    expect(targetKey({ pageId: "customer-master", mode: "view", recordId: "C-100" }))
      .not.toBe(targetKey({ pageId: "customer-master", mode: "view", recordId: "C-200" }));
  });

  /* The defaults are written into the key rather than left blank, so a target
     with no mode and one that says "list" are the same tab. A blank segment
     would make `p::` and `p:list:` two ids for one destination. */
  test("an unspecified mode and record are named, not left empty", () => {
    expect(targetKey({ pageId: "customer-master" })).toBe("customer-master:list:root");
  });

  test("and an explicit list is the same target as no mode at all", () => {
    expect(targetKey({ pageId: "customer-master" })).toBe(targetKey({ pageId: "customer-master", mode: "list" as never }));
  });

  /* Document keys refuse a colon, and the workspace builds one out of this. A
     recordId carrying the separator has to survive that conversion, which is
     why erp-shell's documentFromTarget escapes rather than splitting. */
  test("uses the colon that document keys refuse, so callers must escape", () => {
    expect(targetKey({ pageId: "customer-master" })).toContain(":");
    expect(targetKey({ pageId: "customer-master", mode: "view", recordId: "C:100" })).toContain("C:100");
  });
});

describe("useNavigation", () => {
  function Where() {
    return <output data-testid="page">{useNavigation().current.pageId}</output>;
  }

  test("reads the port the shell provided", () => {
    render(<NavigationProvider value={port({ current: { pageId: "supplier-master" } })}><Where /></NavigationProvider>);
    expect(screen.getByTestId("page").textContent).toBe("supplier-master");
  });

  /* Throws deliberately. A silent no-provider fallback produces a shell that
     looks correct and navigates nowhere, which is far harder to find than an
     error at the boundary. */
  test("throws when no shell provided one", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Where />)).toThrow(/NavigationProvider/);
    quiet.mockRestore();
  });

  test("hands back the same port object, so callers can compare identity", () => {
    const value = port();
    let seen: NavigationPort | null = null;
    function Capture() { seen = useNavigation(); return null; }
    render(<NavigationProvider value={value}><Capture /></NavigationProvider>);
    expect(seen).toBe(value);
  });
});

describe("the null window port", () => {
  test("says it is unavailable", () => {
    expect(NULL_WINDOW_PORT.available).toBe(false);
  });

  /* `available` is what the detach action is hidden behind. An action that
     silently does nothing is worse than one that is not offered — so open
     resolves FALSE rather than true, and the caller can tell. */
  test("opening resolves false rather than pretending", async () => {
    await expect(NULL_WINDOW_PORT.open({ documentId: "d1", documentKey: "t:CUSTOMER:C-100", title: "Acme" })).resolves.toBe(false);
  });

  test("closing and focusing are no-ops that resolve", async () => {
    await expect(NULL_WINDOW_PORT.close("d1")).resolves.toBeUndefined();
    await expect(NULL_WINDOW_PORT.focus("d1")).resolves.toBeUndefined();
  });

  /* Returns an unsubscribe, like the real port. A subscriber that gets
     undefined back cannot clean up, and the effect calling it crashes on
     unmount — in the shell that has no windows, which is the web one. */
  test("subscribing returns an unsubscribe that can be called", () => {
    const stop = NULL_WINDOW_PORT.onClosed(() => {});
    expect(typeof stop).toBe("function");
    expect(() => stop()).not.toThrow();
  });
});

describe("useWindowPort", () => {
  function Availability() {
    return <output data-testid="available">{String(useWindowPort().available)}</output>;
  }

  /* The deliberate asymmetry with useNavigation. Navigation is required for a
     shell to work at all; a second window is not, so a shell that never
     provides one renders without windows rather than crashing. */
  test("falls back to the null port instead of throwing", () => {
    expect(() => render(<Availability />)).not.toThrow();
    expect(screen.getByTestId("available").textContent).toBe("false");
  });

  test("uses the shell's port when there is one", () => {
    const real: WindowPort = { ...NULL_WINDOW_PORT, available: true };
    render(<WindowPortProvider value={real}><Availability /></WindowPortProvider>);
    expect(screen.getByTestId("available").textContent).toBe("true");
  });

  test("a shell that provides one gets exactly that object", () => {
    const real: WindowPort = { ...NULL_WINDOW_PORT, available: true, open: vi.fn(async () => true) };
    let seen: WindowPort | null = null;
    function Capture() { seen = useWindowPort(); return null; }
    render(<WindowPortProvider value={real}><Capture /></WindowPortProvider>);
    expect(seen).toBe(real);
  });
});
