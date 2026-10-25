import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClinicBillingStore } from "./clinic-billing-store.ts";
import type { ClinicBillingView } from "../desktop-clients/packages/erp-config/src/clinic-billing.ts";
const user = { id: "u", tenantId: "t", name: "Demo" };
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "clinic-ledger-")),
    file = join(dir, "billing.csv"),
    overview = (_u: unknown, _p: string, id: string) => ({
      status: 200,
      body: {
        patient: {
          id,
          mrn: "MRN",
          values: {},
          collections: { insurances: [{ id: "policy", expiry: "2099-01-01" }] },
          activity: [],
        },
        rows: [
          {
            id: "rx",
            kind: "pharmacy",
            title: "Medication",
            detail: "Fictional prescription",
            provider: "Doctor Demo",
            date: "2026-09-09",
          },
        ],
      },
    }),
    open = () => createClinicBillingStore(file, overview);
  return { open, dispose: () => rmSync(dir, { recursive: true, force: true }) };
}
test("prescription → order → invoice → partial payments → refund survives restart and duplicate retries", () => {
  const s = setup();
  try {
    let store = s.open();
    let view = store.handle(
      user,
      "app",
      { action: "load", patientId: "p" },
      true,
    ).body as ClinicBillingView;
    const send = (command: object) => {
      const result = store.handle(
        user,
        "app",
        {
          ...command,
          patientId: "p",
          expectedVersion: view.state.version,
          operationId: crypto.randomUUID(),
        },
        true,
      );
      assert.equal(result.status, 200);
      view = result.body as ClinicBillingView;
    };
    send({ action: "order", orderIds: [view.state.orders[0].id] });
    send({
      action: "invoice",
      orderIds: [view.state.orders[0].id],
      discountBps: 1000,
      insuranceId: "policy",
      authorization: "DEMO-1",
      note: "Test",
    });
    const invoice = view.state.invoices[0];
    assert.equal(invoice.total, 2250);
    assert.equal(invoice.insurance, 1125);
    assert.equal(invoice.patient, 1125);
    const payment = {
      action: "payment",
      patientId: "p",
      expectedVersion: view.state.version,
      operationId: "payment-1",
      invoiceId: invoice.id,
      amount: 500,
      method: "cash",
      reference: "",
    };
    const first = store.handle(user, "app", payment, true);
    assert.equal(first.status, 200);
    store = s.open();
    assert.deepEqual(store.handle(user, "app", payment, true), first);
    view = store.handle(user, "app", { action: "load", patientId: "p" }, true)
      .body as ClinicBillingView;
    assert.equal(view.state.payments.length, 1);
    assert.equal(
      store.handle(
        user,
        "app",
        {
          ...payment,
          operationId: "excess",
          expectedVersion: view.state.version,
          amount: 626,
        },
        true,
      ).status,
      400,
    );
    send({
      action: "refund",
      paymentId: view.state.payments[0].id,
      reference: "Requested demo refund",
    });
    assert.equal(
      view.state.payments.reduce((s, p) => s + p.amount, 0),
      0,
    );
    assert.equal(
      s.open().handle(user, "app", { action: "load", patientId: "p" }, true)
        .status,
      200,
    );
  } finally {
    s.dispose();
  }
});
test("permissions, conflicts, duplicate billing, input validation and tenant isolation", () => {
  const s = setup();
  try {
    const store = s.open(),
      load = () =>
        store.handle(user, "a", { action: "load", patientId: "p" }, true)
          .body as ClinicBillingView;
    let v = load();
    const cmd = {
      action: "order",
      patientId: "p",
      expectedVersion: 1,
      operationId: "op",
      orderIds: [v.state.orders[0].id],
    };
    assert.equal(store.handle(user, "a", cmd, false).status, 403);
    assert.equal(
      store.handle(user, "a", { ...cmd, expectedVersion: 0 }, true).status,
      409,
    );
    assert.equal(store.handle(user, "a", cmd, true).status, 200);
    assert.equal(
      store.handle(user, "a", { ...cmd, orderIds: [] }, true).status,
      409,
    );
    v = load();
    const invoice = {
      action: "invoice",
      patientId: "p",
      expectedVersion: v.state.version,
      operationId: "inv",
      orderIds: [v.state.orders[0].id],
      discountBps: 0,
      insuranceId: "missing",
      authorization: "x",
      note: "",
    };
    assert.equal(store.handle(user, "a", invoice, true).status, 400);
    assert.equal(
      store.handle(user, "a", { ...invoice, insuranceId: "" }, true).status,
      200,
    );
    v = load();
    assert.equal(
      store.handle(
        user,
        "a",
        {
          ...invoice,
          operationId: "inv2",
          insuranceId: "",
          expectedVersion: v.state.version,
        },
        true,
      ).status,
      400,
    );
    const other = store.handle(
      { ...user, tenantId: "other" },
      "a",
      { action: "load", patientId: "p" },
      true,
    ).body as ClinicBillingView;
    assert.equal(other.state.invoices.length, 0);
    assert.equal(
      store.handle(
        user,
        "a",
        {
          action: "add",
          patientId: "p",
          expectedVersion: v.state.version,
          operationId: "bad",
          serviceId: "unknown",
          quantity: 1,
          doctor: "Demo",
        },
        true,
      ).status,
      400,
    );
  } finally {
    s.dispose();
  }
});
test("void returns unpaid orders for rebilling and blocks paid invoice cancellation", () => {
  const s = setup();
  try {
    const store = s.open();
    let v = store.handle(user, "app", { action: "load", patientId: "p" }, true)
      .body as ClinicBillingView;
    const send = (c: object) => {
      const r = store.handle(
        user,
        "app",
        {
          ...c,
          patientId: "p",
          expectedVersion: v.state.version,
          operationId: crypto.randomUUID(),
        },
        true,
      );
      if (r.status === 200) v = r.body as ClinicBillingView;
      return r.status;
    };
    assert.equal(
      send({
        action: "add",
        serviceId: "consultation",
        quantity: 2,
        doctor: "Demo Doctor",
      }),
      200,
    );
    const order = v.state.orders.at(-1)!;
    assert.equal(
      send({
        action: "invoice",
        orderIds: [order.id],
        discountBps: 0,
        insuranceId: "",
        authorization: "",
        note: "",
      }),
      200,
    );
    assert.equal(
      send({
        action: "void",
        invoiceId: v.state.invoices[0].id,
        reference: "Correction",
      }),
      200,
    );
    assert.equal(v.state.orders.at(-1)?.status, "ordered");
    assert.equal(
      send({
        action: "invoice",
        orderIds: [order.id],
        discountBps: 0,
        insuranceId: "",
        authorization: "",
        note: "",
      }),
      200,
    );
    assert.equal(
      send({
        action: "payment",
        invoiceId: v.state.invoices[1].id,
        amount: 100,
        method: "card",
        reference: "DEMO",
      }),
      200,
    );
    assert.equal(
      send({
        action: "void",
        invoiceId: v.state.invoices[1].id,
        reference: "Correction",
      }),
      400,
    );
  } finally {
    s.dispose();
  }
});

