import {format} from "./test/format";
import { render, screen, waitFor } from "./test/render";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { InlineEdit } from "./inline-edit";

const render_ = (over: Partial<Parameters<typeof InlineEdit>[0]> = {}) =>
  render(<InlineEdit label="Credit limit" value="50000" display={format.money(50000)} onCommit={() => undefined} {...over} />);

const cell = () => screen.getByRole("button", { name: /Credit limit/ });
const field = () => screen.getByRole("textbox", { name: /Credit limit/ });

describe("InlineEdit — reading", () => {
  /* Idle, it is a button. A div with an onClick is invisible to the keyboard
     and announces as nothing, which in a table of two hundred cells means the
     feature does not exist for anyone not using a mouse. */
  test("shows the formatted value and is reachable by keyboard", () => {
    render_();
    expect(cell()).toHaveTextContent(format.money(50000));
    expect(cell()).toHaveAccessibleName(`Credit limit: ${format.money(50000)}`);
  });

  test("names a rich formatted display while editing the raw value", async () => {
    render_({display: <strong>{format.money(50000)}</strong>});
    expect(cell()).toHaveAccessibleName(`Credit limit: ${format.money(50000)}`);
    await userEvent.click(cell());
    expect(field()).toHaveValue("50000");
  });

  test("a read-only cell offers no editing at all", () => {
    render_({ disabled: true });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(format.money(50000))).toBeVisible();
  });
});

describe("InlineEdit — editing", () => {
  test("clicking opens an input carrying the current value", async () => {
    render_();
    await userEvent.click(cell());
    expect(field()).toHaveValue("50000");
  });

  test("Enter opens it too, so the keyboard is not a second-class path", async () => {
    render_();
    cell().focus();
    await userEvent.keyboard("{Enter}");
    expect(field()).toBeVisible();
  });

  test("Enter commits what was typed", async () => {
    const onCommit = vi.fn();
    render_({ onCommit });
    await userEvent.click(cell());
    await userEvent.clear(field());
    await userEvent.type(field(), "75000{Enter}");
    expect(onCommit).toHaveBeenCalledWith("75000");
  });

  /* Every grid anyone has used commits on blur. Cancelling instead would lose
     work for the ordinary mistake of clicking away. */
  test("clicking away commits as well", async () => {
    const onCommit = vi.fn();
    render_({ onCommit });
    await userEvent.click(cell());
    await userEvent.clear(field());
    await userEvent.type(field(), "75000");
    await userEvent.tab();
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith("75000"));
  });

  test("Escape puts it back and writes nothing", async () => {
    const onCommit = vi.fn();
    render_({ onCommit });
    await userEvent.click(cell());
    await userEvent.clear(field());
    await userEvent.type(field(), "75000{Escape}");
    expect(onCommit).not.toHaveBeenCalled();
    expect(cell()).toHaveTextContent(format.money(50000));
  });

  /* An unchanged value must not write. A save that bumps the version and lands
     in the audit log because someone tabbed through a cell is noise that makes
     both harder to read — and it is a conflict for whoever holds v14. */
  test("committing an unchanged value writes nothing", async () => {
    const onCommit = vi.fn();
    render_({ onCommit });
    await userEvent.click(cell());
    expect(field()).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  /* Clicking a cell has to leave the caret in it. Without this the editor opens
     and the keyboard cannot reach it, which is how the test above passed while
     the rule it names was deleted. */
  test("clicking a cell puts the caret in it, with the value selected", async () => {
    render_();
    await userEvent.click(cell());
    expect(field()).toHaveFocus();
    await userEvent.keyboard("75000");
    expect(field()).toHaveValue("75000");
  });
});

describe("InlineEdit — validation", () => {
  const notNegative = (next: string) => (Number(next) < 0 ? "A credit limit cannot be negative." : null);

  /* The drawback this component had to answer: an error has nowhere to sit in a
     table cell. It stays in edit mode and says so beside the field, rather than
     closing and leaving the value silently unchanged. */
  test("a rejected value keeps the field open and explains itself", async () => {
    const onCommit = vi.fn();
    render_({ onCommit, validate: notNegative });
    await userEvent.click(cell());
    await userEvent.clear(field());
    await userEvent.type(field(), "-5{Enter}");
    expect(onCommit).not.toHaveBeenCalled();
    expect(field()).toBeVisible();
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(/cannot be negative/);
  });

  test("fixing it commits", async () => {
    const onCommit = vi.fn();
    render_({ onCommit, validate: notNegative });
    await userEvent.click(cell());
    await userEvent.clear(field());
    await userEvent.type(field(), "-5{Enter}");
    await userEvent.clear(field());
    await userEvent.type(field(), "75000{Enter}");
    expect(onCommit).toHaveBeenCalledWith("75000");
  });

  test("an invalid value does not escape through a blur either", async () => {
    const onCommit = vi.fn();
    render_({ onCommit, validate: notNegative });
    await userEvent.click(cell());
    await userEvent.clear(field());
    await userEvent.type(field(), "-5");
    await userEvent.tab();
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeVisible();
  });
});

describe("InlineEdit — saving and conflict", () => {
  test("it says it is saving, and refuses a second commit meanwhile", async () => {
    let release: (() => void) | undefined;
    const onCommit = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    render_({ onCommit });
    await userEvent.click(cell());
    await userEvent.clear(field());
    await userEvent.type(field(), "75000{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent(/saving/i);
    await userEvent.keyboard("{Enter}");
    expect(onCommit).toHaveBeenCalledTimes(1);
    release?.();
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  /* §20's answer to two people editing one cell: the server refuses a write
     against a stale version. What must not happen is the edit vanishing —
     the typed value stays put so it can be retried or copied out. */
  test("a rejected save keeps the typed value and shows why", async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error("Changed by someone else since you opened it."));
    render_({ onCommit });
    await userEvent.click(cell());
    await userEvent.clear(field());
    await userEvent.type(field(), "75000{Enter}");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/someone else/));
    expect(field()).toHaveValue("75000");
  });

  test("a successful save closes the editor and shows the new value", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render_({ onCommit });
    await userEvent.click(cell());
    await userEvent.clear(field());
    await userEvent.type(field(), "75000{Enter}");
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    rerender(<InlineEdit label="Credit limit" value="75000" display={format.money(75000)} onCommit={onCommit} />);
    expect(cell()).toHaveTextContent(format.money(75000));
  });
});
