import { readFileSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { parseCsv, writeCsvSnapshot } from "./clinical-template-csv.ts";
import {
  clinicInvoiceLines,
  clinicBalance,
} from "../desktop-clients/packages/erp-config/src/clinic-billing.ts";
import type {
  ClinicBillingState,
  ClinicService,
  ClinicBillingView,
  ClinicBillingMutation,
} from "../desktop-clients/packages/erp-config/src/clinic-billing.ts";
import type { PatientOverview } from "../desktop-clients/packages/erp-config/src/clinical-templates.ts";
type User = { id: string; tenantId?: string; name?: string };
type Result = { status: number; body: unknown };
type Bucket = {
  state: ClinicBillingState;
  receipts: Record<string, { hash: string; view: ClinicBillingView }>;
};
const fail = (status: number, key = "invalid"): Result => ({
  status,
  body: {
    error: "template.clinic.error." + key,
    messageKey: "template.clinic.error." + key,
    fieldErrors: { billing: "template.clinic.error." + key },
  },
});
const validText = (v: unknown, max = 500): v is string =>
  typeof v === "string" && v.length <= max;
const [head, ...rows] = parseCsv(
  readFileSync(
    new URL("./config/clinic-billing/services.csv", import.meta.url),
    "utf8",
  ),
);
const services: ClinicService[] = rows.map((c) => {
  const r = Object.fromEntries(head.map((k, i) => [k, c[i]]));
  return {
    id: r.id,
    label: r.label,
    category: r.category,
    price: Number(r.price),
    taxBps: Number(r.taxBps),
    coverageBps: Number(r.coverageBps),
  };
});
if (
  !services.length ||
  new Set(services.map((s) => s.id)).size !== services.length ||
  services.some(
    (s) =>
      !s.id ||
      !s.label ||
      ![s.price, s.taxBps, s.coverageBps].every(Number.isSafeInteger) ||
      s.price < 0 ||
      s.price > 1_000_000_000 ||
      s.taxBps < 0 ||
      s.taxBps > 10000 ||
      s.coverageBps < 0 ||
      s.coverageBps > 10000,
  )
)
  throw Error("Invalid clinic service catalog");
/** Single-process demo ledger. Money is integer minor units, independent of display preferences. */
export function createClinicBillingStore(
  file: string,
  overview: (user: User, product: string, id: string) => Result,
) {
  const read = (): Record<string, Bucket> => {
    let source: string;
    try {
      source = readFileSync(file, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT")
        return Object.create(null);
      throw e;
    }
    const [header, ...entries] = parseCsv(source);
    if (header?.join(",") !== "tenant,application,patient,data")
      throw Error("Invalid billing CSV");
    const result: Record<string, Bucket> = Object.create(null);
    for (const cells of entries) {
      if (cells.length !== 4) throw Error("Invalid billing CSV row");
      const [tenant, app, patient, json] = cells,
        key = JSON.stringify([tenant, app, patient]);
      if (result[key]) throw Error("Duplicate billing CSV scope");
      const b = JSON.parse(json) as Bucket;
      if (
        b.state.patientId !== patient ||
        !Number.isSafeInteger(b.state.version) ||
        !Array.isArray(b.state.invoices) ||
        !Array.isArray(b.state.payments) ||
        !Array.isArray(b.state.orders) ||
        !Array.isArray(b.state.history) ||
        !b.receipts
      )
        throw Error("Invalid billing snapshot");
      result[key] = b;
    }
    return result;
  };
  const persist = (data: Record<string, Bucket>) => {
    const quote = (v: string) => '"' + v.replaceAll('"', '""') + '"';
    writeCsvSnapshot(
      file,
      "tenant,application,patient,data\r\n" +
        Object.entries(data)
          .map(([k, b]) =>
            [...JSON.parse(k), JSON.stringify(b)].map(quote).join(","),
          )
          .join("\r\n") +
        "\r\n",
    );
  };
  return {
    handle(
      user: User,
      product: string,
      input: unknown,
      canWrite: boolean,
    ): Result {
      if (!input || typeof input !== "object" || Array.isArray(input))
        return fail(400);
      const body = input as ClinicBillingMutation;
      if (!validText(body.patientId, 100) || !body.patientId) return fail(400);
      const response = overview(user, product, body.patientId);
      if (response.status !== 200) return response;
      const patientView = response.body as PatientOverview;
      const data = read(),
        key = JSON.stringify([
          user.tenantId ?? "demo",
          product,
          body.patientId,
        ]);
      if (!data[key]) {
        data[key] = {
          state: {
            patientId: body.patientId,
            version: 1,
            orders: patientView.rows
              .filter((r) => r.kind === "pharmacy" || r.kind === "order")
              .map((r) => ({
                id: randomUUID(),
                sourceId: r.id,
                label: r.title,
                detail: r.detail,
                doctor: r.provider ?? "",
                date: r.date,
                serviceId: r.kind === "pharmacy" ? "medication" : "laboratory",
                quantity: 1,
                status: r.kind === "pharmacy" ? "prescribed" : "ordered",
              })),
            invoices: [],
            payments: [],
            history: [],
          },
          receipts: Object.create(null),
        };
        persist(data);
      }
      const bucket = data[key],
        state = bucket.state,
        view = (): ClinicBillingView => ({
          patient: patientView.patient,
          context: patientView.rows.filter((r) =>
            ["encounter", "team", "clinical", "appointment"].includes(r.kind),
          ),
          state,
          services,
          currency: "AED",
          canWrite,
        });
      if ((body as { action: string }).action === "load") {
        const incoming = patientView.rows.filter(
          (r) =>
            (r.kind === "pharmacy" || r.kind === "order") &&
            !state.orders.some((o) => o.sourceId === r.id),
        );
        if (incoming.length) {
          for (const r of incoming)
            state.orders.push({
              id: randomUUID(),
              sourceId: r.id,
              label: r.title,
              detail: r.detail,
              doctor: r.provider ?? "",
              date: r.date,
              serviceId: r.kind === "pharmacy" ? "medication" : "laboratory",
              quantity: 1,
              status: r.kind === "pharmacy" ? "prescribed" : "ordered",
            });
          state.version++;
          persist(data);
        }
        return { status: 200, body: view() };
      }
      if (!canWrite) return fail(403, "denied");
      if (
        !validText(body.operationId, 100) ||
        !body.operationId ||
        !Number.isSafeInteger(body.expectedVersion)
      )
        return fail(400);
      const receiptKey = JSON.stringify([user.id, body.operationId]),
        hash = createHash("sha256").update(JSON.stringify(body)).digest("hex"),
        receipt = bucket.receipts[receiptKey];
      if (receipt)
        return receipt.hash === hash
          ? { status: 200, body: receipt.view }
          : fail(409, "conflict");
      if (state.version !== body.expectedVersion) return fail(409, "conflict");
      const at = new Date().toISOString(),
        actor = user.name ?? user.id;
      let reference = "";
      const selection = (ids: unknown, status: string) =>
        Array.isArray(ids) &&
        ids.length > 0 &&
        ids.length <= 200 &&
        new Set(ids).size === ids.length &&
        ids.every((id) =>
          state.orders.some((o) => o.id === id && o.status === status),
        );
      if (body.action === "order") {
        if (!selection(body.orderIds, "prescribed")) return fail(400);
        for (const o of state.orders)
          if (body.orderIds.includes(o.id)) o.status = "ordered";
        reference = body.orderIds.join(", ");
      } else if (body.action === "add") {
        const service = services.find((s) => s.id === body.serviceId);
        if (
          !service ||
          !Number.isSafeInteger(body.quantity) ||
          body.quantity < 1 ||
          body.quantity > 100 ||
          !validText(body.doctor, 150) ||
          !body.doctor.trim()
        )
          return fail(400);
        reference = randomUUID();
        state.orders.push({
          id: reference,
          label: service.label,
          detail: "",
          doctor: body.doctor.trim(),
          date: at,
          serviceId: service.id,
          quantity: body.quantity,
          status: "ordered",
        });
      } else if (body.action === "invoice") {
        if (
          !selection(body.orderIds, "ordered") ||
          !Number.isSafeInteger(body.discountBps) ||
          body.discountBps < 0 ||
          body.discountBps > 10000 ||
          !validText(body.insuranceId, 100) ||
          !validText(body.authorization, 150) ||
          !validText(body.note, 1000)
        )
          return fail(400);
        const insurance = patientView.patient.collections.insurances?.find(
          (i) => i.id === body.insuranceId,
        );
        if (
          body.insuranceId &&
          (!insurance ||
            !body.authorization.trim() ||
            (insurance.expiry && insurance.expiry < at.slice(0, 10)))
        )
          return fail(400, "insurance");
        const lines = clinicInvoiceLines(
          state.orders.filter((o) => body.orderIds.includes(o.id)),
          services,
          body.discountBps,
          !!insurance,
        );
        reference = "INV-" + randomUUID();
        state.invoices.push({
          id: reference,
          at,
          actor,
          status: "issued",
          lines,
          discountBps: body.discountBps,
          total: lines.reduce((s, l) => s + l.net + l.tax, 0),
          insurance: lines.reduce((s, l) => s + l.insurance, 0),
          patient: lines.reduce((s, l) => s + l.patient, 0),
          insuranceId: body.insuranceId,
          authorization: body.authorization,
          note: body.note,
        });
        for (const order of state.orders)
          if (body.orderIds.includes(order.id)) {
            order.status = "billed";
            order.invoiceId = reference;
          }
      } else if (body.action === "editInvoice") {
        const invoice = state.invoices.find((i) => i.id === body.invoiceId);
        if (
          !invoice ||
          invoice.status !== "issued" ||
          state.payments.some((p) => p.invoiceId === invoice.id)
        )
          return fail(400, "editLocked");
        if (
          !validText(body.reason, 500) ||
          !body.reason.trim() ||
          !validText(body.note, 1000) ||
          !validText(body.authorization, 150) ||
          !validText(body.insuranceId, 100) ||
          !Number.isSafeInteger(body.discountBps) ||
          body.discountBps < 0 ||
          body.discountBps > 10000 ||
          !Array.isArray(body.quantities) ||
          body.quantities.length !== invoice.lines.length ||
          new Set(body.quantities.map((q) => q?.orderId)).size !==
            invoice.lines.length ||
          body.quantities.some(
            (q) =>
              !q ||
              !invoice.lines.some((l) => l.orderId === q.orderId) ||
              !Number.isSafeInteger(q.quantity) ||
              q.quantity < 1 ||
              q.quantity > 100,
          )
        )
          return fail(400);
        const insurance = patientView.patient.collections.insurances?.find(
          (i) => i.id === body.insuranceId,
        );
        if (
          body.insuranceId &&
          (!insurance ||
            !body.authorization.trim() ||
            (insurance.expiry && insurance.expiry < at.slice(0, 10)))
        )
          return fail(400, "insurance");
        const orders = invoice.lines.map((line) => {
          const order = state.orders.find(
            (o) =>
              o.id === line.orderId &&
              o.invoiceId === invoice.id &&
              o.status === "billed",
          );
          return order
            ? {
                ...order,
                quantity: body.quantities.find(
                  (q) => q.orderId === line.orderId,
                )!.quantity,
              }
            : undefined;
        });
        if (orders.some((o) => !o)) return fail(400);
        const lines = clinicInvoiceLines(
          orders.filter((o) => o !== undefined),
          services,
          body.discountBps,
          !!insurance,
        );
        const { revisions: previous = [], ...snapshot } =
          structuredClone(invoice);
        invoice.revisions = [
          ...previous,
          { at, actor, reason: body.reason.trim(), invoice: snapshot },
        ];
        Object.assign(invoice, {
          lines,
          discountBps: body.discountBps,
          insuranceId: body.insuranceId,
          authorization: body.authorization,
          note: body.note,
          total: lines.reduce((s, l) => s + l.net + l.tax, 0),
          insurance: lines.reduce((s, l) => s + l.insurance, 0),
          patient: lines.reduce((s, l) => s + l.patient, 0),
        });
        for (const order of orders)
          state.orders.find((o) => o.id === order!.id)!.quantity =
            order!.quantity;
        reference = invoice.id + " • " + body.reason.trim();
      } else if (body.action === "payment") {
        const invoice = state.invoices.find((i) => i.id === body.invoiceId);
        if (
          !invoice ||
          invoice.status !== "issued" ||
          !Number.isSafeInteger(body.amount) ||
          body.amount <= 0 ||
          body.amount > clinicBalance(state, invoice) ||
          !["cash", "card", "transfer"].includes(body.method) ||
          !validText(body.reference, 150) ||
          (body.method !== "cash" && !body.reference.trim())
        )
          return fail(400, "payment");
        reference = "RCT-" + randomUUID();
        state.payments.push({
          id: reference,
          invoiceId: invoice.id,
          amount: body.amount,
          method: body.method,
          reference: body.reference,
          at,
          actor,
        });
      } else if (body.action === "refund") {
        const payment = state.payments.find((p) => p.id === body.paymentId);
        if (
          !payment ||
          payment.amount <= 0 ||
          state.payments.some((p) => p.refundOf === payment.id) ||
          !validText(body.reference, 500) ||
          !body.reference.trim()
        )
          return fail(400, "refund");
        reference = "RF-" + randomUUID();
        state.payments.push({
          ...payment,
          id: reference,
          amount: -payment.amount,
          refundOf: payment.id,
          reference: body.reference,
          at,
          actor,
        });
      } else if (body.action === "export") {
        if (
          !state.invoices.some((i) => i.id === body.invoiceId) ||
          !["csv", "xlsx", "print"].includes(body.format)
        )
          return fail(400);
        reference = body.invoiceId + " " + body.format;
      } else if (body.action === "void") {
        const invoice = state.invoices.find((i) => i.id === body.invoiceId);
        if (
          !invoice ||
          invoice.status !== "issued" ||
          state.payments.some((p) => p.invoiceId === invoice.id) ||
          !validText(body.reference, 500) ||
          !body.reference.trim()
        )
          return fail(400, "void");
        invoice.status = "void";
        for (const order of state.orders)
          if (order.invoiceId === invoice.id) {
            order.status = "ordered";
            delete order.invoiceId;
          }
        reference = invoice.id + " " + body.reference;
      } else return fail(400);
      state.version++;
      state.history.unshift({
        id: randomUUID(),
        at,
        actor,
        messageKey: "template.clinic.event." + body.action,
        reference,
      });
      const result = view();
      bucket.receipts[receiptKey] = { hash, view: structuredClone(result) };
      persist(data);
      return { status: 200, body: result };
    },
  };
}
