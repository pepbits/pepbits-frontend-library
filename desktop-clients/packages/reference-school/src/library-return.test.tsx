import { createFormatters, DEFAULT_PREFERENCES } from "@pepbits/erp-config";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ReferenceSchoolModule } from "./index";
import type { Book, BookIssue } from "./lib/types";
import { isoDay } from "./lib/utils";
import { createFakeBackend, fakeHost, type FakeBackend } from "./test-support/fake-host.test-support";

afterEach(() => vi.restoreAllMocks());
const PREFS = { decimalPlaces: 2 as const };
const money = createFormatters({ ...DEFAULT_PREFERENCES, ...PREFS }).money;

async function settle(backend: FakeBackend) {
  await waitFor(() => expect(screen.queryByText("Opening your portal")).toBeNull());
  for (let i = 0; i < 8; i++) { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); if (backend.pending === 0) break; }
}

/* One overdue loan (about 11 days late, so the page shows a live estimate of roughly 5.50) and one book whose stock the
   "server" controls. `stockAfterReturn` is what the canonical GET /books reports after the return. */
function scenario(serverFine: number, stockBefore: number, stockAfterReturn: number) {
  const due = new Date(); due.setDate(due.getDate() - 11);
  let returned = false;
  const book = { id: "bk-t", isbn: "978-0-00-000000-9", title: "Fictional Atlas", author: "A. Author", category: "Reference", publisher: "P", year: 2020, copies: 4, available: stockBefore, shelf: "R-1", rating: 4, cover: "#2b4c9b" } satisfies Book;
  const issue: BookIssue = { id: "is-t", bookId: "bk-t", bookTitle: "Fictional Atlas", memberId: "s-1100", memberName: "Ada Fictional", memberType: "Student", issuedOn: isoDay(new Date(due.getTime() - 14 * 864e5)), dueOn: isoDay(due), returnedOn: null, status: "Overdue", fine: 0 };
  const backend = createFakeBackend({ intercept: (r) => {
    if (r.method === "GET" && r.path === "/books") return { data: [{ ...book, available: returned ? stockAfterReturn : stockBefore }], total: 1 };
    if (r.method === "GET" && r.path.startsWith("/issues")) return { data: [returned ? { ...issue, status: "Returned", returnedOn: isoDay(new Date()), fine: serverFine } : issue], total: 1 };
    if (r.method === "PATCH" && r.path === "/issues/is-t") { returned = true; return { data: { ...issue, status: "Returned", returnedOn: isoDay(new Date()), fine: serverFine } }; }
    return undefined;
  } });
  render(<ReferenceSchoolModule path="/library" host={fakeHost(backend, { roles: ["librarian"], preferences: PREFS })} />);
  return backend;
}

/** Returns the fine text the page showed before the return (its live overdue estimate). */
async function returnTheLoan(backend: FakeBackend) {
  await settle(backend);
  fireEvent.click(screen.getByRole("tab", { name: /Circulation/ }));
  const row = (await screen.findAllByText("Fictional Atlas")).map((el) => el.closest("tr")).find(Boolean)!;
  const estimate = [...row.querySelectorAll("td")].map((td) => td.textContent ?? "").find((t) => /AED/.test(t) && !/days/.test(t))!;
  expect(estimate).toBeTruthy();
  fireEvent.click(within(row).getByRole("button", { name: "Return" }));
  await waitFor(() => expect(backend.requests.some((r) => r.method === "PATCH" && r.path === "/api/issues/is-t")).toBe(true));
  await settle(backend);
  return estimate;
}

describe("library return", () => {
  test("the server's fine is shown and toasted, not the page's overdue estimate", async () => {
    const backend = scenario(3.75, 1, 2);
    const estimate = await returnTheLoan(backend);
    expect(estimate).not.toBe(money(3.75));
    expect(await screen.findByText(`“Fictional Atlas” returned · fine ${money(3.75)} added to Ada Fictional's account`.replace(/\s+/g, " "))).toBeInTheDocument();
    const row = screen.getAllByText("Fictional Atlas").map((el) => el.closest("tr")).find(Boolean)!;
    const cells = [...row.querySelectorAll("td")].map((td) => (td.textContent ?? "").replace(/\s+/g, " "));
    expect(cells).toContain(money(3.75).replace(/\s+/g, " "));
    expect(cells).not.toContain(estimate.replace(/\s+/g, " "));
    expect(within(row).queryByRole("button", { name: "Return" })).toBeNull();
    const body = backend.requests.find((r) => r.method === "PATCH" && r.path === "/api/issues/is-t")!.body;
    expect(body).toEqual({ action: "return" });
  });

  test("stock is the canonical server count after a return", async () => {
    const backend = scenario(0, 1, 2);
    await returnTheLoan(backend);
    const booksReads = backend.requests.filter((r) => r.method === "GET" && r.path === "/api/books");
    expect(booksReads.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByRole("tab", { name: /Catalogue/ }));
    expect(await screen.findByText("2 of 4 available")).toBeInTheDocument();
  });

  test("an idempotent return (stock unchanged on the server) does not add a copy on the client", async () => {
    const backend = scenario(0, 1, 1);
    await returnTheLoan(backend);
    fireEvent.click(screen.getByRole("tab", { name: /Catalogue/ }));
    expect(await screen.findByText("1 of 4 available")).toBeInTheDocument();
    expect(screen.queryByText("2 of 4 available")).toBeNull();
  });
});
