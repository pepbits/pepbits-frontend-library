import React from "react";
import { render, screen } from "./test/render";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { AccessDenied, ConflictState, EmptyState, ErrorState, LoadingState, NotFoundState, SessionExpiredState } from "./index";

describe("ErrorState", () => {
  test("says something useful with nothing passed", () => {
    render(<ErrorState />);
    expect(screen.getByText(/went wrong/i)).toBeVisible();
  });

  /* The one risk the gap analysis named for this component: a shared panel that
     swallows the specific message which would have told someone what actually
     broke. The detail is a slot, and it is kept. */
  test("keeps the specific message rather than replacing it", () => {
    render(<ErrorState detail="ECONNREFUSED 127.0.0.1:3200" />);
    expect(screen.getByText("ECONNREFUSED 127.0.0.1:3200")).toBeVisible();
  });

  test("the caller's own words win over the defaults", () => {
    render(<ErrorState title="That report could not be built" description="The ledger service did not answer." />);
    expect(screen.getByText("That report could not be built")).toBeVisible();
    expect(screen.queryByText(/went wrong/i)).toBeNull();
  });

  /* Retry logic in one place is the reason this exists. A panel that only says
     "something went wrong" leaves reloading the whole page as the only move. */
  test("offers a retry when there is something to retry", async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  test("and none when there is not", () => {
    render(<ErrorState />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  /* A failure a screen reader never hears is a screen that looks like it is
     still loading. */
  test("announces itself", () => {
    render(<ErrorState />);
    expect(screen.getByRole("alert")).toBeVisible();
  });

  test("a caller can add its own action beside the retry", async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} action={<button type="button">Go back</button>} />);
    expect(screen.getByRole("button", { name: "Go back" })).toBeVisible();
    expect(screen.getByRole("button", { name: /try again/i })).toBeVisible();
  });
});

describe("AccessDenied", () => {
  test("says what is refused, not what broke", () => {
    render(<AccessDenied />);
    expect(screen.getByText(/Access not permitted/i)).toBeVisible();
    expect(screen.queryByText(/went wrong/i)).toBeNull();
  });

  /* "Ask someone" is only actionable if it says what to ask for. */
  test("carries the reason it was refused", () => {
    render(<AccessDenied detail="This window belongs to another tenant." />);
    expect(screen.getByText("This window belongs to another tenant.")).toBeVisible();
  });

  test("offers no retry, because trying again changes nothing", () => {
    render(<AccessDenied />);
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });

  test("but takes an action the caller supplies", async () => {
    const onClose = vi.fn();
    render(<AccessDenied action={<button type="button" onClick={onClose}>Close this window</button>} />);
    await userEvent.click(screen.getByRole("button", { name: "Close this window" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("announces itself too", () => {
    render(<AccessDenied />);
    expect(screen.getByRole("alert")).toBeVisible();
  });
});

/* Three panels for three different situations, and a user should be able to tell
   which one they are looking at without reading the words. */
describe("the three states are distinguishable", () => {
  test("each says something the others do not", () => {
    const { unmount } = render(<EmptyState />);
    expect(screen.getByText(/No records found/i)).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
    unmount();

    render(<ErrorState />);
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.queryByText(/No records found/i)).toBeNull();
  });
});

describe("ErrorState — the roadmap's additions", () => {
  /* §6's other half. Internals never reach the screen, so without an id there
     is nothing for support to trace and "something went wrong" becomes the
     whole report. */
  test("shows a reference the user can quote", () => {
    render(<ErrorState referenceId="ERR-C84F21" />);
    expect(screen.getByText(/ERR-C84F21/)).toBeVisible();
  });

  test("says it is retrying rather than looking unpressed", () => {
    render(<ErrorState onRetry={() => undefined} retrying />);
    const button = screen.getByRole("button", { name: /trying/i });
    expect(button).toBeDisabled();
  });

  test("a warning severity is not drawn as a failure", () => {
    const { container } = render(<ErrorState severity="warning" />);
    expect(container.innerHTML).toContain("--warning");
  });
});

describe("NotFoundState", () => {
  /* Nothing failed: the system worked and the answer is that this does not
     exist. Offering "try again" would be a lie. */
  test("offers no retry", () => {
    render(<NotFoundState />);
    expect(screen.getByText(/does not exist/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });

  test("announces itself and can carry a reference", () => {
    render(<NotFoundState referenceId="ERR-000001" />);
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByText(/ERR-000001/)).toBeVisible();
  });
});

describe("ConflictState", () => {
  /* Reload, not retry. Retrying sends the same stale version again and gets
     the same refusal. */
  test("offers a reload rather than a retry", async () => {
    const onReload = vi.fn();
    render(<ConflictState onReload={onReload} />);
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /reload/i }));
    expect(onReload).toHaveBeenCalledOnce();
  });

  test("keeps the server's explanation", () => {
    /* The default description also contains that phrase, so the assertion has
       to name the detail itself. */
    render(<ConflictState detail="Version 12 was superseded by version 13." />);
    expect(screen.getByText(/Version 12 was superseded/)).toBeVisible();
  });
});

describe("SessionExpiredState", () => {
  test("offers sign-in, not retry", async () => {
    const onSignIn = vi.fn();
    render(<SessionExpiredState onSignIn={onSignIn} />);
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(onSignIn).toHaveBeenCalledOnce();
  });

  /* The first thing anyone wants to know when a session drops. */
  test("says what happens to unsaved work", () => {
    render(<SessionExpiredState />);
    expect(screen.getByText(/unsaved/i)).toBeVisible();
  });
});

describe("LoadingState", () => {
  /* role=status, not alert. An assertive interruption for "still working" is
     the announcement people switch off. */
  test("announces politely rather than interrupting", () => {
    render(<LoadingState />);
    expect(screen.getByRole("status")).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

/* Five panels, five situations. A user should be able to tell which one they
   are looking at, and a screen reader should be told which are events. */
describe("the family is distinguishable", () => {
  test("only the ones reporting a problem interrupt", () => {
    for (const [element, interrupts] of [
      [<EmptyState key="e" />, false],
      [<LoadingState key="l" />, false],
      [<ErrorState key="x" />, true],
      [<AccessDenied key="d" />, true],
      [<NotFoundState key="n" />, true],
      [<ConflictState key="c" />, true],
      [<SessionExpiredState key="s" />, true],
    ] as Array<[React.ReactElement, boolean]>) {
      const { unmount } = render(element);
      expect(screen.queryByRole("alert") !== null).toBe(interrupts);
      unmount();
    }
  });
});
