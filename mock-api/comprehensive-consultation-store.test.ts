import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createComprehensiveConsultationStore } from "./comprehensive-consultation-store.ts";
import {
  scoreTotal,
  emComparison,
  validateComprehensive,
  type ComprehensiveValues,
  type ComprehensiveConfiguration,
} from "../desktop-clients/packages/erp-config/src/comprehensive-consultation.ts";
import type {
  ClinicalDocumentView,
  ClinicalDocument,
} from "../desktop-clients/packages/erp-config/src/clinical-document.ts";
const user = { id: "doctor", tenantId: "tenant", name: "Demo Author" };
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "comprehensive-"));
  const open = () =>
    createComprehensiveConsultationStore(
      join(dir, "records.csv"),
      (_u, _p, id) => ({
        status: 200,
        body: { patient: { id, mrn: "DEMO", values: {} }, rows: [] },
      }),
    );
  const store = open();
  const view = store.handle(
    user,
    "app",
    { action: "load", patientId: "p" },
    true,
  ).body as ClinicalDocumentView<
    ComprehensiveValues,
    ComprehensiveConfiguration
  >;
  return { dir, open, store, view };
}
function completed(f: ReturnType<typeof fixture>) {
  const v = structuredClone(f.view.blank.values);
  Object.assign(v, {
    clinician: f.view.config.clinicians[0].value,
    visitType: "new",
    complaint: "Fictional concern",
    examination: "Observed findings",
    diagnosis: "Authored assessment",
    treatment: "Authored plan",
    followUp: "Review plan",
    allergyReview: "reviewed",
    specialty: "general",
    context: "adult",
    profile: "custom",
    attested: true,
    diagnoses: [
      {
        id: "dx",
        system: "LOCAL",
        code: "DEMO",
        description: "Fictional diagnosis",
        primary: true,
      },
    ],
  });
  return v;
}
test("comprehensive CSV persists linked records, retries once, rejects stale and signed edits, isolates tenants", () => {
  const f = fixture();
  try {
    const body = {
      action: "save",
      patientId: "p",
      assessment: { ...f.view.blank, values: completed(f) },
      expectedVersion: 0,
      operationId: "one",
      complete: false,
    };
    assert.equal(f.store.handle(user, "app", body, false).status, 403);
    const result = f.store.handle(user, "app", body, true);
    assert.equal(result.status, 200);
    const record = result.body as ClinicalDocument<ComprehensiveValues>;
    assert.deepEqual(f.open().handle(user, "app", body, true), result);
    assert.ok(
      readFileSync(join(f.dir, "records.csv"), "utf8").includes(
        "Fictional diagnosis",
      ),
    );
    assert.equal(
      f
        .open()
        .handle(
          user,
          "app",
          { ...body, operationId: "stale", assessment: record },
          true,
        ).status,
      409,
    );
    const signed = f.open().handle(
      user,
      "app",
      {
        ...body,
        assessment: record,
        expectedVersion: 1,
        operationId: "sign",
        complete: true,
      },
      true,
    );
    assert.equal(signed.status, 200);
    assert.equal(
      (signed.body as ClinicalDocument<ComprehensiveValues>).actor,
      "Demo Author",
    );
    assert.equal(
      f.open().handle(
        user,
        "app",
        {
          ...body,
          assessment: signed.body,
          expectedVersion: 2,
          operationId: "edit",
        },
        true,
      ).status,
      409,
    );
    const other = f
      .open()
      .handle(
        { ...user, tenantId: "other" },
        "app",
        { action: "load", patientId: "p" },
        true,
      ).body as typeof f.view;
    assert.equal(other.assessments.length, 0);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});
test("reject malformed nested data, duplicate diagnoses, dangling orders and unsigned medication review", () => {
  const f = fixture();
  try {
    const v = completed(f),
      c = f.view.config;
    assert.deepEqual(validateComprehensive(v, c, true), {});
    for (const value of [null, {}, "invalid", 12]) {
      assert.ok(
        Object.keys(
          validateComprehensive(
            { ...v, diagnoses: value } as ComprehensiveValues,
            c,
            true,
          ),
        ).length,
      );
    }
    const d = v.diagnoses[0];
    assert.ok(
      validateComprehensive(
        { ...v, diagnoses: [d, { ...d, id: "other" }] },
        c,
        true,
      ).diagnoses,
    );
    const order = {
      id: "o",
      kind: "medication" as const,
      serviceId: "med-1",
      serviceCode: "DEMO-MED-1",
      codeSystem: "LOCAL",
      diagnosisId: "dx",
      priority: "routine",
      dose: "Demo dose",
      route: "Recorded route",
      frequency: "Recorded frequency",
      duration: "Recorded duration",
      timing: "",
      instructions: "",
      specimen: "",
      collection: "",
      laterality: "",
      contrast: "",
      indication: "Demo indication",
      allergyChecked: false,
      allergyNote: "",
    };
    assert.ok(validateComprehensive({ ...v, orders: [order] }, c, true).orders);
    assert.deepEqual(
      validateComprehensive(
        { ...v, orders: [{ ...order, allergyChecked: true }] },
        c,
        true,
      ),
      {},
    );
    assert.ok(
      validateComprehensive(
        {
          ...v,
          orders: [{ ...order, diagnosisId: "missing", allergyChecked: true }],
        },
        c,
        false,
      ).orders,
    );
    assert.ok(
      validateComprehensive({ ...v, attested: false }, c, true).attested,
    );
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});
test("score totals distinguish zero, incomplete, NT and invalid; E/M uses median and separate bounded time", () => {
  const f = fixture();
  try {
    const c = f.view.config,
      v = completed(f);
    const s = {
      id: "s",
      instrument: "gcs",
      measuredAt: "2026-09-10T10:00:00Z",
      inputs: { eye: "4", verbal: "5", motor: "6" },
      notes: "",
    };
    assert.equal(scoreTotal(s, c), 15);
    assert.equal(
      scoreTotal({ ...s, inputs: { ...s.inputs, eye: "NT" } }, c),
      null,
    );
    assert.equal(
      scoreTotal({ ...s, inputs: { ...s.inputs, eye: "" } }, c),
      null,
    );
    assert.equal(
      scoreTotal(
        {
          ...s,
          instrument: "qsofa",
          inputs: { qResp: "0", qBp: "0", qMental: "0" },
        },
        c,
      ),
      0,
    );
    assert.ok(
      validateComprehensive(
        { ...v, scores: [{ ...s, inputs: { ...s.inputs, eye: "5" } }] },
        c,
        true,
      ).scores,
    );
    v.em = {
      problems: "3",
      data: "1",
      risk: "2",
      minutes: "30",
      rationale: "Recorded rationale",
      finalCode: "",
    };
    assert.deepEqual(emComparison(v, c), {
      level: 2,
      mdm: "99204",
      time: "99203",
    });
    v.em.minutes = "75";
    assert.equal(emComparison(v, c).time, "");
    v.em.data = "";
    assert.equal(emComparison(v, c).mdm, "");
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});
