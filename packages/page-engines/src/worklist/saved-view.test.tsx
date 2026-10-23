import {render} from "../test/render";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { SavedViewScreen } from "./saved-view.tsx";

/* Sixteen hex, as randomBytes(8) actually produces. The roadmap's VW_7F83AB91
   is an eight-character illustration, and copying it into a fixture made every
   test look like a component fault. */
const view = { id: "VW_290B4AA4A3609A0F", pageId: "item-master", label: "Follow-ups", filters: { status: "waiting", recordName: "Maya Thomas" }, expiresAt: "2026-10-06T00:00:00.000Z" };
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
const fail = (status: number) => ({ ok: false, status, json: async () => ({ error: "no" }) }) as Response;

describe("SavedViewScreen", () => {
  test("shows what it is loading while it loads", () => {
    render(<SavedViewScreen viewId="VW_290B4AA4A3609A0F" fetchView={() => new Promise(() => undefined)} onOpen={() => undefined} />);
    expect(screen.getByRole("status")).toBeVisible();
  });

  test("hands the resolved filters to the caller", async () => {
    const onOpen = vi.fn();
    render(<SavedViewScreen viewId="VW_290B4AA4A3609A0F" fetchView={async () => ok(view)} onOpen={onOpen} />);
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(view));
  });

  /* Every refusal has to be a different screen, because the user's next action
     differs: sign in, ask someone, or give up. */
  test("a 401 asks the user to sign in, not to retry", async () => {
    render(<SavedViewScreen viewId="VW_290B4AA4A3609A0F" fetchView={async () => fail(401)} onOpen={() => undefined} />);
    await waitFor(() => expect(screen.getByText(/session has ended/i)).toBeVisible());
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });

  test("a 403 is a refusal, not a failure", async () => {
    render(<SavedViewScreen viewId="VW_290B4AA4A3609A0F" fetchView={async () => fail(403)} onOpen={() => undefined} />);
    await waitFor(() => expect(screen.getByText(/not permitted/i)).toBeVisible());
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });

  /* The important one. A view that expired, one from another tenant, and one
     that never existed all answer 404 — and the screen must not distinguish
     them either, or it hands back what the API deliberately withheld. */
  test("a 404 says nothing about which kind of 404 it was", async () => {
    render(<SavedViewScreen viewId="VW_290B4AA4A3609A0F" fetchView={async () => fail(404)} onOpen={() => undefined} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
    const shown = document.body.textContent ?? "";
    expect(shown).not.toMatch(/expired|another tenant|belongs to|deleted/i);
  });

  /* Each refusal is a DIFFERENT screen, and asserting only on the copy does not
     prove that: collapsing the switch so everything renders ErrorState left
     every test green, because a generic error simply shows neither phrase. The
     distinguishing signal is which affordance is offered. */
  test("each refusal offers its own next step, and only one of them", async () => {
    const cases = [
      [401, /sign in/i],
      [403, /^$/],
      [404, /^$/],
    ] as Array<[number, RegExp]>;
    for (const [status, expected] of cases) {
      const { unmount } = render(<SavedViewScreen viewId="VW_290B4AA4A3609A0F" fetchView={async () => fail(status)} onOpen={() => undefined} />);
      await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
      const buttons = screen.queryAllByRole("button").map((button) => button.textContent ?? "");
      expect(buttons.join(" ")).not.toMatch(/try again/i);
      if (expected.source !== "^$") expect(buttons.join(" ")).toMatch(expected);
      unmount();
    }
  });

  test("a server failure offers a retry, and retrying asks again", async () => {
    const fetchView = vi.fn().mockResolvedValueOnce(fail(503)).mockResolvedValueOnce(ok(view));
    const onOpen = vi.fn();
    render(<SavedViewScreen viewId="VW_290B4AA4A3609A0F" fetchView={fetchView} onOpen={onOpen} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /try again/i })).toBeVisible());
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(view));
  });

  test("a network failure offers a retry too", async () => {
    render(<SavedViewScreen viewId="VW_290B4AA4A3609A0F" fetchView={async () => { throw new Error("offline"); }} onOpen={() => undefined} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /try again/i })).toBeVisible());
  });

  /* A reference the user can quote, because the detail never reaches them. */
  test("a failure carries a reference", async () => {
    render(<SavedViewScreen viewId="VW_290B4AA4A3609A0F" fetchView={async () => fail(500)} onOpen={() => undefined} />);
    await waitFor(() => expect(screen.getByText(/ERR-/)).toBeVisible());
  });

  /* The id is the only thing in the URL. If the screen renders it, it is on
     screen and in a screenshot — and it is a bearer-ish token for that view. */
  test("does not print the view id back at the user", async () => {
    render(<SavedViewScreen viewId="VW_290B4AA4A3609A0F" fetchView={async () => fail(404)} onOpen={() => undefined} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
    expect(document.body.textContent).not.toContain("VW_290B4AA4A3609A0F");
  });

  test("a malformed id is refused without asking the server", async () => {
    const fetchView = vi.fn();
    render(<SavedViewScreen viewId="not-a-view-id" fetchView={fetchView} onOpen={() => undefined} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
    expect(fetchView).not.toHaveBeenCalled();
  });
});
