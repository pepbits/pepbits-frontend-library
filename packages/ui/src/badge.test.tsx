import { render, screen } from "./test/render";
import { describe, expect, test } from "vitest";
import { Badge, StatusBadge, statusTone } from "./badge";

/* What a READER ends up with, not which classes produced it. A test that
   asserts `bg-[var(--surface-2)]` fails on every restyle, and a suite that fails
   for cosmetic reasons is one people delete. */
describe("Badge", () => {
  test("shows its content", () => {
    render(<Badge>Draft</Badge>);
    expect(screen.getByText("Draft")).toBeVisible();
  });
});

describe("statusTone", () => {
  test.each([
    ["Active", "success"], ["Paid", "success"],
    ["Pending", "warning"], ["Open", "warning"],
    ["Overdue", "danger"], ["Rejected", "danger"],
    ["On hold", "info"], ["Anything else", "neutral"],
  ])("%s reads as %s", (value, tone) => {
    expect(statusTone(value)).toBe(tone);
  });

  test("is case-insensitive, because real data is not tidy", () => {
    expect(statusTone("OVERDUE")).toBe("danger");
    expect(statusTone("overdue")).toBe("danger");
  });
});

describe("StatusBadge", () => {
  /* The case worth guarding. StatusBadge maps booleans to words:
       typeof value === "boolean" ? (value ? "Enabled" : "Disabled") : String(value)
     Simplify that to String(value) and TypeScript stays happy while the UI
     starts showing users the word "false". */
  test("a boolean reads as a word, never true/false", () => {
    const { rerender } = render(<StatusBadge value={false} />);
    expect(screen.getByText("Disabled")).toBeVisible();
    expect(screen.queryByText("false")).toBeNull();

    rerender(<StatusBadge value={true} />);
    expect(screen.getByText("Enabled")).toBeVisible();
    expect(screen.queryByText("true")).toBeNull();
  });

  test("anything else is shown as written", () => {
    render(<StatusBadge value="Partially paid" />);
    expect(screen.getByText("Partially paid")).toBeVisible();
  });
});