test("unpaid bill corrections preserve revisions and survive retries; paid, stale and unauthorized edits fail", () => {
  const s = setup();
  try {
    let store = s.open();
    let v = store.handle(user, "app", { action: "load", patientId: "p" }, true)
      .body as ClinicBillingView;
    const send = (c: object) => {
      const r = store.handle(
        user,
        "app",
        {
          ...c,
          patientId: "p",
          expectedVersion: v.state.version,
          operationId: crypto.randomUUID(),
        },
        true,
      );
      assert.equal(r.status, 200);
      v = r.body as ClinicBillingView;
    };
    send({ action: "order", orderIds: [v.state.orders[0].id] });
    send({
      action: "invoice",
      orderIds: [v.state.orders[0].id],
      discountBps: 0,
      insuranceId: "",
      authorization: "",
      note: "Original",
    });
    const original = structuredClone(v.state.invoices[0]);
    const cmd = {
      action: "editInvoice",
      patientId: "p",
      expectedVersion: v.state.version,
      operationId: "correction",
      invoiceId: original.id,
      quantities: [{ orderId: original.lines[0].orderId, quantity: 2 }],
      discountBps: 1000,
      insuranceId: "policy",
      authorization: "DEMO",
      note: "Corrected",
      reason: "Quantity correction",
    };
    assert.equal(store.handle(user, "app", cmd, false).status, 403);
    assert.equal(
      store.handle(user, "app", { ...cmd, reason: "" }, true).status,
      400,
    );
    assert.equal(
      store.handle(
        user,
        "app",
        { ...cmd, quantities: [{ orderId: "foreign", quantity: 2 }] },
        true,
      ).status,
      400,
    );
    assert.equal(
      store.handle(user, "app", { ...cmd, insuranceId: "missing" }, true)
        .status,
      400,
    );
    const result = store.handle(user, "app", cmd, true);
    assert.equal(result.status, 200);
    v = result.body as ClinicBillingView;
    assert.equal(v.state.invoices[0].total, 4500);
    assert.equal(v.state.invoices[0].insurance, 2250);
    assert.deepEqual(v.state.invoices[0].revisions?.[0].invoice, original);
    assert.equal(
      v.state.invoices[0].revisions?.[0].reason,
      "Quantity correction",
    );
    store = s.open();
    assert.deepEqual(store.handle(user, "app", cmd, true), result);
    assert.equal(
      store.handle(user, "app", { ...cmd, operationId: "stale" }, true).status,
      409,
    );
    assert.equal(
      (
        store.handle(
          { ...user, tenantId: "other" },
          "app",
          { action: "load", patientId: "p" },
          true,
        ).body as ClinicBillingView
      ).state.invoices.length,
      0,
    );
    send({
      action: "payment",
      invoiceId: original.id,
      amount: 100,
      method: "cash",
      reference: "",
    });
    assert.equal(
      store.handle(
        user,
        "app",
        { ...cmd, operationId: "paid", expectedVersion: v.state.version },
        true,
      ).status,
      400,
    );
    send({
      action: "refund",
      paymentId: v.state.payments[0].id,
      reference: "Demo refund",
    });
    assert.equal(
      store.handle(
        user,
        "app",
        { ...cmd, operationId: "refunded", expectedVersion: v.state.version },
        true,
      ).status,
      400,
    );
  } finally {
    s.dispose();
  }
});
