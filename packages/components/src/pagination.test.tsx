import { render, screen } from "./test/render";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { Pagination } from "./pagination";

const noop = () => undefined;
const summary = () => screen.getByText(/Showing/).textContent;
const pageButtons = () => screen.getAllByRole("button").map((b) => b.textContent).filter((t) => /^\d+$/.test(t ?? ""));

describe("Pagination", () => {
  test("counts the first page from one, not zero", () => {
    render(<Pagination page={1} pageSize={20} total={137} onPageChange={noop} onPageSizeChange={noop} />);
    expect(summary()).toBe("Showing 1–20 of 137");
  });

  /* The off-by-one that ships: a last page of 17 records reported as ending at
     140, seventeen rows past the end of the table the user is looking at. */
  test("the last page stops at the last record", () => {
    render(<Pagination page={7} pageSize={20} total={137} onPageChange={noop} onPageSizeChange={noop} />);
    expect(summary()).toBe("Showing 121–137 of 137");
  });

  test("an empty result reads as zero, not as 1–0", () => {
    render(<Pagination page={1} pageSize={20} total={0} onPageChange={noop} onPageSizeChange={noop} />);
    expect(summary()).toBe("Showing 0–0 of 0");
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
  });

  test("previous is dead on the first page, next on the last", () => {
    const { rerender } = render(<Pagination page={1} pageSize={20} total={137} onPageChange={noop} onPageSizeChange={noop} />);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
    rerender(<Pagination page={7} pageSize={20} total={137} onPageChange={noop} onPageSizeChange={noop} />);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  /* The window slides but never runs off either end. Getting this wrong shows
     page numbers that do not exist and return an empty table when clicked. */
  test("the page window stays inside the real range", () => {
    const { rerender } = render(<Pagination page={1} pageSize={10} total={100} onPageChange={noop} onPageSizeChange={noop} />);
    expect(pageButtons()).toEqual(["1", "2", "3", "4", "5"]);
    rerender(<Pagination page={5} pageSize={10} total={100} onPageChange={noop} onPageSizeChange={noop} />);
    expect(pageButtons()).toEqual(["3", "4", "5", "6", "7"]);
    rerender(<Pagination page={10} pageSize={10} total={100} onPageChange={noop} onPageSizeChange={noop} />);
    expect(pageButtons()).toEqual(["6", "7", "8", "9", "10"]);
  });

  test("three pages show three numbers, not five", () => {
    render(<Pagination page={1} pageSize={20} total={45} onPageChange={noop} onPageSizeChange={noop} />);
    expect(pageButtons()).toEqual(["1", "2", "3"]);
  });

  /* Which page you are on is styled as a filled button. Styling alone tells a
     screen-reader user nothing, so the list reads as seven identical numbers. */
  test("the current page says it is current", () => {
    render(<Pagination page={3} pageSize={10} total={100} onPageChange={noop} onPageSizeChange={noop} />);
    expect(screen.getByRole("button", { name: "3" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("button").filter((b) => b.getAttribute("aria-current") === "page")).toHaveLength(1);
  });

  test("asks for the page that was clicked", async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={3} pageSize={10} total={100} onPageChange={onPageChange} onPageSizeChange={noop} />);
    await userEvent.click(screen.getByRole("button", { name: "5" }));
    expect(onPageChange).toHaveBeenCalledWith(5);
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(4);
    await userEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  test("reports a new page size as a number", async () => {
    const onPageSizeChange = vi.fn();
    render(<Pagination page={1} pageSize={20} total={137} onPageChange={noop} onPageSizeChange={onPageSizeChange} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Rows per page" }), "50");
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  /* A tenant policy can narrow page size (PREF-02). Sizes outside it are not
     offered, and a change event carrying one anyway is ignored. */
  test("offers only the page sizes a policy allows", () => {
    const onPageSizeChange = vi.fn();
    render(<Pagination page={1} pageSize={20} total={137} allowedPageSizes={[20, 50]} onPageChange={noop} onPageSizeChange={onPageSizeChange} />);
    const select = screen.getByRole("combobox", { name: "Rows per page" }) as HTMLSelectElement;
    expect([...select.options].map((option) => option.value)).toEqual(["20", "50"]);
    const outside = document.createElement("option");
    outside.value = "100";
    select.append(outside);
    select.value = "100";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onPageSizeChange).not.toHaveBeenCalled();
  });
});
