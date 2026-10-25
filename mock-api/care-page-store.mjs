import { readFileSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { parseCsv, writeCsvSnapshot } from "./clinical-template-csv.ts";
const definitions = JSON.parse(
  readFileSync(
    new URL("./config/care-pages/pages.json", import.meta.url),
    "utf8",
  ),
);
const csv = (name) => {
  const [h, ...r] = parseCsv(
    readFileSync(
      new URL("./config/care-pages/" + name + ".csv", import.meta.url),
      "utf8",
    ),
  );
  return r
    .filter((x) => x.length === h.length)
    .map((x) => Object.fromEntries(h.map((k, i) => [k, x[i]])));
};
const patients = csv("patients"),
  beds = csv("beds").map((b) => ({
    ...b,
    isolation: b.isolation === "true",
    telemetry: b.telemetry === "true",
  }));
const fail = (status, error = "care.invalid", fieldErrors) => ({
  status,
  body: { error, ...(fieldErrors ? { fieldErrors } : {}) },
});
const digest = (x) =>
  createHash("sha256").update(JSON.stringify(x)).digest("hex");
export function createCarePageStore(file, clock = () => new Date()) {
  const read = () => {
    try {
      const [h, ...rows] = parseCsv(readFileSync(file, "utf8"));
      if (h.join(",") !== "scope,data") throw Error("Invalid care store");
      return Object.fromEntries(rows.map(([k, v]) => [k, JSON.parse(v)]));
    } catch (e) {
      if (e.code === "ENOENT") return {};
      throw e;
    }
  };
  return {
    handle(user, product, input) {
      const def = definitions.find((d) => d.id === input?.pageId);
      if (!def || !user?.tenantId || !user?.id) return fail(400);
      const all = read(),
        scope = JSON.stringify([user.tenantId, product]),
        bucket = all[scope] ?? {
          patients: [],
          records: [],
          receipts: {},
          reservations: {},
        };
      const own = (r) => r.owner === user.id && r.pageId === def.id;
      const view = (record) => ({
        definition: def,
        patients: [...patients, ...bucket.patients],
        beds: beds.map((b) => ({
          ...b,
          status: bucket.reservations[b.id]
            ? bucket.records.find((r) => r.id === bucket.reservations[b.id])
                ?.status === "draft"
              ? "Reserved"
              : "Occupied"
            : b.status,
        })),
        records: bucket.records.filter(own),
        record: record ?? null,
      });
      if (input.action === "load") {
        const r = input.id
          ? bucket.records.find((r) => r.id === input.id && own(r))
          : null;
        if (input.id && !r) return fail(404, "care.notFound");
        return { status: 200, body: view(r) };
      }
      if (
        typeof input.operationId !== "string" ||
        !/^[\w-]{1,100}$/.test(input.operationId)
      )
        return fail(400);
      const receiptKey = JSON.stringify([user.id, def.id, input.operationId]),
        prior = bucket.receipts[receiptKey];
      if (prior)
        return prior.hash === digest(input)
          ? { status: 200, body: prior.result }
          : fail(409, "care.conflict");
      let r = input.id
        ? bucket.records.find((r) => r.id === input.id && own(r))
        : null;
      if (input.id && !r) return fail(404, "care.notFound");
      if (r && r.version !== input.version) return fail(409, "care.conflict");
      const stamp = clock().toISOString();
      if (input.action === "create") {
        let p = [...patients, ...bucket.patients].find(
          (p) => p.id === input.patientId,
        );
        if (input.patient) {
          const p0 = input.patient;
          if (
            typeof p0.name !== "string" ||
            !p0.name.trim() ||
            p0.name.length > 120
          )
            return fail(400);
          if (p0.temporary && def.kind !== "emergency") return fail(400);
          if (
            !p0.temporary &&
            (!/^\d{4}-\d{2}-\d{2}$/.test(p0.dob) ||
              !Number.isFinite(Date.parse(p0.dob)) ||
              p0.dob > stamp.slice(0, 10))
          )
            return fail(400);
          if (
            !p0.temporary &&
            [...patients, ...bucket.patients].some(
              (x) =>
                x.name.toLowerCase() === p0.name.trim().toLowerCase() &&
                x.dob === p0.dob,
            )
          )
            return fail(409, "care.duplicate");
          p = {
            id: "DEMO-" + randomUUID(),
            name: p0.name.trim(),
            dob: p0.temporary ? "" : p0.dob,
            sex: String(p0.sex || ""),
            mobile: String(p0.mobile || ""),
            temporary: !!p0.temporary,
          };
          bucket.patients.push(p);
        }
        if (!p) return fail(400, "care.choosePatient");
        r = {
          id: "CARE-" + randomUUID(),
          owner: user.id,
          pageId: def.id,
          patient: p,
          values: { ...def.defaults },
          version: 0,
          status: "draft",
          step: 1,
          bedId: "",
          orders: [],
          events: [],
          notes: [],
          updatedAt: stamp,
        };
        bucket.records.unshift(r);
      } else {
        if (!r) return fail(404, "care.notFound");
        if (
          ["signed", "completed"].includes(r.status) &&
          input.action !== "addendum"
        )
          return fail(409, "care.readOnly");
        const extra = [
          "arrival",
          "source",
          "triage",
          "pathway",
          "disposition",
          "careArea",
          "identityVerified",
          "consentReviewed",
          "pendingPlan",
          "admissionType",
          "associated",
          "differential",
          "episode",
          "case",
          "referral",
        ];
        const fields = [
            ...def.groups.flatMap((g) => g.fields),
            ...def.tools.configuration.fields,
          ],
          allowed = new Map(fields.map((f) => [f.id, f]));
        if (input.values && input.action !== "addendum") {
          if (typeof input.values !== "object" || Array.isArray(input.values))
            return fail(400);
          for (const [k, v] of Object.entries(input.values)) {
            if (!allowed.has(k) && !extra.includes(k)) return fail(400);
            if (
              !["string", "boolean"].includes(typeof v) ||
              String(v).length > 8000
            )
              return fail(400);
            const f = allowed.get(k);
            if (f?.options && v !== "" && !f.options.some((o) => o.value === v))
              return fail(400);
          }
          r.values = { ...r.values, ...input.values };
        }
        if (input.action === "save") {
        } else if (input.action === "step") {
          if (!Number.isInteger(input.step) || input.step < 1 || input.step > 5)
            return fail(400);
          r.step = input.step;
        } else if (input.action === "open") {
          if (def.kind !== "emergency" || r.status !== "draft")
            return fail(409);
          r.status = "active";
        } else if (input.action === "reserve") {
          if (def.kind !== "inpatient" || r.status !== "draft")
            return fail(409);
          const b = beds.find((b) => b.id === input.bedId);
          if (!b) return fail(400);
          if (bucket.reservations[b.id] && bucket.reservations[b.id] !== r.id)
            return fail(409, "care.bedBusy");
          if (
            (r.values.careLevel && r.values.careLevel !== b.care) ||
            (r.values.isolationReq &&
              r.values.isolationReq !== "None" &&
              !b.isolation) ||
            (r.values.monitorReq &&
              r.values.monitorReq !== "Standard" &&
              !b.telemetry)
          )
            return fail(422, "care.bedMismatch");
          if (r.bedId) delete bucket.reservations[r.bedId];
          r.bedId = b.id;
          bucket.reservations[b.id] = r.id;
          r.values = {
            ...r.values,
            finalWard: b.ward,
            finalRoom: b.room,
            finalBed: b.id,
            finalBedStatus: "Reserved",
          };
        } else if (input.action === "order") {
          const o = input.order;
          if (
            !o ||
            !["medication", "laboratory", "imaging", "procedure"].includes(
              o.kind,
            ) ||
            !o.values ||
            !String(o.values.name ?? "").trim()
          )
            return fail(400);
          if (
            Object.values(o.values).some(
              (v) => typeof v !== "string" || v.length > 2000,
            )
          )
            return fail(400);
          r.orders.push({
            id: randomUUID(),
            kind: o.kind,
            values: o.values,
            status: "draft",
          });
        } else if (input.action === "removeOrder") {
          const o = r.orders.find((o) => o.id === input.orderId);
          if (!o) return fail(404);
          o.status = "cancelled";
        } else if (input.action === "addendum") {
          if (
            !["signed", "completed"].includes(r.status) ||
            typeof input.text !== "string" ||
            !input.text.trim() ||
            input.text.length > 8000
          )
            return fail(400);
          r.notes.push({ at: stamp, text: input.text });
        } else if (["admit", "sign", "complete"].includes(input.action)) {
          if (
            r.values.identityVerified !== true ||
            r.values.consentReviewed !== true
          )
            return fail(422, "care.verify");
          if (input.action === "admit") {
            if (
              def.kind !== "inpatient" ||
              r.status !== "draft" ||
              !r.bedId ||
              bucket.reservations[r.bedId] !== r.id
            )
              return fail(422, "care.bedRequired");
            const missing = [
              "source",
              "admissionReason",
              "specialty",
              "admittingDoctor",
              "attendingDoctor",
            ].filter((k) => !String(r.values[k] ?? "").trim());
            if (missing.length)
              return fail(
                422,
                "care.required",
                Object.fromEntries(missing.map((k) => [k, "Required"])),
              );
            if (!r.values.id1 || !r.values.id2 || r.values.id1===r.values.id2 || !r.values.verifySource) return fail(422,"care.verify");
            r.status = "admitted";
            r.values.finalBedStatus = "Occupied";
          } else if (input.action === "sign") {
            if (def.kind !== "consultation") return fail(400);
            const missing = fields.filter(
              (f) => f.required && !String(r.values[f.id] ?? "").trim(),
            );
            if (missing.length)
              return fail(
                422,
                "care.required",
                Object.fromEntries(missing.map((f) => [f.id, "Required"])),
              );
            r.status = "signed";
          } else {
            if (
              !["active", "admitted"].includes(r.status) ||
              def.kind === "consultation" ||
              !r.values.disposition ||
              !r.values.pendingPlan
            )
              return fail(422, "care.handover");
            r.status =
              "completed"; /* Bed remains reserved until a separate turnover workflow clears it. */
          }
        } else return fail(400);
      }
      r.version++;
      r.updatedAt = stamp;
      r.events.unshift({ at: stamp, action: "care.action." + input.action });
      const result = view(r);
      bucket.receipts[receiptKey] = {
        hash: digest(input),
        result: structuredClone(result),
      };
      all[scope] = bucket;
      const cell = (v) => '"' + String(v).replaceAll('"', '""') + '"';
      writeCsvSnapshot(
        file,
        "scope,data\n" +
          Object.entries(all)
            .map(([k, v]) => cell(k) + "," + cell(JSON.stringify(v)))
            .join("\n") +
          "\n",
      );
      return { status: 200, body: result };
    },
  };
}
