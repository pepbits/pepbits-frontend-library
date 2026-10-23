import { describe, expect, test, vi } from "vitest";
import { buildSearchBody, searchWorklist } from "./search-request.ts";

const definitions = [
  { key: "status", label: "Status", type: "select" as const, classification: "operational" as const },
  { key: "query", label: "Search", type: "text" as const, classification: "phi" as const },
  { key: "privateRef", label: "Private reference", type: "text" as const, classification: "phi" as const },
];

describe("buildSearchBody", () => {
  /* The two halves the roadmap's §12 example shows. They are separated so the
     server can log one and redact the other — a single `filters` object would
     leave the server guessing, and it would guess by name. */
  test("splits the filters by classification", () => {
    const body = buildSearchBody({ pageId: "item-master", title: "Item Master", entity: "item", definitions,
      filters: { status: "Active", query: "Maya Thomas", privateRef: "PRIVATE-001" } });
    expect(body.safeFilters).toEqual({ status: "Active" });
    expect(body.sensitiveFilters).toEqual({ query: "Maya Thomas", privateRef: "PRIVATE-001" });
  });

  /* The generator keys off title and entity as well as the id, so a body
     without them makes the server search a different dataset — 88 generic rows
     instead of the 96 on screen. It returned zero for a item that was
     visible, which is the worst kind of wrong: a search that looks like it
     worked. */
  test("carries what the table was rendered with", () => {
    const body = buildSearchBody({ pageId: "item-master", title: "Item Master", entity: "item", definitions, filters: {} });
    expect(body).toMatchObject({ pageId: "item-master", title: "Item Master", entity: "item" });
  });

  test("drops empty values from both halves", () => {
    const body = buildSearchBody({ pageId: "p", title: "P", entity: "e", definitions, filters: { status: "", query: "   " } });
    expect(body.safeFilters).toEqual({});
    expect(body.sensitiveFilters).toEqual({});
  });

  /* An unclassified key is sensitive, here as everywhere else. Sending it as
     safe would have the server log its value in full. */
  test("a key nobody classified goes in the sensitive half", () => {
    const body = buildSearchBody({ pageId: "p", title: "P", entity: "e", definitions, filters: { somethingNew: "value" } });
    expect(body.sensitiveFilters).toEqual({ somethingNew: "value" });
    expect(body.safeFilters).toEqual({});
  });
});

describe("searchWorklist", () => {
  /* A POST, and that is the whole point. A GET puts the filters in the request
     line, and the request line is what nginx, the gateway, APM and every cloud
     log record — so moving a name out of the visible URL and leaving it in a
     GET query changes nothing downstream. */
  test("posts, and puts nothing in the URL", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ total: 0, rows: [] }) });
    await searchWorklist({ pageId: "item-master", title: "Item Master", entity: "item", definitions,
      filters: { query: "Maya Thomas", privateRef: "PRIVATE-001" } }, fetcher);

    const [url, init] = fetcher.mock.calls[0]!;
    expect(init.method).toBe("POST");
    for (const leak of ["Maya", "Thomas", "PRIVATE-001", "query", "privateRef"]) {
      expect(String(url)).not.toContain(leak);
    }
  });

  test("the sensitive values are in the body, where they belong", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ total: 1, rows: [{ id: "1" }] }) });
    await searchWorklist({ pageId: "p", title: "P", entity: "e", definitions, filters: { privateRef: "PRIVATE-001" } }, fetcher);
    expect(JSON.parse(fetcher.mock.calls[0]![1].body).sensitiveFilters).toEqual({ privateRef: "PRIVATE-001" });
  });

  test("returns the rows the server matched", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ total: 2, rows: [{ id: "1" }, { id: "2" }] }) });
    const result = await searchWorklist({ pageId: "p", title: "P", entity: "e", definitions, filters: {} }, fetcher);
    expect(result.ok).toBe(true);
    expect(result.rows).toHaveLength(2);
  });

  /* A failed search must not look like an empty result. "No records found" for
     a service that is down sends someone to re-check their filters. */
  test("a failure is a failure, not an empty result", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    const result = await searchWorklist({ pageId: "p", title: "P", entity: "e", definitions, filters: {} }, fetcher);
    expect(result.ok).toBe(false);
    expect(result.failure?.retryable).toBe(true);
    expect(result.rows).toBeUndefined();
  });

  test("a network failure is retryable too", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    const result = await searchWorklist({ pageId: "p", title: "P", entity: "e", definitions, filters: {} }, fetcher);
    expect(result.ok).toBe(false);
    expect(result.failure?.retryable).toBe(true);
  });

  test("a refusal is not retryable", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}',{status:403}));
    const result = await searchWorklist({ pageId: "p", title: "P", entity: "e", definitions, filters: {} }, fetcher);
    expect(result.failure?.kind).toBe("denied");
    expect(result.failure?.retryable).toBe(false);
  });
});
