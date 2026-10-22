import { render, screen } from "./test/render";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { Tabs } from "./tabs";

const items = [{ id: "a", label: "Behaviour" }, { id: "b", label: "Shell" }, { id: "c", label: "General" }];

describe("Tabs", () => {
  /* aria-selected is what tells a screen reader which tab you are on. Styled
     with a coloured underline alone, the tablist announces three identical tabs
     and never says which is current. */
  test("marks exactly one tab as selected", () => {
    render(<Tabs items={items} value="b" onChange={() => undefined} />);
    expect(screen.getByRole("tab", { name: "Shell" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("tab").filter((t) => t.getAttribute("aria-selected") === "true")).toHaveLength(1);
  });

  test("asks for the tab that was clicked", async () => {
    const onChange = vi.fn();
    render(<Tabs items={items} value="a" onChange={onChange} />);
    await userEvent.click(screen.getByRole("tab", { name: "General" }));
    expect(onChange).toHaveBeenCalledWith("c");
  });

  test("a vertical tablist says so", () => {
    render(<Tabs items={items} value="a" orientation="vertical" onChange={() => undefined} />);
    expect(screen.getByRole("tablist")).toHaveAttribute("aria-orientation", "vertical");
  });
});
