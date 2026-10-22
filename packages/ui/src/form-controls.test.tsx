import { render, screen } from "./test/render";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { Checkbox, FilePicker, Input, Radio, Select, Textarea, Toggle } from "./form-controls";

describe("Input", () => {
  /* FieldShell wraps the control in a <label>, so the label text IS the
     accessible name. If that wrapping ever changes to a sibling <span>, every
     field silently becomes unlabelled — visually identical, and unusable with a
     screen reader. getByLabelText is what notices. */
  test("its label names the field", () => {
    render(<Input label="Customer name" />);
    expect(screen.getByLabelText(/Customer name/)).toBeInTheDocument();
  });

  test("types through to the handler", async () => {
    const onChange = vi.fn();
    render(<Input label="Reference" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText(/Reference/), "abc");
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  /* An error must REPLACE the hint. Showing both leaves the reader deciding
     which one is current, and the hint usually reads like reassurance. */
  test("an error replaces the hint rather than joining it", () => {
    const { rerender } = render(<Input label="Email" hint="We never share it" />);
    expect(screen.getByText("We never share it")).toBeVisible();

    rerender(<Input label="Email" hint="We never share it" error="That is not an email address" />);
    expect(screen.getByText("That is not an email address")).toBeVisible();
    expect(screen.queryByText("We never share it")).toBeNull();
  });
});

describe("Select", () => {
  test("offers every option, and the placeholder", () => {
    render(<Select label="Status" options={[{ label: "Active", value: "a" }, { label: "On hold", value: "h" }]} onChange={() => undefined} value="" />);
    expect(screen.getByRole("option", { name: "Active" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "On hold" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Select…" })).toBeInTheDocument();
  });

  test("reports the chosen value", async () => {
    const onChange = vi.fn();
    render(<Select label="Status" options={[{ label: "Active", value: "a" }]} onChange={onChange} value="" />);
    await userEvent.selectOptions(screen.getByLabelText(/Status/), "a");
    expect(onChange).toHaveBeenCalledOnce();
  });
});

describe("Textarea", () => {
  test("shows what it was given", () => {
    render(<Textarea label="Notes" value="Seen in clinic" onChange={() => undefined} />);
    expect(screen.getByLabelText(/Notes/)).toHaveValue("Seen in clinic");
  });
});

describe("Toggle", () => {
  /* role="switch" with aria-checked is what makes this announce as on or off.
     Rebuilt as a styled div it would look identical and tell a screen-reader
     user nothing. */
  test("announces its state", () => {
    render(<Toggle label="Pinned" checked onChange={() => undefined} />);
    expect(screen.getByRole("switch", { name: /Pinned/ })).toBeChecked();
  });

  test("asks for the opposite of what it is", async () => {
    const onChange = vi.fn();
    render(<Toggle label="Pinned" checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test("a disabled toggle does not change", async () => {
    const onChange = vi.fn();
    render(<Toggle label="Pinned" checked={false} disabled onChange={onChange} />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
  });
});

/**
 * The three controls that were not components.
 *
 * A checkbox, a radio and a file picker were written by hand at each place that
 * needed one — five checkboxes and radios across four files, with four
 * different class strings for the same control, none of them carrying a focus
 * ring or a disabled state.
 */
describe("Checkbox", () => {
  test("is a real checkbox, so everything already knows what it is", () => {
    render(<Checkbox aria-label="Select row" />);
    const box = screen.getByRole("checkbox", { name: "Select row" });
    expect(box).toHaveAttribute("type", "checkbox");
  });

  test("labels itself when given a label", () => {
    render(<Checkbox label="Remember these filters" />);
    expect(screen.getByRole("checkbox", { name: "Remember these filters" })).toBeInTheDocument();
  });

  test("and stays bare when the caller labels it another way", () => {
    /* A table's select-all has an aria-label and no visible text. Wrapping it in
       an empty <label> would associate nothing and add a click target that does
       not look like one. */
    const { container } = render(<Checkbox aria-label="Select all visible records" />);
    expect(container.querySelector("label")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Select all visible records" })).toBeInTheDocument();
  });

  test("reports a change to the caller", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Include archived" onChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test("a disabled one cannot be changed", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Include archived" disabled onChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onChange).not.toHaveBeenCalled();
  });

  /* `indeterminate` is a DOM property with no HTML attribute, which is why a
     partly-selected "select all" is so often drawn as simply unchecked — the
     markup has no way to say it. */
  test("can say that it is partly selected", () => {
    render(<Checkbox aria-label="Select all" indeterminate />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).indeterminate).toBe(true);
  });

  test("and stops saying so once it is fully selected", () => {
    render(<Checkbox aria-label="Select all" indeterminate checked onChange={() => {}} />);
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(box.indeterminate).toBe(false);
  });

  test("describes itself, for the rows that need a second line", () => {
    render(<Checkbox label="Archive" description="They leave every worklist until restored." />);
    expect(screen.getByText("They leave every worklist until restored.")).toBeInTheDocument();
  });
});

describe("Radio", () => {
  test("is a real radio", () => {
    render(<Radio aria-label="Level 3" name="em" />);
    expect(screen.getByRole("radio", { name: "Level 3" })).toHaveAttribute("type", "radio");
  });

  /* `name` is what makes arrow keys move between the options of ONE group
     rather than every radio on the page, which is the whole reason a radio is
     not a checkbox. */
  test("carries the group name it was given", () => {
    render(<><Radio label="Low" name="acuity" value="low" /><Radio label="High" name="acuity" value="high" /></>);
    for (const option of screen.getAllByRole("radio")) expect(option).toHaveAttribute("name", "acuity");
  });

  test("only one of a group is chosen at a time", async () => {
    render(<><Radio label="Low" name="acuity" value="low" /><Radio label="High" name="acuity" value="high" /></>);
    await userEvent.click(screen.getByRole("radio", { name: "High" }));
    expect((screen.getByRole("radio", { name: "High" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: "Low" }) as HTMLInputElement).checked).toBe(false);
  });
});

describe("FilePicker", () => {
  test("offers a button, not a file input nobody can style", () => {
    render(<FilePicker label="Import" onFile={() => {}} />);
    expect(screen.getByRole("button", { name: "Import" })).toBeInTheDocument();
  });

  /* Hidden, not absent: a detached input cannot be clicked, and clicking it is
     the entire mechanism. */
  test("keeps the real input in the document", () => {
    const { container } = render(<FilePicker label="Import" accept=".csv" onFile={() => {}} />);
    const input = container.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("accept", ".csv");
  });

  test("hands the chosen file to the caller", async () => {
    const onFile = vi.fn();
    const { container } = render(<FilePicker label="Import" onFile={onFile} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(["a,b"], "rows.csv", { type: "text/csv" }));
    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile.mock.calls[0]![0].name).toBe("rows.csv");
  });

  /* Cleared after every choice: picking the same file twice is not a change
     event, so without this the second attempt does nothing at all. */
  test("clears itself, so the same file can be chosen twice", async () => {
    const onFile = vi.fn();
    const { container } = render(<FilePicker label="Import" onFile={onFile} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["a,b"], "rows.csv", { type: "text/csv" });
    await userEvent.upload(input, file);
    expect(input.value).toBe("");
    await userEvent.upload(input, file);
    expect(onFile).toHaveBeenCalledTimes(2);
  });
});

/**
 * The hint and the error belong to the DESCRIPTION, not to the name.
 *
 * They used to be inside the wrapping <label>, which put them in the field's
 * accessible name: a screen reader read "Credit limit maximum exposure
 * permitted" as the name of the box, and on a field in error it read the error
 * as part of the name — permanently, because a name is not a state.
 */
describe("a field's name and its description", () => {
  test("the name is the label alone", () => {
    render(<Input label="Credit limit" hint="Maximum exposure permitted." />);
    expect(screen.getByRole("textbox", { name: "Credit limit" })).toBeInTheDocument();
  });

  test("the hint is a description, and reachable", () => {
    render(<Input label="Credit limit" hint="Maximum exposure permitted." />);
    expect(screen.getByRole("textbox", { name: "Credit limit" })).toHaveAccessibleDescription("Maximum exposure permitted.");
  });

  test("an error describes the field without renaming it", () => {
    render(<Input label="Credit limit" error="Must be a number." />);
    const field = screen.getByRole("textbox", { name: "Credit limit" });
    expect(field).toHaveAccessibleDescription("Must be a number.");
  });

  test("a select says the same", () => {
    render(<Select label="Branch" hint="Where the record belongs." options={[{ label: "Primary", value: "primary" }]} />);
    expect(screen.getByRole("combobox", { name: "Branch" })).toHaveAccessibleDescription("Where the record belongs.");
  });

  /* A caller that already points at a note of its own keeps it — the filter bar
     describes its sensitive fields that way. */
  test("a caller's own description is kept alongside", () => {
    render(<><span id="own">Kept out of the link.</span><Input label="Search" aria-describedby="own" hint="Any visible value." /></>);
    expect(screen.getByRole("textbox", { name: "Search" }).getAttribute("aria-describedby")).toContain("own");
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveAccessibleDescription(/Kept out of the link/);
  });

  test("a field with neither points at nothing", () => {
    render(<Input label="Reference" />);
    expect(screen.getByRole("textbox", { name: "Reference" })).not.toHaveAttribute("aria-describedby");
  });
});
