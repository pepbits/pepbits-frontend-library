import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClinicalTriageStore } from "./clinical-triage-store.ts";
import type {
  TriageView,
  TriageAssessment,
} from "../desktop-clients/packages/erp-config/src/clinical-triage.ts";
const user = { id: "nurse-demo", tenantId: "tenant", name: "Demo User" };
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "triage-")),
    file = join(dir, "triage.csv"),
    overview = (_u: unknown, _p: string, id: string) => ({
      status: 200,
      body: {
        patient: { id, mrn: "DEMO", values: {}, collections: {} },
        rows: [
          {
            id: "encounter",
            kind: "encounter",
            date: "2026-09-09",
            title: "Demo encounter",
          },
        ],
      },
    });
  return {
    file,
    open: () => createClinicalTriageStore(file, overview),
    done: () => rmSync(dir, { recursive: true, force: true }),
  };
}
test("draft persists and retries keep one identity; complete locks history and new assessments are blank", () => {
  const s = setup();
  try {
    let store = s.open();
    const view = store.handle(
      user,
      "app",
      { action: "load", patientId: "p" },
      true,
    ).body as TriageView;
    assert.ok(Object.values(view.blank.values.vitals).every((v) => v === ""));
    const assessment = structuredClone(view.blank);
    assessment.values.complaint = "Fictional concern";
    const body = {
      action: "save",
      patientId: "p",
      assessment,
      operationId: "draft",
      expectedVersion: 0,
      complete: false,
    };
    const saved = store.handle(user, "app", body, true);
    assert.equal(saved.status, 200);
    store = s.open();
    assert.deepEqual(store.handle(user, "app", body, true), saved);
    let record = saved.body as TriageAssessment;
    assert.equal(
      (
        store.handle(user, "app", { action: "load", patientId: "p" }, true)
          .body as TriageView
      ).assessments.length,
      1,
    );
    record = {
      ...record,
      values: {
        ...record.values,
        priority: "standard",
        allergyStatus: "unknown",
        destination: "review",
        missingReason: "Not measured in fictional test",
      },
    };
    const complete = {
      ...body,
      assessment: record,
      operationId: "complete",
      expectedVersion: record.version,
      complete: true,
    };
    const result = store.handle(user, "app", complete, true);
    assert.equal(result.status, 200);
    record = result.body as TriageAssessment;
    assert.equal(record.history.length, 2);
    assert.equal(record.status, "completed");
    assert.equal(
      store.handle(
        user,
        "app",
        {
          ...complete,
          operationId: "edit-locked",
          assessment: record,
          expectedVersion: record.version,
        },
        true,
      ).status,
      409,
    );
    const loaded = s
      .open()
      .handle(user, "app", { action: "load", patientId: "p" }, true)
      .body as TriageView;
    assert.equal(loaded.assessments[0].status, "completed");
    assert.ok(Object.values(loaded.blank.values.vitals).every((v) => v === ""));
  } finally {
    s.done();
  }
});
test("completion requires explicit safety/priority and measurements or a reason; malformed input is rejected", () => {
  const s = setup();
  try {
    const store = s.open(),
      view = store.handle(user, "app", { action: "load", patientId: "p" }, true)
        .body as TriageView;
    const save = (assessment: unknown) =>
      store.handle(
        user,
        "app",
        {
          action: "save",
          patientId: "p",
          assessment,
          operationId: crypto.randomUUID(),
          expectedVersion: 0,
          complete: true,
        },
        true,
      );
    assert.equal(save(view.blank).status, 400);
    let r = structuredClone(view.blank);
    Object.assign(r.values, {
      complaint: "Demo",
      priority: "urgent",
      allergyStatus: "reported",
      destination: "treatment",
      allergies: "Demo reaction",
      missingReason: "Not measured",
    });
    assert.equal(save(r).status, 200);
    r.values.vitals.oxygenSaturation = "101";
    assert.equal(save(r).status, 400);
    r.values.vitals.oxygenSaturation = "99";
    r.values.vitals.pain = "11";
    assert.equal(save(r).status, 400);
    assert.equal(
      save({ ...r, values: { ...r.values, allergies: { bad: true } } }).status,
      400,
    );
    assert.equal(save({ ...r, encounterId: "unknown" }).status, 400);
  } finally {
    s.done();
  }
});
test("server roles, tenant scope, optimistic versions and corrupt CSV are enforced", () => {
  const s = setup();
  try {
    const store = s.open(),
      v = store.handle(user, "app", { action: "load", patientId: "p" }, true)
        .body as TriageView,
      body = {
        action: "save",
        patientId: "p",
        assessment: v.blank,
        operationId: "one",
        expectedVersion: 0,
        complete: false,
      };
    assert.equal(store.handle(user, "app", body, false).status, 403);
    const r = store.handle(user, "app", body, true).body as TriageAssessment;
    assert.equal(
      store.handle(
        user,
        "app",
        { ...body, operationId: "stale", assessment: r },
        true,
      ).status,
      409,
    );
    assert.equal(
      (
        store.handle(
          { ...user, tenantId: "other" },
          "app",
          { action: "load", patientId: "p" },
          true,
        ).body as TriageView
      ).assessments.length,
      0,
    );
    assert.equal(
      store.handle(
        { ...user, tenantId: "other" },
        "app",
        { ...body, assessment: r, expectedVersion: 1 },
        true,
      ).status,
      404,
    );
    writeFileSync(s.file, "invalid,CSV");
    assert.throws(() =>
      store.handle(user, "app", { action: "load", patientId: "p" }, true),
    );
  } finally {
    s.done();
  }
});
