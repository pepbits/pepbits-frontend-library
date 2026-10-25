import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createRegistrationStore } from "./op-registration-store.ts";
import type {
  RegistrationView,
  RegistrationCommand,
} from "../desktop-clients/packages/erp-config/src/op-registration.ts";
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "registration-")),
    file = join(dir, "records.csv"),
    user = { id: "u1", tenantId: "t1" },
    overview = () => ({
      status: 200,
      body: {
        patient: {
          id: "PT-1",
          values: { birthDate: "1980-01-01" },
          collections: {},
          activity: [],
        },
      },
    }),
    clock = () => new Date("2026-09-10T10:00:00Z");
  const store = createRegistrationStore(file, overview, clock);
  let view = store.handle(
    user,
    "demo",
    { action: "load", patientId: "PT-1" },
    true,
  ).body as RegistrationView;
  const send = (action: string, values = {}, payload = {}) => {
    const input: RegistrationCommand = {
      action,
      patientId: "PT-1",
      id: view.record.id || undefined,
      version: view.record.version,
      operationId: randomUUID(),
      values: { ...view.record.values, ...values },
      payload,
    };
    const response = store.handle(user, "demo", input, true);
    if (response.status === 200) view = response.body as RegistrationView;
    return { response, input };
  };
  return {
    dir,
    file,
    user,
    store,
    overview,
    clock,
    send,
    get view() {
      return view;
    },
  };
}
const ready = {
  identityName: true,
  identityDob: true,
  reason: "Synthetic consultation",
  consentReviewed: true,
  treatment: "accepted",
  privacy: "acknowledged",
};
test("required validation, persistent check-in and idempotent retries", () => {
  const s = setup();
  try {
    assert.equal(s.send("checkin").response.status, 422);
    const { response, input } = s.send("checkin", ready);
    assert.equal(response.status, 200);
    assert.equal(s.view.record.status, "active");
    assert.deepEqual(s.store.handle(s.user, "demo", input, true), response);
    const restarted = createRegistrationStore(s.file, s.overview, s.clock);
    const loaded = restarted.handle(
      s.user,
      "demo",
      { action: "load", patientId: "PT-1", id: s.view.record.id },
      true,
    ).body as RegistrationView;
    assert.equal(loaded.record.id, s.view.record.id);
    assert.equal(
      s.store.handle(
        { ...s.user, tenantId: "other" },
        "demo",
        { action: "load", patientId: "PT-1", id: s.view.record.id },
        true,
      ).status,
      404,
    );
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});
test("write permission, optimistic conflict, server-owned eligibility and duplicate encounters", () => {
  const s = setup();
  try {
    const draft = s.send("draft", { ...ready, eligibility: "eligible" });
    assert.equal(s.view.record.values.eligibility, "not-checked");
    assert.equal(
      s.store.handle(
        s.user,
        "demo",
        { ...draft.input, operationId: randomUUID() },
        false,
      ).status,
      403,
    );
    s.send("checkin", ready);
    assert.equal(
      s.store.handle(
        s.user,
        "demo",
        { ...draft.input, id: s.view.record.id, operationId: randomUUID() },
        true,
      ).status,
      409,
    );
    const duplicate = s.store.handle(
      { ...s.user, id: "u2" },
      "demo",
      {
        action: "checkin",
        patientId: "PT-1",
        version: 0,
        operationId: randomUUID(),
        values: { ...s.view.config.defaults, ...ready },
      },
      true,
    );
    assert.equal(duplicate.status, 409);
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});
test("clinical lifecycle: signed note immutable, service charges, payments, completion and addenda", () => {
  const s = setup();
  try {
    s.send("checkin", ready);
    assert.equal(s.send("sign", {}, { confirm: true }).response.status, 422);
    assert.equal(
      s.send("nursing", {
        allergy: "Unknown reviewed",
        medications: "None reported",
        allergyReviewed: true,
        medicationsReviewed: true,
        bpSys: "120",
        bpDia: "80",
      }).response.status,
      200,
    );
    assert.equal(
      s.send(
        "sign",
        {
          history: "History",
          assessment: "Assessment",
          diagnosis: "Demo",
          plan: "Return precautions",
          careIdentity: true,
        },
        { confirm: true },
      ).response.status,
      200,
    );
    s.send("save", { history: "tamper" });
    assert.equal(s.view.record.values.history, "History");
    s.send(
      "order-add",
      {},
      { serviceId: "L1", note: "Demo indication", confirm: true },
    );
    const orderId = s.view.record.orders[0].id;
    s.send("order-start", {}, { orderId });
    s.send(
      "order-complete",
      {},
      { orderId, note: "Demo result", confirm: true },
    );
    assert.equal(
      s.send("payment", {}, { amount: 331, method: "cash" }).response.status,
      422,
    );
    assert.equal(
      s.send("payment", {}, { amount: 330, method: "cash" }).response.status,
      200,
    );
    assert.equal(
      s.send("complete", {
        instructionsReviewed: true,
        followup: "not-required",
      }).response.status,
      200,
    );
    assert.equal(
      s.send("addendum", {}, { note: "Correction added" }).response.status,
      200,
    );
    assert.equal(s.view.record.addenda.length, 1);
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});
test("pending results require ownership, draft policy excludes sensitive fields and expires drafts", () => {
  const s = setup();
  try {
    s.send("draft", { ...ready, reason: "Sensitive reason" });
    const policy = {
      revision: 1,
      enabled: true,
      retentionDays: 7,
      excludedFields: ["reason"],
    };
    s.store.scrub(s.user, "demo", policy);
    const limited = createRegistrationStore(
      s.file,
      s.overview,
      s.clock,
      () => policy,
    );
    const restored = limited.handle(
      s.user,
      "demo",
      { action: "load", patientId: "PT-1" },
      true,
    ).body as RegistrationView;
    assert.equal(restored.record.values.reason, "");
    limited.scrub(s.user, "demo", { ...policy, enabled: false });
    assert.equal(
      (
        limited.handle(
          s.user,
          "demo",
          { action: "load", patientId: "PT-1" },
          true,
        ).body as RegistrationView
      ).record.id,
      "",
    );
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});
test("appointment slot conflict and patient association validation", () => {
  const s = setup();
  try {
    s.send("draft", ready);
    assert.equal(
      s.send(
        "book",
        {},
        { date: "2026-09-10", time: "12:00", provider: "P1", note: "Visit" },
      ).response.status,
      200,
    );
    assert.equal(
      s.send("book", {}, { date: "2026-09-10", time: "12:00", provider: "P1" })
        .response.status,
      409,
    );
    const appointment = s.view.appointments[0];
    assert.equal(
      s.send("checkin", {
        ...ready,
        source: "appointment",
        appointmentId: appointment.id,
      }).response.status,
      200,
    );
    assert.equal(s.view.appointments[0].status, "arrived");
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});
test("pending results require an owner, date and plan; clinical closure is independent of payment", () => {
  const s = setup();
  try {
    s.send("checkin", ready);
    s.send(
      "sign",
      {
        history: "H",
        assessment: "A",
        diagnosis: "D",
        plan: "P",
        careIdentity: true,
      },
      { confirm: true },
    );
    s.send(
      "order-add",
      {},
      { serviceId: "L1", note: "Indication", confirm: true },
    );
    assert.equal(
      s.send("complete", {
        instructionsReviewed: true,
        followup: "not-required",
      }).response.status,
      422,
    );
    assert.equal(
      s.send("complete", {
        instructionsReviewed: true,
        followup: "not-required",
        resultOwner: "Demo clinician",
        resultDue: "2026-09-11",
        followupPlan: "Review and contact patient",
      }).response.status,
      200,
    );
    assert.equal(s.view.record.payments.length, 0);
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});
test("discount cannot create overpayment and reversals preserve the original payment", () => {
  const s = setup();
  try {
    s.send("checkin", ready);
    s.send(
      "sign",
      {
        history: "H",
        assessment: "A",
        diagnosis: "D",
        plan: "P",
        careIdentity: true,
      },
      { confirm: true },
    );
    s.send("payment", {}, { amount: 250, method: "cash" });
    assert.equal(
      s.send("discount", {}, { amount: 10, note: "Correction" }).response
        .status,
      422,
    );
    const paymentId = s.view.record.payments[0].id;
    assert.equal(
      s.send("reverse", {}, { paymentId, note: "Wrong payment" }).response
        .status,
      200,
    );
    assert.equal(s.view.record.payments[0].reversed, true);
    assert.equal(
      s.send("discount", {}, { amount: 10, note: "Authorized correction" })
        .response.status,
      200,
    );
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});
test("disabled drafts do not prevent check-in or ephemeral eligibility checks", () => {
  const s = setup();
  try {
    const store = createRegistrationStore(s.file, s.overview, s.clock, () => ({
      revision: 1,
      enabled: false,
      retentionDays: 7,
      excludedFields: [],
    }));
    const values = {
      ...s.view.config.defaults,
      ...ready,
      responsibility: "insurance",
      payer: "Demo payer",
      member: "DEMO-123",
    };
    const input = {
      patientId: "PT-1",
      version: 0,
      values,
      operationId: randomUUID(),
    };
    assert.equal(
      store.handle(s.user, "demo", { ...input, action: "draft" }, true).status,
      403,
    );
    assert.equal(
      store.handle(s.user, "demo", { ...input, action: "eligibility" }, true)
        .status,
      200,
    );
    assert.equal(
      store.handle(s.user, "demo", { ...input, action: "checkin" }, true)
        .status,
      200,
    );
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});
