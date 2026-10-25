import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClinicalTemplateStore } from "./clinical-template-store.ts";
import type {
  PatientRecord,
  PatientSearchResult,
  PatientOverview,
} from "../desktop-clients/packages/erp-config/src/clinical-templates.ts";
const user = { id: "u1", name: "Test Admin", tenantId: "t1" };
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "clinical-template-test-")),
    file = join(dir, "data.json"),
    store = createClinicalTemplateStore(file);
  return {
    file,
    store,
    close: () => rmSync(dir, { recursive: true, force: true }),
    call: (input: unknown, who = user, write = true) =>
      store.handle(who, "nexora", input, write),
  };
}
test("patient search applies combined filters, sorting and pagination", () => {
  const x = setup();
  try {
    const r = x.call({
      action: "search",
      filters: { firstName: "Alex", nationality: "uae" },
    });
    assert.equal(r.status, 200);
    assert.equal((r.body as PatientSearchResult).total, 1);
    assert.equal(
      (
        x.call({
          action: "search",
          filters: { firstName: "Alex", nationality: "india" },
        }).body as PatientSearchResult
      ).total,
      0,
    );
    const page = x.call({
      action: "search",
      filters: { pageSize: 10, page: 2 },
    }).body as PatientSearchResult;
    assert.equal(page.rows.length, 2);
    assert.equal(page.total, 12);
  } finally {
    x.close();
  }
});
test("complete registration is atomic, persisted and retried idempotently", () => {
  const x = setup();
  try {
    const patient = x.call({ action: "new" }).body as PatientRecord;
    patient.values = {
      ...patient.values,
      firstName: "New",
      lastName: "Patient",
      birthDate: "2000-01-01",
      gender: "female",
      status: "active",
      branch: "main",
    };
    const request = {
      action: "save",
      record: patient,
      expectedVersion: 0,
      operationId: "create-1",
    };
    const first = x.call(request);
    assert.equal(first.status, 200);
    assert.deepEqual(x.call(request), first);
    const record = first.body as PatientRecord;
    assert.notEqual(record.id, "new");
    assert.equal(record.version, 1);
    assert.equal(
      (x.call({ action: "search" }).body as PatientSearchResult).total,
      13,
    );
    assert.deepEqual(
      createClinicalTemplateStore(x.file).handle(
        user,
        "nexora",
        { action: "load", id: record.id },
        true,
      ),
      first,
    );
    patient.values.firstName = "Changed";
    assert.equal(x.call(request).status, 409);
  } finally {
    x.close();
  }
});
test("validation, duplicate identity and stale versions cannot alter records", () => {
  const x = setup();
  try {
    const record = x.call({ action: "load", id: "PT-0001" })
        .body as PatientRecord,
      original = structuredClone(record);
    record.values.email = "invalid";
    assert.equal(
      x.call({
        action: "save",
        record,
        expectedVersion: 1,
        operationId: "bad-email",
      }).status,
      422,
    );
    record.values.email = original.values.email;
    record.collections.identifiers[0].value = "DEMO-00002";
    assert.equal(
      x.call({
        action: "save",
        record,
        expectedVersion: 1,
        operationId: "duplicate",
      }).status,
      422,
    );
    record.collections.identifiers = original.collections.identifiers;
    assert.equal(
      x.call({
        action: "save",
        record,
        expectedVersion: 0,
        operationId: "stale",
      }).status,
      409,
    );
    assert.deepEqual(x.call({ action: "load", id: record.id }).body, original);
  } finally {
    x.close();
  }
});
test("patient mutations are tenant/application scoped and permissions are enforced", () => {
  const x = setup();
  try {
    const p = x.call({ action: "load", id: "PT-0001" }).body as PatientRecord;
    p.values.firstName = "Scoped";
    const input = {
      action: "save",
      record: p,
      expectedVersion: 1,
      operationId: "scoped",
    };
    assert.equal(x.call(input, user, false).status, 403);
    assert.equal(x.call(input).status, 200);
    assert.equal(
      (
        x.call({ action: "load", id: p.id }, { ...user, tenantId: "other" })
          .body as PatientRecord
      ).values.firstName,
      "Alex",
    );
    assert.equal(
      (
        x.store.handle(user, "another-app", { action: "load", id: p.id }, true)
          .body as PatientRecord
      ).values.firstName,
      "Alex",
    );
  } finally {
    x.close();
  }
});
test("saved searches are user scoped; appointment writes are patient scoped and retry safe", () => {
  const x = setup();
  try {
    x.call({
      action: "save-search",
      name: "Mine",
      filters: { firstName: "Alex" },
    });
    assert.deepEqual(
      x.call({ action: "saved-searches" }, { ...user, id: "u2" }).body,
      [],
    );
    const input = {
      action: "schedule",
      patientId: "PT-0001",
      kind: "appointment",
      date: "2027-01-01",
      time: "12:00",
      provider: "provider-1",
      notes: "Demo only",
      operationId: "booking-1",
    };
    const first = x.call(input);
    assert.equal(first.status, 200);
    assert.deepEqual(x.call(input), first);
    assert.equal(
      (first.body as PatientOverview).rows.filter(
        (r) => r.detail === "Demo only",
      ).length,
      1,
    );
    assert.equal(
      x.call({ ...input, patientId: "PT-0002", operationId: "booking-2" })
        .status,
      409,
    );
    assert.equal(
      x.call({ ...input, date: "2027-02-31", operationId: "invalid-date" })
        .status,
      422,
    );
  } finally {
    x.close();
  }
});

