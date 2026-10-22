import {format} from "./test/format";
import { render, screen } from "./test/render";
import { describe, expect, test } from "vitest";
import { StatCard } from "./stat-card";

describe("StatCard", () => {
  test("shows the label and the value", () => {
    render(<StatCard label="Cash position" value={format.money(42160000)} />);
    expect(screen.getByText("Cash position")).toBeVisible();
    expect(screen.getByText(format.money(42160000))).toBeVisible();
  });

  /* The gap analysis's complaint about this component: a trend arrow implies
     "compared to what?", and the answer is usually nowhere on the card. The
     type makes the comparison compulsory — an arrow cannot be rendered without
     saying what it is an arrow against. */
  test("a trend always says what it is measured against", () => {
    render(<StatCard label="Cash position" value={format.money(42160000)} trend={{ direction: "up", delta: "+4.3%", comparedTo: "vs last month" }} />);
    expect(screen.getByText("+4.3%")).toBeVisible();
    expect(screen.getByText("vs last month")).toBeVisible();
  });

  test("no trend, no arrow and no comparison", () => {
    const { container } = render(<StatCard label="Cash position" value={format.money(42160000)} />);
    expect(container.querySelector("svg")).toBeNull();
  });

  /* Direction is colour AND a word. Green-good red-bad is invisible to a
     substantial number of people, and to anyone reading it aloud. */
  test("the direction is in words, not only in colour", () => {
    render(<StatCard label="Overdue" value={format.money(2100000)} trend={{ direction: "down", delta: "-8%", comparedTo: "vs last week" }} />);
    expect(screen.getByText(/-8%/)).toHaveAccessibleName(/down/i);
  });

  test("a hint sits under the value when there is one", () => {
    render(<StatCard label="Invoices" value="128" hint="12 awaiting approval" />);
    expect(screen.getByText("12 awaiting approval")).toBeVisible();
  });

  test("an icon is decoration and is not announced", () => {
    render(<StatCard label="Invoices" value="128" icon={<svg data-testid="glyph" />} />);
    expect(screen.getByTestId("glyph").closest("[aria-hidden]")).not.toBeNull();
  });
});
