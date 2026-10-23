import { render, screen } from "./test/render";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { ActionMenu, DropdownSelect, MenuButton } from "./dropdown";

const priorities = [
  { value: "normal", label: "NRM", description: "Normal" },
  { value: "high", label: "HI", description: "High priority" },
  { value: "low", label: "LOW", description: "Low priority" },
  { value: "highest", label: "TOP", description: "Highest priority" },
];

const trigger = () => screen.getByRole("button", { name: /^Priority / });

describe("DropdownSelect", () => {
  test("the trigger shows the selection and is named by its label", () => {
    render(<DropdownSelect label="Priority" value="high" options={priorities} onChange={() => undefined} />);
    expect(trigger()).toHaveTextContent("HI");
    expect(trigger().textContent).toBe("Priority HI");
    expect(trigger()).toHaveAccessibleName("Priority HI");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  /* hideLabel drops the visible text, not the name -- the control still has to
     announce as "Choice" rather than as whichever place happens to be picked. */
  test("hideLabel keeps the accessible name and drops the visible one", () => {
    render(<DropdownSelect label="Choice" hideLabel value="high" options={priorities} onChange={() => undefined} />);
    const button = screen.getByRole("button", { name: /^Choice / });
    expect(button).toHaveTextContent("HI");
    expect(button).toHaveAccessibleName("Choice HI");
    expect(button).not.toHaveTextContent("Choice");
  });

  test("ArrowDown opens it from the trigger", async () => {
    render(<DropdownSelect label="Priority" value="normal" options={priorities} onChange={() => undefined} />);
    trigger().focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });

  /* Priorities are stored by short code. Nobody types "LOW" looking for the
     low priority option -- they type "low priority", which is only in the
     description. */
  test("filtering searches the description as well as the label", async () => {
    render(<DropdownSelect label="Priority" value="normal" options={priorities} onChange={() => undefined} />);
    await userEvent.click(trigger());
    await userEvent.keyboard("low priority");
    expect(screen.getByRole("option")).toHaveTextContent("LOW");
  });

  test("the matched text is marked in whichever field matched", async () => {
    const { container } = render(<DropdownSelect label="Priority" value="normal" options={priorities} onChange={() => undefined} />);
    await userEvent.click(trigger());
    await userEvent.keyboard("high priority");
    expect(container.querySelector("mark")).toHaveTextContent("High priority");
  });

  /* The reason the keyboard was worth rebuilding: Enter used to fire only when
     exactly one option was left, so with two matches the keys did nothing. */
  test("Enter takes the highlighted option, not only a sole survivor", async () => {
    const onChange = vi.fn();
    render(<DropdownSelect label="Priority" value="normal" options={priorities} onChange={onChange} />);
    await userEvent.click(trigger());
    await userEvent.keyboard("h");
    expect(screen.getAllByRole("option").length).toBeGreaterThan(1);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("highest");
  });

  test("Escape closes it without choosing anything", async () => {
    const onChange = vi.fn();
    render(<DropdownSelect label="Priority" value="normal" options={priorities} onChange={onChange} />);
    await userEvent.click(trigger());
    await userEvent.keyboard("{Escape}");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(onChange).not.toHaveBeenCalled();
  });

  /* Reopening a menu that kept its old query looks like options going missing. */
  test("the search box is empty again next time it opens", async () => {
    render(<DropdownSelect label="Priority" value="normal" options={priorities} onChange={() => undefined} />);
    await userEvent.click(trigger());
    await userEvent.keyboard("high priority");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await userEvent.keyboard("{Escape}");
    await userEvent.click(trigger());
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });

  test("says so when nothing matches", async () => {
    render(<DropdownSelect label="Priority" value="normal" options={priorities} onChange={() => undefined} />);
    await userEvent.click(trigger());
    await userEvent.keyboard("zzzz");
    expect(screen.queryByRole("option")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("No matching options");
  });
});

describe("ActionMenu", () => {
  test("opens on its trigger and closes when an item runs", async () => {
    const onClick = vi.fn();
    render(<ActionMenu trigger={<span>Actions</span>}>{(close) => <MenuButton label="Export" onClick={() => { onClick(); close(); }} />}</ActionMenu>);
    expect(screen.queryByText("Export")).toBeNull();
    await userEvent.click(screen.getByText("Actions"));
    await userEvent.click(screen.getByText("Export"));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByText("Export")).toBeNull();
  });
});

test('empty authorized options render safely while the host loads access',()=>{
 render(<DropdownSelect label="Choice" value="" options={[]} onChange={()=>undefined}/>);
 expect(screen.getByRole('button',{name:/^Choice /})).toHaveTextContent('—');
});
