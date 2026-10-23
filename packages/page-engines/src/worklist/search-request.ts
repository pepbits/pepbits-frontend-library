import {partitionFilters, type FilterDefinition, type FilterValues} from "../types";
import {classifyFailure, failureFromError, type Failure} from "@pepbits/components";

export interface SearchRequest {
  pageId: string;
  /**
   * What the table was rendered with.
   *
   * The row generator keys off title and entity as well as the id, so a search
   * that sends only the id builds a DIFFERENT dataset on the server — and
   * returns zero for a record that is visibly on screen. A search that
   * disagrees with the table it filters is worse than no search.
   */
  title: string;
  entity: string;
  definitions: FilterDefinition[];
  filters: FilterValues;
  limit?: number;
  productId?: string;
  queryMode?: string;
  page?: number;
  pageSize?: number;
  sort?: { key: string; direction: "asc" | "desc" } | null;
}

export interface SearchBody {
  pageId: string;
  title: string;
  entity: string;
  safeFilters: FilterValues;
  sensitiveFilters: FilterValues;
  limit?: number;
  productId?: string;
  queryMode?: string;
  page?: number;
  pageSize?: number;
  sort?: { key: string; direction: "asc" | "desc" } | null;
}

/**
 * The two halves, as §12 shows them.
 *
 * Separated so the server can log one and redact the other. A single `filters`
 * object would leave the server to work out which is which, and it would do it
 * by name — which is the guess this whole classification exists to replace.
 */
export function buildSearchBody({ pageId, title, entity, definitions, filters, limit, productId, queryMode, page, pageSize, sort }: SearchRequest): SearchBody {
  const { urlSafe, sensitive } = partitionFilters(definitions, filters);
  return { pageId, title, entity, safeFilters: urlSafe, sensitiveFilters: sensitive, ...(limit ? { limit } : {}), ...(productId ? { productId } : {}), ...(queryMode ? { queryMode } : {}), ...(page ? { page } : {}), ...(pageSize ? { pageSize } : {}), ...(sort ? { sort } : {}) };
}

export interface SearchResult {
  ok: boolean;
  total?: number;
  page?: number;
  rows?: Array<Record<string, string | number | boolean>>;
  failure?: Failure;
}

/**
 * Search, by POST.
 *
 * That is the entire reason this function exists rather than a query string. A
 * GET puts the filters in the request line, and the request line is what nginx,
 * the API gateway, APM, OpenTelemetry and every cloud log record — so moving a
 * personal name out of the visible URL and leaving it in a GET query changes
 * nothing downstream. HTTPS protects the wire and nothing after the terminator.
 */
export async function searchWorklist(request: SearchRequest, fetcher: (path: string, init: RequestInit) => Promise<Response>): Promise<SearchResult> {
  try {
    const response = await fetcher("/worklists/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildSearchBody(request)),
    });
    if (!response.ok) return { ok: false, failure: failureFromError({ status: response.status, reference:response.headers.get("X-Sentinel-Reference") }) };
    const body = (await response.json()) as { total: number; page?: number; rows: Array<Record<string, string | number | boolean>> };
    if (!Array.isArray(body.rows) || !Number.isInteger(body.total) || body.total < 0) throw new Error("Invalid search response");
    return { ok: true, total: body.total, page: body.page, rows: body.rows };
  } catch (error) {
    /* A failed search must not look like an empty result: "no records found"
       for a service that is down sends someone to re-check filters that were
       never the problem. */
    return { ok: false, failure: failureFromError(error) };
  }
}
