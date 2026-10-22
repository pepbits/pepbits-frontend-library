import { render, screen } from "./test/render";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { Segmented } from "./segmented";

const views = [{ value: "table", label: "Table" }, { value: "cards", label: "Cards" }];
const render_ = (over: Partial<Parameters<typeof Segmented>[0]> = {}) =>
  render(<Segmented label="Result view" options={views} value="table" onChange={() => undefined} {...over} />);

describe("Segmented", () => {
  /* A radiogroup, not a tablist — and the distinction is the reason both exist.
     A tab switches which panel you are looking at; this picks a value. Calling
     it a tablist tells a screen-reader user to expect panels that are not
     there. A host can have five of these that disagree about which it is. */
  test("it is a named radiogroup of radios", () => {
    render_();
    expect(screen.getByRole("radiogroup", { name: "Result view" })).toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  test("exactly one option reports as chosen", () => {
    render_();
    expect(screen.getByRole("radio", { name: "Table" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true")).toHaveLength(1);
  });

  test("clicking asks for that value", async () => {
    const onChange = vi.fn();
    render_({ onChange });
    await userEvent.click(screen.getByRole("radio", { name: "Cards" }));
    expect(onChange).toHaveBeenCalledWith("cards");
  });

  test("clicking the chosen one asks for nothing", async () => {
    const onChange = vi.fn();
    render_({ onChange });
    await userEvent.click(screen.getByRole("radio", { name: "Table" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  /* One tab stop for the group, arrows within it — the radio-group pattern.
     Without a roving tabindex a three-option control costs three tab presses
     to step over, and a toolbar of them becomes unusable by keyboard. */
  test("the group is one tab stop", async () => {
    render_();
    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "Table" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "Cards" })).not.toHaveFocus();
  });

  test("arrow keys move the choice and wrap", async () => {
    const onChange = vi.fn();
    render_({ onChange });
    screen.getByRole("radio", { name: "Table" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("cards");
    onChange.mockClear();
    await userEvent.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenCalledWith("cards");
  });

  /* Icon-only segments are the common case in a toolbar, and an icon has no
     text — so the label has to come from somewhere. */
  test("an icon-only option still has a name", () => {
    render_({ options: [{ value: "table", label: "Table", icon: <svg />, iconOnly: true }, ...views.slice(1)] });
    expect(screen.getByRole("radio", { name: "Table" })).toBeVisible();
  });

  test("a disabled option cannot be chosen", async () => {
    const onChange = vi.fn();
    render_({ options: [views[0]!, { ...views[1]!, disabled: true }], onChange });
    await userEvent.click(screen.getByRole("radio", { name: "Cards" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

test('an unanswered group remains keyboard reachable without preselecting a value',async()=>{
 render_({value:''});await userEvent.tab();expect(screen.getByRole('radio',{name:'Table'})).toHaveFocus();expect(screen.getAllByRole('radio').every(r=>r.getAttribute('aria-checked')==='false')).toBe(true);
});
