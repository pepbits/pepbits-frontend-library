import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCarePageStore } from "./care-page-store.mjs";
const user = { id: "user-a", tenantId: "tenant-a" };
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "care-pages-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "records.csv");
  return { file, store: createCarePageStore(file) };
}
const input = (action, extra = {}) => ({
  pageId: "emergency-registration",
  action,
  operationId: crypto.randomUUID(),
  ...extra,
});
test("all four definitions and every form section are supplied by API", (t) => {
  const { store } = fixture(t);
  for (const pageId of [
    "emergency-registration",
    "inpatient-admission",
    "consultation-entry-design",
    "consultation-entry-v2",
  ]) {
    const r = store.handle(user, "nexora", input("load", { pageId }));
    assert.equal(r.status, 200);
    assert.ok(r.body.definition.groups.length >= 7);
    assert.equal(r.body.patients.length, 4);
  }
});
test("create/save/replay survive CSV reload and reject stale writes and cross-scope reads", (t) => {
  const { store, file } = fixture(t);
  const create = input("create", { patientId: "DEMO-CARE-001" });
  const a = store.handle(user, "nexora", create);
  assert.equal(a.status, 200);
  assert.equal(
    store.handle(user, "nexora", create).body.record.id,
    a.body.record.id,
  );
  const record = a.body.record;
  const save = input("save", {
    id: record.id,
    version: record.version,
    values: { complaint: "Keep my unsaved clinical notes" },
  });
  assert.equal(store.handle(user, "nexora", save).status, 200);
  const fresh = createCarePageStore(file);
  assert.equal(
    fresh.handle(user, "nexora", input("load", { id: record.id })).body.record
      .values.complaint,
    "Keep my unsaved clinical notes",
  );
  assert.equal(
    fresh.handle(user, "nexora", { ...save, operationId: crypto.randomUUID() })
      .status,
    409,
  );
  for (const other of [
    { ...user, id: "other" },
    { ...user, tenantId: "other" },
  ])
    assert.equal(
      fresh.handle(other, "nexora", input("load", { id: record.id })).status,
      404,
    );
  assert.equal(
    fresh.handle(user, "other", input("load", { id: record.id })).status,
    404,
  );
});
test("temporary identity permitted for ED only; final verification is explicit", (t) => {
  const { store } = fixture(t);
  const patient = { name: "DEMO unidentified", temporary: true };
  assert.equal(
    store.handle(
      user,
      "nexora",
      input("create", { pageId: "inpatient-admission", patient }),
    ).status,
    400,
  );
  let r = store.handle(user, "nexora", input("create", { patient })).body
    .record;
  r = store.handle(
    user,
    "nexora",
    input("open", { id: r.id, version: r.version }),
  ).body.record;
  assert.equal(r.status, "active");
  assert.equal(
    store.handle(
      user,
      "nexora",
      input("complete", {
        id: r.id,
        version: r.version,
        values: {
          identityVerified: "true",
          consentReviewed: "true",
          disposition: "Home",
          pendingPlan: "Follow up",
        },
      }),
    ).status,
    422,
  );
});
test("bed reservation enforces requirements and concurrency across users", (t) => {
  const { store } = fixture(t);
  const a = store.handle(
    user,
    "nexora",
    input("create", {
      pageId: "inpatient-admission",
      patientId: "DEMO-CARE-001",
    }),
  ).body.record;
  const second = { ...user, id: "second" };
  const b = store.handle(
    second,
    "nexora",
    input("create", {
      pageId: "inpatient-admission",
      patientId: "DEMO-CARE-002",
    }),
  ).body.record;
  assert.equal(
    store.handle(
      user,
      "nexora",
      input("reserve", {
        pageId: "inpatient-admission",
        id: a.id,
        version: a.version,
        bedId: "MA-201-A",
        values: { careLevel: "ICU" },
      }),
    ).status,
    422,
  );
  assert.equal(
    store.handle(
      user,
      "nexora",
      input("reserve", {
        pageId: "inpatient-admission",
        id: a.id,
        version: a.version,
        bedId: "MA-201-A",
        values: {
          careLevel: "General Ward",
          isolationReq: "None",
          monitorReq: "Standard",
        },
      }),
    ).status,
    200,
  );
  assert.equal(
    store.handle(
      second,
      "nexora",
      input("reserve", {
        pageId: "inpatient-admission",
        id: b.id,
        version: b.version,
        bedId: "MA-201-A",
      }),
    ).status,
    409,
  );
});
test("order retains all instructions and cancellation preserves original record", (t) => {
  const { store } = fixture(t);
  let r = store.handle(
    user,
    "nexora",
    input("create", {
      pageId: "consultation-entry-v2",
      patientId: "DEMO-CARE-001",
    }),
  ).body.record;
  const values = {
    name: "DEMO study",
    contrast: "No contrast",
    indication: "Synthetic indication",
    collection: "Tomorrow",
    instructions: "Retain instructions",
  };
  r = store.handle(
    user,
    "nexora",
    input("order", {
      pageId: "consultation-entry-v2",
      id: r.id,
      version: r.version,
      order: { kind: "imaging", values },
    }),
  ).body.record;
  assert.deepEqual(r.orders[0].values, values);
  r = store.handle(
    user,
    "nexora",
    input("removeOrder", {
      pageId: "consultation-entry-v2",
      id: r.id,
      version: r.version,
      orderId: r.orders[0].id,
    }),
  ).body.record;
  assert.equal(r.orders[0].status, "cancelled");
  assert.deepEqual(r.orders[0].values, values);
});
test('admission records occupancy; completion does not release the bed',t=>{
 const {store}=fixture(t),pageId='inpatient-admission';let r=store.handle(user,'nexora',input('create',{pageId,patientId:'DEMO-CARE-001'})).body.record;
 r=store.handle(user,'nexora',input('reserve',{pageId,id:r.id,version:r.version,bedId:'MA-201-A',values:{careLevel:'General Ward',isolationReq:'None',monitorReq:'Standard'}})).body.record;
 const values={source:'ED',admissionReason:'Synthetic admission',specialty:'General Medicine',admittingDoctor:'Demo doctor',attendingDoctor:'Demo doctor',identityVerified:true,consentReviewed:true,id1:'MRN',id2:'Date of birth',verifySource:'Patient stated'};
 const a=store.handle(user,'nexora',input('admit',{pageId,id:r.id,version:r.version,values}));assert.equal(a.status,200);r=a.body.record;assert.equal(r.status,'admitted');assert.equal(a.body.beds.find(b=>b.id===r.bedId).status,'Occupied');
 const c=store.handle(user,'nexora',input('complete',{pageId,id:r.id,version:r.version,values:{disposition:'Home',pendingPlan:'Demo follow-up owner notified outside this example'}}));assert.equal(c.status,200);assert.equal(c.body.beds.find(b=>b.id===r.bedId).status,'Occupied');
});
test('signed notes reject edits; addenda cannot rewrite the original values',t=>{
 const {store}=fixture(t),pageId='consultation-entry-v2';let v=store.handle(user,'nexora',input('create',{pageId,patientId:'DEMO-CARE-001'})).body;
 const values={identityVerified:true,consentReviewed:true};for(const g of v.definition.groups)for(const f of g.fields)if(f.required)values[f.id]=f.options?.find(o=>o.value)?.value??'Synthetic note';
 let a=store.handle(user,'nexora',input('sign',{pageId,id:v.record.id,version:v.record.version,values}));assert.equal(a.status,200);let r=a.body.record;const original=structuredClone(r.values);
 assert.equal(store.handle(user,'nexora',input('save',{pageId,id:r.id,version:r.version,values:{f0_0_0:'Rewrite'}})).status,409);
 a=store.handle(user,'nexora',input('addendum',{pageId,id:r.id,version:r.version,text:'Additional synthetic clarification',values:{f0_0_0:'Rewrite'}}));assert.equal(a.status,200);assert.deepEqual(a.body.record.values,original);assert.equal(a.body.record.notes.length,1);
});