test("eligibility reads the saved policy and rejects unknown policy identities", () => {
  const x = setup();
  try {
    const result = x.call({
      action: "eligibility",
      patientId: "PT-0001",
      insuranceId: "in1",
    });
    assert.equal(result.status, 200);
    assert.equal((result.body as { status: string }).status, "eligible");
    assert.equal(
      x.call({
        action: "eligibility",
        patientId: "PT-0001",
        insuranceId: "missing",
      }).status,
      404,
    );
  } finally {
    x.close();
  }
});

test("patient record keeps identifiers server managed and projects contact edits into search values", () => {
  const x = setup();
  try {
    const p = x.call({ action: "load", id: "PT-0001" }).body as PatientRecord;
    const uhid = p.values.uhid,
      mrn = p.mrn;
    p.values.uhid = "tampered";
    p.mrn = "tampered";
    p.values.status = "inactive";
    p.collections.contacts = p.collections.contacts.filter(
      (r) => r.contactType !== "email",
    );
    const result = x.call({
      action: "save",
      record: p,
      expectedVersion: 1,
      operationId: "record-projection",
    });
    assert.equal(result.status, 200);
    const saved = result.body as PatientRecord;
    assert.equal(saved.values.uhid, uhid);
    assert.equal(saved.mrn, mrn);
    assert.equal(saved.values.status, "active");
    assert.equal(saved.values.email, "");
    const loaded = x.call({ action: "load", id: p.id }).body as PatientRecord;
    assert.equal(
      loaded.collections.contacts.some((r) => r.contactType === "email"),
      false,
    );
  } finally {
    x.close();
  }
});

test("registry search uses whole words, phrases, exclusions and child-record values", () => {
  const x = setup();
  try {
    const search = (filters: Record<string, string>) =>
      x.call({ action: "search", filters }).body as PatientSearchResult;
    assert.equal(search({ q: "Alex" }).total, 1);
    assert.equal(search({ q: "Ale" }).total, 0);
    assert.equal(search({ q: '"Alex Morgan"' }).total, 1);
    assert.equal(search({ q: "Alex -Morgan" }).total, 0);
    assert.equal(search({ firstName: "lex" }).total, 1);
    const row = search({ firstName: "Alex" }).rows[0];
    const p = x.call({ action: "load", id: row.id }).body as PatientRecord;
    const contact = p.collections.contacts.find(
      (c) => c.contactType === "email",
    );
    assert.ok(contact);
    assert.equal(search({ q: contact.value }).rows[0].id, row.id);
    const address = p.collections.addresses[0];
    assert.ok(address?.country);
    assert.ok(
      search({ country: address.country }).rows.some((r) => r.id === row.id),
    );
    const identifier = p.collections.identifiers[0];
    assert.ok(identifier?.identityType);
    {
      assert.equal(
        search({
          identity: identifier.value,
          identityType: identifier.identityType,
        }).rows[0].id,
        row.id,
      );
      assert.equal(
        search({ identity: identifier.value, identityType: "nonexistent" })
          .total,
        0,
      );
    }
    assert.equal(search({ q: "zzzz-unmatched" }).total, 0);
    assert.equal(search({ mobile: "not-a-phone" }).total, 0);
    assert.equal(
      search({ mobile: "00000000001", mobileCode: "+0" }).rows[0].id,
      row.id,
    );
    assert.equal(search({ mobile: "00000000001", mobileCode: "+91" }).total, 0);
    assert.equal(search({ q: "!!!" }).total, 0);
  } finally {
    x.close();
  }
});
