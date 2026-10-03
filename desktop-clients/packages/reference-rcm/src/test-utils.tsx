import { vi } from "vitest";
import { DEFAULT_PREFERENCES } from "@pepbits/erp-config";
import type { ReferenceHost } from "@pepbits/reference-host";
import type { Aging, ApprovalItem, Home, Kpi, ListResult, Meta, RecordDto, Reports, ResourceDef, User } from "./lib/types";

export interface Recorded { method: string; path: string; url: URL; headers: Headers; body?: unknown; signal?: AbortSignal | null }
export type Reply = { status?: number; body?: unknown } | undefined;
export type Handler = (request: Recorded) => Reply | Promise<Reply>;

/**
 * A host whose `request` records every call and answers from the handler (no network). It mimics the real host transport: JSON in,
 * JSON out, a non-2xx status rejects with `status` and the parsed body as `details`. Paths are exactly what the module sends
 * (`/meta`, `/records/invoices`): the host adds /api and the namespace. This fake transport and every record below are test fixtures only.
 */
export function makeHost(handler: Handler, options: { scope?: Partial<ReferenceHost["scope"]>; preferences?: Partial<ReferenceHost["preferences"]>; path?: string } = {}) {
  const calls: Recorded[] = [];
  const request = vi.fn(async (path: string, init: RequestInit = {}) => {
    const url = new URL(path, "https://host.test");
    const call: Recorded = { method: init.method ?? "GET", path, url, headers: new Headers(init.headers), body: typeof init.body === "string" ? JSON.parse(init.body) : undefined, signal: init.signal };
    calls.push(call);
    if (init.signal?.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
    const result = (await handler(call)) ?? { status: 404, body: { error: { code: "NOT_FOUND", message: `unhandled ${call.method} ${path}` } } };
    const status = result.status ?? 200;
    if (status < 200 || status >= 300) throw Object.assign(new Error("Request failed"), { status, details: result.body });
    return result.body ?? null;
  });
  const navigate = vi.fn();
  const preferences = { ...DEFAULT_PREFERENCES, ...options.preferences };
  const host: ReferenceHost = {
    scope: { tenantId: "tenant", applicationId: "nexora", branchId: "hq", moduleId: "reference-rcm", userId: "user-1", roles: ["billing"], ...options.scope },
    preferences,
    request: request as unknown as ReferenceHost["request"],
    navigate,
    path: options.path,
  };
  return { host, calls, request, navigate };
}

export const json = (body: unknown, status = 200) => ({ status, body });
/** Chains handlers: the first one that answers wins. */
export const chain = (...handlers: Handler[]): Handler => async (r) => { for (const h of handlers) { const out = await h(r); if (out) return out; } };

const status = (key: string, tone: ResourceDef["statuses"][number]["tone"], label: string) => ({ key, tone, label });
const sel = (key: string, label: string, ...values: string[]) => ({ key, label, type: "select" as const, options: values.map((v) => ({ value: v, label: v.charAt(0) + v.slice(1).toLowerCase() })) });

const INVOICES: ResourceDef = {
  key: "invoices", label: "Invoices", singular: "invoice", category: "charges", icon: "FileText", summary: "Invoices issued to patients and payers.", layout: "ledger", prefix: "INV",
  create: true, editable: ["DRAFT"], initial: "DRAFT", document: true, amountLabel: "Total", balanceLabel: "Balance", dueLabel: "Due date", titleField: "reference",
  statuses: [status("DRAFT", "muted", "Draft"), status("ISSUED", "info", "Issued"), status("PAID", "success", "Paid")], path: ["DRAFT", "ISSUED", "PAID"],
  fields: [
    { key: "patient", label: "Patient", type: "ref", source: "patients", required: true, list: true },
    { key: "reference", label: "Reference", type: "text", list: true },
    { key: "amount", label: "Total", type: "money", readonly: true },
    { key: "balance", label: "Balance", type: "money", readonly: true },
    { key: "dueDate", label: "Due date", type: "date", list: true },
    { key: "assignee", label: "Owner", type: "ref", source: "users" },
    { key: "lines", label: "Lines", type: "lines", columns: [{ key: "description", label: "Description", type: "text" }, { key: "total", label: "Total", type: "money" }] },
  ],
  actions: [{ key: "issue", label: "Issue invoice", from: ["DRAFT"], to: "ISSUED", tone: "approve", independent: true, hint: "Consumes the next invoice number." }],
  kpis: [{ label: "Drafts", metric: "count", statuses: ["DRAFT"], tone: "muted" }, { label: "Open balance", metric: "balance", statuses: ["ISSUED"], tone: "attention", overdue: true }],
};
const COVERAGES: ResourceDef = {
  key: "coverages", label: "Patient and encounter coverage", singular: "coverage", category: "front", icon: "IdCard", summary: "Coverage to verify.", layout: "queue", prefix: "COV",
  create: true, editable: ["PENDING_VERIFICATION"], initial: "PENDING_VERIFICATION", titleField: "memberId",
  statuses: [status("PENDING_VERIFICATION", "attention", "Pending verification"), status("VERIFIED", "success", "Verified"), status("REJECTED", "danger", "Rejected")], path: ["PENDING_VERIFICATION", "VERIFIED"],
  fields: [
    { key: "patient", label: "Patient", type: "ref", source: "patients", required: true, list: true },
    { key: "memberId", label: "Member ID", type: "text", required: true, upper: true, list: true },
    sel("tier", "Tier", "GOLD", "SILVER"),
    { key: "assignee", label: "Owner", type: "ref", source: "users" },
  ],
  actions: [
    { key: "verify", label: "Mark verified", from: ["PENDING_VERIFICATION"], to: "VERIFIED", tone: "approve" },
    { key: "reject", label: "Reject coverage", from: ["PENDING_VERIFICATION"], to: "REJECTED", tone: "danger", reason: "required" },
  ],
  kpis: [{ label: "To verify", metric: "count", statuses: ["PENDING_VERIFICATION"], tone: "attention" }],
};
const CLAIMS: ResourceDef = {
  key: "claims", label: "Claims", singular: "claim", category: "insurance", icon: "FileStack", summary: "Claims to payers.", layout: "board", prefix: "CLM", create: false, editable: [], initial: "READY",
  statuses: [status("READY", "info", "Ready"), status("SUBMITTED", "progress", "Submitted"), status("DENIED", "danger", "Denied")], path: ["READY", "SUBMITTED"], board: ["READY", "SUBMITTED", "DENIED"],
  fields: [{ key: "patient", label: "Patient", type: "ref", source: "patients", list: true }, { key: "amount", label: "Billed", type: "money", readonly: true }, { key: "balance", label: "Outstanding", type: "money", readonly: true }],
  actions: [{ key: "submit", label: "Submit claim", from: ["READY"], to: "SUBMITTED", tone: "primary" }, { key: "record-denial", label: "Record denial", from: ["SUBMITTED"], to: "DENIED", tone: "danger", inputs: [sel("denialReason", "Denial reason", "DUPLICATE", "CODING_ERROR")] }],
  kpis: [{ label: "Denied", metric: "balance", statuses: ["DENIED"], tone: "danger" }],
};
const EXCHANGE: ResourceDef = {
  key: "exchange-messages", label: "Exchange monitor", singular: "exchange message", category: "insurance", icon: "RadioTower", summary: "Payer exchange traffic.", layout: "monitor", prefix: "MSG", create: false, editable: [], initial: "QUEUED",
  statuses: [status("QUEUED", "progress", "Queued"), status("FAILED", "danger", "Failed"), status("DELIVERED", "success", "Delivered")], path: ["QUEUED", "DELIVERED"],
  fields: [{ key: "channel", label: "Channel", type: "text", list: true }], actions: [{ key: "retry", label: "Retry now", from: ["FAILED"], to: "*", tone: "primary" }],
  kpis: [{ label: "Failing", metric: "count", statuses: ["FAILED"], tone: "danger" }],
};

export const user = (id: number, name: string, title: string, tone = "harbor"): User => ({ id, name, title, email: `${name.split(" ")[0].toLowerCase()}@example.test`, initials: name.split(" ").map((p) => p[0]).join(""), tone, homeBranch: id === 1 ? "RUH-TEST" : null });

/** Fictional registry metadata and the signed-in biller: the host session's user, plus the directory history refers to. */
export const meta = (over: Partial<Meta> = {}): Meta => ({
  tenant: { name: "Meridian Test", environment: "Test", sourceBaseline: "abcdef1234567", timezone: "Asia/Dubai" },
  branches: [
    { value: "RUH-TEST", label: "Riyadh Test Hospital", short: "Riyadh Test", currency: "SAR" },
    { value: "JED-TEST", label: "Jeddah Test Clinic", short: "Jeddah Test", currency: "SAR" },
    { value: "DXB-TEST", label: "Dubai Test Clinic", short: "Dubai Test", currency: "AED" },
  ],
  categories: [
    { key: "front", label: "Front office", short: "Front", icon: "ConciergeBell", summary: "Coverage and the cash drawer.", pages: [
      { key: "home", label: "Billing home", icon: "Home", href: "/", kind: "dashboard", summary: "Today across every queue." },
      { key: "coverages", label: "Patient and encounter coverage", icon: "IdCard", href: "/w/coverages", kind: "resource", summary: "Coverage to verify." }] },
    { key: "charges", label: "Charges and documents", short: "Charges", icon: "Receipt", summary: "Invoices.", pages: [{ key: "invoices", label: "Invoices", icon: "FileText", href: "/w/invoices", kind: "resource", summary: "Invoices issued." }] },
    { key: "insurance", label: "Insurance", short: "Insurance", icon: "ShieldPlus", summary: "Claims and exchange.", pages: [
      { key: "claims", label: "Claims", icon: "FileStack", href: "/w/claims", kind: "resource", summary: "Claims to payers." },
      { key: "exchange-messages", label: "Exchange monitor", icon: "RadioTower", href: "/w/exchange-messages", kind: "resource", summary: "Exchange traffic." }] },
    { key: "receivables", label: "Receivables", short: "AR", icon: "TrendingUp", summary: "Aging and reports.", pages: [
      { key: "aging", label: "Aging", icon: "BarChart3", href: "/aging", kind: "dashboard", summary: "Open balances by age." },
      { key: "reports", label: "Reports", icon: "PieChart", href: "/reports", kind: "dashboard", summary: "Performance." }] },
    { key: "cross", label: "Cross-cutting", short: "Team", icon: "Users", summary: "Approvals.", pages: [{ key: "approvals", label: "Approvals inbox", icon: "Inbox", href: "/approvals", kind: "dashboard", summary: "Waiting for a second person." }] },
  ],
  resources: [COVERAGES, INVOICES, CLAIMS, EXCHANGE],
  users: [user(1, "Amira Test", "Biller", "cobalt"), user(2, "Omar Test", "Finance lead", "jade")],
  currentUser: user(1, "Amira Test", "Biller", "cobalt"),
  hostManagedIdentity: true,
  demo: true,
  ...over,
});

export const record = (over: Partial<RecordDto> = {}): RecordDto => ({
  id: 7, ref: "INV-2026-00007", status: "DRAFT", title: "Visit 114", currency: "SAR",
  patient: { id: 3, name: "Layla Test", mrn: "MRN-0003" }, branch: "RUH-TEST", amount: 1150, balance: 0, dueDate: "2026-10-30", assignee: 1, priority: null,
  values: { patient: 3, reference: "Visit 114", dueDate: "2026-10-30", lines: [{ description: "Consultation", total: 1150 }] }, labels: { patient: "MRN-0003  Layla Test" }, rowVersion: 4,
  createdBy: 2, createdAt: "2026-09-30T08:00:00Z", updatedBy: 2, updatedAt: "2026-09-30T08:30:00Z", statusBy: 2, statusAt: "2026-09-30T08:30:00Z", reason: null,
  timeline: [{ id: 1, at: "2026-09-30T08:00:00Z", actorId: 2, action: "create", from: null, to: "DRAFT", summary: "Created as draft.", reason: null }], ...over,
});

export const kpis = (): Kpi[] => [
  { label: "Drafts", metric: "count", tone: "muted", value: 2, count: 2, statuses: ["DRAFT"], overdue: false },
  { label: "Open balance", metric: "balance", tone: "attention", value: 5400, count: 3, statuses: ["ISSUED"], overdue: true },
];
export const list = (rows: RecordDto[] = [record()], over: Partial<ListResult> = {}): ListResult => ({ rows, total: rows.length, page: 1, pageSize: 20, counts: { DRAFT: rows.length, ISSUED: 3, PAID: 1 }, kpis: kpis(), ...over });

export const home = (): Home => ({
  cashToday: { value: 2300, count: 2 }, trend: Array.from({ length: 12 }, (_, i) => ({ date: `2026-07-${String(i + 1).padStart(2, "0")}`, value: i * 100 })),
  outstanding: 125000, deniedValue: 9000, deniedCount: 3, exchangeFailures: 2, approvals: 4,
  queues: [
    { label: "Coverage to verify", href: "/w/coverages?status=PENDING_VERIFICATION", icon: "IdCard", count: 5, value: null, category: "front" },
    { label: "Invoices to issue", href: "/w/invoices?status=DRAFT", icon: "FileText", count: 0, value: null, category: "charges" },
    { label: "Evil link", href: "//evil.example/x", icon: "FileText", count: 1, value: 10, category: "charges" },
  ],
  drawers: [{ id: 11, ref: "CSH-0011", cashier: "Noor Test", status: "OPEN", branch: "RUH-TEST", expected: 800, currency: "SAR" }],
});
export const aging = (): Aging => ({
  buckets: ["0-30", "31-60", "61-90", "91-120", "120+"], totals: [100, 200, 300, 0, 400], total: 1000, daysInAr: 52, over90Share: 40,
  parties: [{ party: "Payer One", kind: "Payer", buckets: [10, 20, 30, 0, 40], total: 100, invoices: 4 }],
  oldest: [{ id: 7, ref: "INV-2026-00007", age: 130, balance: 1150, currency: "SAR", party: "Payer One", patient: "Layla Test" }],
});
export const reports = (): Reports => ({
  series: [{ month: "2026-08", billed: 1000, collected: 800 }, { month: "2026-09", billed: 1200, collected: 900 }],
  kpis: { billed: 2200, collected: 1700, collectionRate: 77, denialRate: 6, daysInAr: 50, outstanding: 500 },
  denials: [{ reason: "CODING_ERROR", count: 1, value: 300 }], methods: [{ method: "CARD", value: 900 }], payers: [{ payer: "Payer One", value: 1500 }, { payer: "Self pay", value: 700 }],
});
export const approval = (over: Partial<ApprovalItem> = {}): ApprovalItem => ({
  resource: "invoices", resourceLabel: "Invoices", category: "charges", icon: "FileText", id: 7, ref: "INV-2026-00007", title: "Visit 114", status: "DRAFT", statusLabel: "Draft",
  patient: "Layla Test", amount: 1150, currency: "SAR", requestedBy: 2, requestedAt: "2026-09-30T08:00:00Z", createdBy: 2, rowVersion: 4, reason: null,
  actions: [{ key: "issue", label: "Issue invoice", tone: "approve", reason: null, inputs: null }], canDecide: true, ...over,
});

/** /meta, /pending, a list per resource and the dashboards: what the module needs to show its first page. */
export const sessionHandler = (over: { meta?: Partial<Meta>; rows?: RecordDto[] } = {}): Handler => (r) => {
  const p = r.url.pathname;
  if (p === "/meta") return json(meta(over.meta));
  if (p === "/pending") return json({ invoices: 1, coverages: 2 });
  if (p === "/dashboard/home") return json(home());
  if (p === "/dashboard/aging") return json(aging());
  if (p === "/dashboard/reports") return json(reports());
  if (p === "/approvals") return json([approval(), approval({ id: 8, ref: "INV-2026-00008", canDecide: false })]);
  if (/^\/records\/[\w-]+$/.test(p) && r.method === "GET") return json(list(over.rows));
  if (/^\/options\//.test(p)) return json([{ value: "3", label: "MRN-0003  Layla Test", hint: "Active" }, { value: "4", label: "MRN-0004  Sami Test", hint: "Active" }]);
};
