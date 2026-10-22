import { render, screen } from "./test/render";
import { describe, expect, test } from "vitest";
import { Highlight, filterOptions, nextEnabledIndex } from "./option-filter";

const priorities = [
  { value: "low", label: "LOW", description: "Low priority" },
  { value: "medium", label: "MED", description: "Standard choice" },
  { value: "high", label: "HIGH", description: "Urgent" },
];

describe("filterOptions", () => {
  test("a blank query keeps every option", () => {
    expect(filterOptions(priorities, "")).toHaveLength(3);
    expect(filterOptions(priorities, "   ")).toHaveLength(3);
  });

  test("matches the label whatever the case", () => {
    expect(filterOptions(priorities, "low").map((o) => o.value)).toEqual(["low"]);
    expect(filterOptions(priorities, "LOW").map((o) => o.value)).toEqual(["low"]);
  });

  /* Priorities are stored by short code. Nobody types "HIGH" looking for urgency --
     they type "urgent", which only ever appears in the description. */
  test("matches the description, not just the label", () => {
    expect(filterOptions(priorities, "urgent").map((o) => o.value)).toEqual(["high"]);
    expect(filterOptions(priorities, "standard").map((o) => o.value)).toEqual(["medium"]);
  });

  /* The regression this function exists for. Searching a concatenated
     "LOW Low priority" lets a query straddle the join, so the row survives with
     nothing highlightable in it and the filter looks broken. */
  test("a query straddling label and description matches nothing", () => {
    expect(filterOptions(priorities, "low lo")).toHaveLength(0);
  });
});

describe("nextEnabledIndex", () => {
  const plain = [{ value: "a", label: "A" }, { value: "b", label: "B" }, { value: "c", label: "C" }];

  test("steps forward and wraps at the end", () => {
    expect(nextEnabledIndex(plain, 0, 1)).toBe(1);
    expect(nextEnabledIndex(plain, 2, 1)).toBe(0);
  });

  /* Arrow-up from the top is the wrap that gets the arithmetic wrong: the
     intermediate index is negative, and a negative index reads as undefined. */
  test("steps back and wraps at the start", () => {
    expect(nextEnabledIndex(plain, 2, -1)).toBe(1);
    expect(nextEnabledIndex(plain, 0, -1)).toBe(2);
    expect(nextEnabledIndex(plain, -1, -1)).toBe(2);
  });

  test("skips over disabled options", () => {
    const some = [{ value: "a", label: "A" }, { value: "b", label: "B", disabled: true }, { value: "c", label: "C" }];
    expect(nextEnabledIndex(some, 0, 1)).toBe(2);
    expect(nextEnabledIndex(some, 2, -1)).toBe(0);
  });

  test("reports -1 when there is nothing to land on", () => {
    expect(nextEnabledIndex([{ value: "a", label: "A", disabled: true }], -1, 1)).toBe(-1);
    expect(nextEnabledIndex([], -1, 1)).toBe(-1);
  });
});

describe("Highlight", () => {
  test("marks the part that matched", () => {
    render(<Highlight text="Urgent" query="gent" />);
    expect(screen.getByText("gent").tagName).toBe("MARK");
  });

  /* The whole string must still read correctly. Splitting it into three nodes
     is invisible to a sighted user and invisible to getByText's default
     matcher too -- hence the container check rather than a text query. */
  test("leaves the surrounding text intact", () => {
    const { container } = render(<Highlight text="Urgent" query="gent" />);
    expect(container.textContent).toBe("Urgent");
  });

  /* Rendering the QUERY rather than the matched slice is the easy mistake:
     it passes every test where the two happen to be identical, and turns
     "Low priority" into "low priority" the moment someone types in lower case. */
  test("keeps the original casing of the match", () => {
    const { container } = render(<Highlight text="Low priority" query="low" />);
    expect(screen.getByText("Low").tagName).toBe("MARK");
    expect(container.textContent).toBe("Low priority");
  });

  test("renders plain text when nothing matches", () => {
    const { container } = render(<Highlight text="Low priority" query="zz" />);
    expect(container.querySelector("mark")).toBeNull();
    expect(container.textContent).toBe("Low priority");
  });

  test("an empty query marks nothing", () => {
    const { container } = render(<Highlight text="Low priority" query="" />);
    expect(container.querySelector("mark")).toBeNull();
  });
});
