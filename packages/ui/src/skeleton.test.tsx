import { render, screen } from "./test/render";
import { describe, expect, test } from "vitest";
import { DashboardSkeleton, FormSkeleton, Skeleton, TableSkeleton } from "./skeleton";

describe("Skeleton", () => {
  /* A placeholder is scenery. Announced to a screen reader it becomes a stream
     of meaningless nodes between the reader and the content. */
  test("is hidden from assistive technology", () => {
    const { container } = render(<Skeleton className="h-3 w-10" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe.each([
  ["table", TableSkeleton], ["dashboard", DashboardSkeleton], ["form", FormSkeleton],
])("%s skeleton", (_name, Component) => {
  /* One live region saying "Loading", however many grey blocks are inside it —
     so the wait is announced once rather than not at all. */
  test("announces the wait exactly once", () => {
    render(<Component />);
    expect(screen.getAllByRole("status", { name: "Loading" })).toHaveLength(1);
  });
});
