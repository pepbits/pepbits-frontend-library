import { render, screen } from "./test/render";
import { describe, expect, test } from "vitest";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { EmptyState } from "./empty-state";
import { NavLink } from "@pepbits/ui";

describe("CardTitle", () => {
  test("shows the title, the subtitle and the action", () => {
    render(<Card><CardHeader><CardTitle title="Cash position" subtitle="Across four branches" action={<button type="button">Export</button>} /></CardHeader><CardContent>Body</CardContent></Card>);
    expect(screen.getByText("Cash position")).toBeVisible();
    expect(screen.getByText("Across four branches")).toBeVisible();
    expect(screen.getByRole("button", { name: "Export" })).toBeVisible();
    expect(screen.getByText("Body")).toBeVisible();
  });

  test("a title with no subtitle renders no empty line", () => {
    const { container } = render(<CardTitle title="Cash position" />);
    expect(container.textContent).toBe("Cash position");
  });
});

describe("EmptyState", () => {
  test("says something useful with no props at all", () => {
    render(<EmptyState />);
    expect(screen.getByText("No records found")).toBeVisible();
    expect(screen.getByText(/changing the search or filters/)).toBeVisible();
  });

  test("the caller's own words win", () => {
    render(<EmptyState title="No invoices this quarter" description="Raise one to get started." action={<button type="button">New invoice</button>} />);
    expect(screen.getByText("No invoices this quarter")).toBeVisible();
    expect(screen.queryByText("No records found")).toBeNull();
    expect(screen.getByRole("button", { name: "New invoice" })).toBeVisible();
  });
});

describe("NavLink", () => {
  /* The whole reason this component exists: a real anchor on web, so cmd-click,
     middle-click and "copy link address" work without anyone wiring them up. */
  test("a real destination is a real link", () => {
    render(<NavLink href="/finance/billing-entry">New invoice</NavLink>);
    expect(screen.getByRole("link", { name: "New invoice" })).toHaveAttribute("href", "/finance/billing-entry");
  });

  /* On desktop there is no URL to copy, and an <a href="#"> would put a bogus
     hash in the address bar on every click. */
  test("no destination is a button, not an anchor to nowhere", () => {
    const { rerender } = render(<NavLink onClick={() => undefined}>New invoice</NavLink>);
    expect(screen.getByRole("button", { name: "New invoice" })).toBeVisible();
    expect(screen.queryByRole("link")).toBeNull();
    rerender(<NavLink href="#" onClick={() => undefined}>New invoice</NavLink>);
    expect(screen.getByRole("button", { name: "New invoice" })).toBeVisible();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
