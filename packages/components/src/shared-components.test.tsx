import React from "react";
import { fireEvent, render, screen } from "./test/render";
import { describe, expect, test, vi } from "vitest";
import { Calendar } from "./calendar";
import { DateInput, DateRangeInput, DateTimeInput, TimeInput } from "@pepbits/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { DataValue, DescriptionList } from "./data-value";
import { Card, CardGrid } from "./card";
import { LocalizationProvider } from "@pepbits/i18n/react";

describe("shared date controls", () => {
  test("preserves ISO payloads, labels, constraints and disabled state", () => {
    const change = vi.fn();
    render(<><DateInput label="Start" value="2026-09-08" onChange={change} min="2026-09-01" /><TimeInput label="Time" defaultValue="09:30" disabled /><DateTimeInput label="Appointment" defaultValue="2026-09-08T09:30" /></>);
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "2026-09-10" } });
    expect(change).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Start")).toHaveAttribute("min", "2026-09-01");
    expect(screen.getByLabelText("Time")).toBeDisabled();
    expect(screen.getByLabelText("Appointment")).toHaveValue("2026-09-08T09:30");
  });
  test("range constraints preserve tighter caller bounds", () => {
    render(<DateRangeInput start={{label:"From",value:"2026-09-08",max:"2026-09-12",onChange:()=>{}}} end={{label:"Until",value:"2026-09-15",min:"2026-09-10",onChange:()=>{}}} />);
    expect(screen.getByLabelText("From")).toHaveAttribute("max", "2026-09-12");
    expect(screen.getByLabelText("Until")).toHaveAttribute("min", "2026-09-10");
  });
});

describe("Calendar", () => {
  test("selects leap day, respects bounds and uses date-only values", () => {
    const change = vi.fn();
    render(<Calendar label="Choose date" locale="en-US" value="2024-02-28" min="2024-02-28" max="2024-02-29" onChange={change} />);
    expect(screen.getByRole("button", {name:"Tuesday, February 27, 2024"})).toBeDisabled();
    fireEvent.click(screen.getByRole("button", {name:"Thursday, February 29, 2024"}));
    expect(change).toHaveBeenCalledWith("2024-02-29");
    expect(screen.getByRole("button", {name:"Next"})).toBeDisabled();
    expect(screen.getByRole("button", {name:"Previous"})).toBeDisabled();
  });
  test("keyboard navigation crosses months without submitting or selecting", () => {
    const change = vi.fn();
    render(<Calendar label="Choose date" locale="en-US" value="2026-09-30" onChange={change} />);
    fireEvent.keyDown(screen.getByRole("button", {name:"Wednesday, September 30, 2026"}), {key:"ArrowRight"});
    expect(screen.getByRole("button", {name:"Thursday, October 1, 2026"})).toHaveFocus();
    expect(screen.getByRole("table")).toHaveAttribute("aria-label", "October 2026");
    expect(change).not.toHaveBeenCalled();
  });
  test("RTL keyboard direction and translated navigation labels", () => {
    render(<LocalizationProvider value={{language:"ar",direction:"rtl",t:key=>key === "ui.next.1ff57a29" ? "التالي" : key,dateTime:String}}><Calendar locale="en-US" label="date" value="2026-09-08" onChange={()=>{}} /></LocalizationProvider>);
    expect(screen.getByRole("button",{name:"التالي"})).toBeVisible();
    fireEvent.keyDown(screen.getByRole("button",{name:"Tuesday, September 8, 2026"}),{key:"ArrowLeft"});
    expect(screen.getByRole("button",{name:"Wednesday, September 9, 2026"})).toHaveFocus();
  });
});

test("table composition preserves classification, spans, sorting semantics and events", () => {
  const click = vi.fn();
  render(<Table aria-label="Records" striped density="compact"><TableHeader><TableRow><TableHead scope="col" aria-sort="ascending">Amount</TableHead></TableRow></TableHeader><TableBody><TableRow onClick={click}><TableCell data-classification="sensitive" colSpan={2}>42</TableCell></TableRow></TableBody></Table>);
  expect(screen.getByRole("columnheader")).toHaveAttribute("aria-sort", "ascending");
  expect(screen.getByRole("cell")).toHaveAttribute("data-classification", "sensitive");
  expect(screen.getByRole("cell")).toHaveAttribute("colspan", "2");
  fireEvent.click(screen.getByRole("cell")); expect(click).toHaveBeenCalledOnce();
});

test("DataValue delegates regional formatting and preserves zero and false", () => {
  render(<><DataValue value={0} format={n=>`${n.toFixed(2)} EUR`} /><DataValue value={false} /><DataValue value={null} /></>);
  expect(screen.getByText("0.00 EUR")).toBeVisible();
  expect(screen.getByText("false")).toBeVisible();
  expect(screen.getByText("—")).toBeVisible();
});

test("CardGrid retains page breakpoint classes without an inline column override", () => {
  const {container} = render(<CardGrid className="xl:grid-cols-4"><div>Card</div></CardGrid>);
  expect(container.firstChild).toHaveClass("xl:grid-cols-4");
  expect((container.firstChild as HTMLElement).style.gridTemplateColumns).toBe("");
});

test("page-defined card grid gaps are not overridden by inline defaults", () => {
  const {container} = render(<CardGrid className="gap-x-5 gap-y-4 xl:gap-6"><div>Card</div></CardGrid>);
  expect((container.firstChild as HTMLElement).style.gap).toBe("");
  expect(container.firstChild).not.toHaveClass("gap-3");
});


test("Card keeps section semantics, muted styling and no added shadow", () => {
  render(<Card as="section" aria-label="Summary" tone="muted" radius="lg" shadow="none">Details</Card>);
  const card = screen.getByRole("region", {name:"Summary"});
  expect(card.tagName).toBe("SECTION");
  expect(card).toHaveClass("rounded-lg", "bg-[var(--surface-2)]");
  expect(card).not.toHaveClass("bg-[var(--surface)]", "shadow-[var(--shadow-sm)]");
});

test("record description layout preserves labels and literal business values", () => {
  render(<DescriptionList layout="stacked" className="grid-cols-2" items={[{id:"id",label:"Record",value:<DataValue value="CUS-02401" />},{id:"zero",label:"Balance",value:<DataValue value={0} />}]} />);
  expect(screen.getAllByRole("term")).toHaveLength(2);
  expect(screen.getAllByRole("definition")).toHaveLength(2);
  expect(screen.getByText("CUS-02401")).toBeVisible();
  expect(screen.getByText("0")).toBeVisible();
});


test("calendar event text participates in the day accessible name",()=>{
 render(<Calendar label="Events" value="2026-10-24" onChange={()=>{}} renderDay={date=>date==="2026-10-24"?<span>Fictional meeting</span>:null}/>);
 const day=document.querySelector('[data-date="2026-10-24"]')!;
 expect(day).toHaveAccessibleName(/24 Fictional meeting.*October 24, 2026/);
});
