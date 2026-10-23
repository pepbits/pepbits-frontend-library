import { render, screen } from "./test/render";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { SearchSelect } from "./search-select";

const currencies = [
  { value: "gbp", label: "GBP", description: "British pound" },
  { value: "usd", label: "USD", description: "US dollar" },
  { value: "eur", label: "EUR", description: "Euro" },
  { value: "sar", label: "SAR", description: "Saudi riyal" },
];

function open() {
  return userEvent.click(screen.getByRole("button", { name: /currency/i }));
}

describe("SearchSelect", () => {
  test("shows the placeholder until something is chosen", () => {
    const { rerender } = render(<SearchSelect label="Currency" options={currencies} value="" onChange={() => undefined} placeholder="Pick one…" />);
    expect(screen.getByRole("button", { name: /currency/i })).toHaveTextContent("Pick one…");
    rerender(<SearchSelect label="Currency" options={currencies} value="usd" onChange={() => undefined} placeholder="Pick one…" />);
    expect(screen.getByRole("button", { name: /currency/i })).toHaveTextContent("USD");
  });

  test("the trigger says whether the list is open", async () => {
    render(<SearchSelect label="Currency" options={currencies} value="" onChange={() => undefined} />);
    const trigger = screen.getByRole("button", { name: /currency/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await open();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });

  test("typing narrows the list", async () => {
    render(<SearchSelect label="Currency" options={currencies} value="" onChange={() => undefined} />);
    await open();
    await userEvent.keyboard("riyal");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option")).toHaveTextContent("SAR");
  });

  /* The reason this component exists. Before it, Enter fired only when exactly
     one match was left, so between four matches and one the keyboard did
     nothing at all and a user had to reach for the mouse to finish. */
  test("arrow keys move the highlight and Enter takes it", async () => {
    const onChange = vi.fn();
    render(<SearchSelect label="Currency" options={currencies} value="" onChange={onChange} />);
    await open();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("eur");
  });

  test("Enter commits with several matches still on screen", async () => {
    const onChange = vi.fn();
    render(<SearchSelect label="Currency" options={currencies} value="" onChange={onChange} />);
    await open();
    await userEvent.keyboard("d");
    expect(screen.getAllByRole("option").length).toBeGreaterThan(1);
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("gbp");
  });

  /* Opening lands on the current selection so the first ArrowDown steps OFF
     what is already chosen, the way a native <select> behaves. Every arrow
     count below is one short of what it would be starting from nowhere. */
  test("opening lands the highlight on what is already selected", async () => {
    render(<SearchSelect label="Currency" options={currencies} value="eur" onChange={() => undefined} />);
    await open();
    const active = screen.getByRole("combobox").getAttribute("aria-activedescendant");
    expect(screen.getByRole("option", { name: /Euro/ })).toHaveAttribute("id", active);
  });

  /* Parking the highlight on a row Enter refuses reads as the keyboard having
     stopped working, not as that row being unavailable. */
  test("the highlight steps over a disabled option", async () => {
    const onChange = vi.fn();
    const withClosed = [currencies[0]!, { ...currencies[1]!, disabled: true }, currencies[2]!];
    render(<SearchSelect label="Currency" options={withClosed} value="" onChange={onChange} />);
    await open();
    expect(screen.getByRole("option", { name: /US dollar/ })).toHaveAttribute("aria-disabled", "true");
    /* One step from the pre-homed GBP: USD is skipped, EUR is next. */
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("eur");
  });

  test("Escape closes it and changes nothing", async () => {
    const onChange = vi.fn();
    render(<SearchSelect label="Currency" options={currencies} value="usd" onChange={onChange} />);
    await open();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("option")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  test("clicking an option chooses it", async () => {
    const onChange = vi.fn();
    render(<SearchSelect label="Currency" options={currencies} value="" onChange={onChange} />);
    await open();
    await userEvent.click(screen.getByRole("option", { name: /Saudi riyal/ }));
    expect(onChange).toHaveBeenCalledWith("sar");
  });

  test("exactly one option reports as selected", async () => {
    render(<SearchSelect label="Currency" options={currencies} value="eur" onChange={() => undefined} />);
    await open();
    const selected = screen.getAllByRole("option").filter((o) => o.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent("EUR");
  });

  /* Filtering is otherwise a purely visual event: a screen-reader user typing
     into the box would get no signal that the list moved under them. */
  test("announces how many options are left", async () => {
    render(<SearchSelect label="Currency" options={currencies} value="" onChange={() => undefined} />);
    await open();
    expect(screen.getByRole("status")).toHaveTextContent("4 options");
    await userEvent.keyboard("riyal");
    expect(screen.getByRole("status")).toHaveTextContent("1 option");
    await userEvent.keyboard("zzz");
    expect(screen.getByRole("status")).toHaveTextContent("No matching options");
  });

  test("says so when nothing matches", async () => {
    render(<SearchSelect label="Currency" options={currencies} value="" onChange={() => undefined} />);
    await open();
    await userEvent.keyboard("zzzz");
    expect(screen.queryByRole("option")).toBeNull();
    expect(screen.getByText(/No match for/)).toBeVisible();
  });

  /* Replacing a <select> inside a plain <form> has to keep submitting a value,
     or the field silently contributes nothing and the record saves incomplete. */
  test("carries its value for form submission", () => {
    const { container } = render(<SearchSelect label="Currency" name="currency" options={currencies} value="sar" onChange={() => undefined} />);
    expect(container.querySelector('input[type="hidden"][name="currency"]')).toHaveValue("sar");
  });

  test("shows an error instead of the hint", () => {
    render(<SearchSelect label="Currency" hint="Used on every invoice" error="Choose a currency" options={currencies} value="" onChange={() => undefined} />);
    expect(screen.getByText("Choose a currency")).toBeVisible();
    expect(screen.queryByText("Used on every invoice")).toBeNull();
  });
});

test('trigger name includes the visible selected value for speech input',()=>{
 render(<SearchSelect label="Currency" value="usd" options={[{value:'usd',label:'USD'}]} onChange={()=>{}}/>);
 expect(screen.getByRole('button',{name:'Currency USD'})).toBeVisible();
});
