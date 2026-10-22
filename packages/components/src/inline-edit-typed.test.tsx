import {format} from "./test/format";
import { render, screen, waitFor } from "./test/render";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { InlineEditDate, InlineEditNumber, InlineEditSelect, InlineEditStatus } from "./inline-edit";

const cell = (label: string) => screen.getByRole("button", { name: new RegExp(label) });

describe("InlineEditNumber", () => {
  const render_ = (over: Partial<Parameters<typeof InlineEditNumber>[0]> = {}) =>
    render(<InlineEditNumber label="Credit limit" value={50000} display={format.money(50000)} onCommit={() => undefined} {...over} />);

  test("commits a number, not a string", async () => {
    const onCommit = vi.fn();
    render_({ onCommit });
    await userEvent.click(cell("Credit limit"));
    await userEvent.clear(screen.getByRole("spinbutton", { name: "Credit limit" }));
    await userEvent.type(screen.getByRole("spinbutton", { name: "Credit limit" }), "75000{Enter}");
    expect(onCommit).toHaveBeenCalledWith(75000);
  });

  /* A text box that happens to hold digits is not a number field: it gives no
     numeric keyboard on a phone, no spinner, and no step keys. */
  test("it is a spinbutton, not a text box", async () => {
    render_();
    await userEvent.click(cell("Credit limit"));
    expect(screen.getByRole("spinbutton", { name: "Credit limit" })).toBeVisible();
  });

  test("refuses something that is not a number", async () => {
    const onCommit = vi.fn();
    render_({ onCommit });
    await userEvent.click(cell("Credit limit"));
    await userEvent.clear(screen.getByRole("spinbutton", { name: "Credit limit" }));
    await userEvent.type(screen.getByRole("spinbutton", { name: "Credit limit" }), "abc{Enter}");
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeVisible();
  });

  /* Bounds are the point of a typed editor: a credit limit of -5 or 10^12 is a
     data-entry slip, and catching it here is cheaper than a 422 round trip. */
  test("holds to its bounds, and says which one was crossed", async () => {
    const onCommit = vi.fn();
    render_({ onCommit, min: 0, max: 100000 });
    await userEvent.click(cell("Credit limit"));
    const field = screen.getByRole("spinbutton", { name: "Credit limit" });
    await userEvent.clear(field);
    await userEvent.type(field, "-5{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent(/0/);
    await userEvent.clear(field);
    await userEvent.type(field, "999999{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent(/100000|100,000/);
    expect(onCommit).not.toHaveBeenCalled();
  });

  test("a caller's own rule runs as well", async () => {
    const onCommit = vi.fn();
    render_({ onCommit, validate: (next) => (next % 1000 === 0 ? null : "Round to the nearest thousand.") });
    await userEvent.click(cell("Credit limit"));
    await userEvent.clear(screen.getByRole("spinbutton", { name: "Credit limit" }));
    await userEvent.type(screen.getByRole("spinbutton", { name: "Credit limit" }), "75500{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent(/nearest thousand/);
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe("InlineEditSelect", () => {
  const options = [{ value: "low", label: "Low" }, { value: "normal", label: "Normal" }, { value: "high", label: "High" }];
  const render_ = (over: Partial<Parameters<typeof InlineEditSelect>[0]> = {}) =>
    render(<InlineEditSelect label="Priority" value="normal" options={options} onCommit={() => undefined} {...over} />);

  /* A free-text box for a fixed set invites values the system does not accept,
     and finds out at the server. */
  test("offers the options rather than a text box", async () => {
    render_();
    await userEvent.click(cell("Priority"));
    const field = screen.getByRole("combobox", { name: "Priority" });
    expect(field).toBeVisible();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  test("shows the LABEL when idle, and commits the VALUE", async () => {
    const onCommit = vi.fn();
    render_({ onCommit });
    expect(cell("Priority")).toHaveTextContent("Normal");
    await userEvent.click(cell("Priority"));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Priority" }), "high");
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith("high"));
  });

  /* Choosing IS the commit for a select: there is nothing more to type, and
     making someone press Enter after picking is a step that exists only
     because the text editor needed one. */
  test("choosing commits without a second keystroke", async () => {
    const onCommit = vi.fn();
    render_({ onCommit });
    await userEvent.click(cell("Priority"));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Priority" }), "low");
    await waitFor(() => expect(onCommit).toHaveBeenCalledOnce());
  });

  test("Escape leaves it as it was", async () => {
    const onCommit = vi.fn();
    render_({ onCommit });
    await userEvent.click(cell("Priority"));
    await userEvent.keyboard("{Escape}");
    expect(onCommit).not.toHaveBeenCalled();
    expect(cell("Priority")).toHaveTextContent("Normal");
  });
});

describe("InlineEditDate", () => {
  const render_ = (over: Partial<Parameters<typeof InlineEditDate>[0]> = {}) =>
    render(<InlineEditDate label="Due date" value="2026-09-30" onCommit={() => undefined} {...over} />);

  test("edits as a date, not as text", async () => {
    const { container } = render_();
    await userEvent.click(cell("Due date"));
    expect(container.querySelector('input[type="date"]')).not.toBeNull();
  });

  test("refuses a date outside its window", async () => {
    const onCommit = vi.fn();
    render_({ onCommit, min: "2026-09-01", max: "2026-09-30" });
    await userEvent.click(cell("Due date"));
    const field = screen.getByLabelText("Due date");
    await userEvent.clear(field);
    await userEvent.type(field, "2026-12-25{Enter}");
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeVisible();
  });

  test("commits an ISO date", async () => {
    const onCommit = vi.fn();
    render_({ onCommit });
    await userEvent.click(cell("Due date"));
    const field = screen.getByLabelText("Due date");
    await userEvent.clear(field);
    await userEvent.type(field, "2026-10-15{Enter}");
    expect(onCommit).toHaveBeenCalledWith("2026-10-15");
  });
});

describe("InlineEditStatus", () => {
  const options = [{ value: "draft", label: "Draft" }, { value: "posted", label: "Posted" }, { value: "void", label: "Void" }];
  const render_ = (over: Partial<Parameters<typeof InlineEditStatus>[0]> = {}) =>
    render(<InlineEditStatus label="Status" value="draft" options={options} onCommit={() => undefined} {...over} />);

  test("reads as a badge when idle", () => {
    render_();
    expect(cell("Status")).toHaveTextContent("Draft");
  });

  /* Status is the one field on this list that usually has a workflow behind
     it. Offering every value and letting the server refuse is a worse
     experience than not offering the ones that cannot happen. */
  test("offers only the transitions that are allowed", async () => {
    render_({ allowedTransitions: { draft: ["posted"], posted: ["void"], void: [] } });
    await userEvent.click(cell("Status"));
    const labels = screen.getAllByRole("option").map((option) => option.textContent);
    expect(labels).toContain("Posted");
    expect(labels).not.toContain("Void");
  });

  test("a status with nowhere to go cannot be edited at all", () => {
    render_({ value: "void", allowedTransitions: { draft: ["posted"], posted: ["void"], void: [] } });
    expect(screen.queryByRole("button", { name: /Status/ })).toBeNull();
    expect(screen.getByText("Void")).toBeVisible();
  });

  test("without a transition map, anything may be chosen", async () => {
    render_();
    await userEvent.click(cell("Status"));
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });
});

/* All four keep what the generic editor established, because they are the same
   state machine underneath. */
describe("the shared behaviour survives", () => {
  test("a rejected save keeps the typed value and shows why", async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error("Changed by someone else."));
    render(<InlineEditNumber label="Credit limit" value={1} onCommit={onCommit} />);
    await userEvent.click(cell("Credit limit"));
    await userEvent.clear(screen.getByRole("spinbutton", { name: "Credit limit" }));
    await userEvent.type(screen.getByRole("spinbutton", { name: "Credit limit" }), "2{Enter}");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/someone else/));
    expect(screen.getByRole("spinbutton", { name: "Credit limit" })).toHaveValue(2);
  });

  test("an unchanged value writes nothing", async () => {
    const onCommit = vi.fn();
    render(<InlineEditNumber label="Credit limit" value={50} onCommit={onCommit} />);
    await userEvent.click(cell("Credit limit"));
    await userEvent.keyboard("{Enter}");
    expect(onCommit).not.toHaveBeenCalled();
  });

  test("a disabled field offers no editing", () => {
    render(<InlineEditNumber label="Credit limit" value={50} disabled onCommit={() => undefined} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
