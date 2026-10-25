import {
  DEFAULT_DRAFT_POLICY,
  filterDraftValues,
  type DraftPolicy,
} from "../desktop-clients/packages/erp-config/src/draft-policy.ts";
import { readFileSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { parseCsv, writeCsvSnapshot } from "./clinical-template-csv.ts";
import {
  registrationErrors,
  registrationLedger,
  type RegistrationConfig,
  type RegistrationCommand,
  type RegistrationRecord,
  type RegistrationAppointment,
  type RegistrationValues,
} from "../desktop-clients/packages/erp-config/src/op-registration.ts";
import type { PatientOverview } from "../desktop-clients/packages/erp-config/src/clinical-templates.ts";
type User = { id: string; tenantId?: string; name?: string };
type Result = { status: number; body: unknown };
type Bucket = {
  records: RegistrationRecord[];
  appointments: RegistrationAppointment[];
  receipts: Record<string, { hash: string; record: RegistrationRecord }>;
};
const directory = new URL("./config/op-registration/", import.meta.url);
const base = JSON.parse(
  readFileSync(new URL("form.json", directory), "utf8"),
) as RegistrationConfig;
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value + "T12:00:00Z")) &&
  new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
function csv(name: string) {
  const [headers, ...rows] = parseCsv(
    readFileSync(new URL(name, directory), "utf8"),
  );
  return rows.map((row) =>
    Object.fromEntries(headers.map((h, i) => [h, row[i]])),
  );
}
base.providers = csv("providers.csv").map((p) => ({
  ...p,
  fee: Number(p.fee),
})) as RegistrationConfig["providers"];
base.services = csv("services.csv").map((p) => ({
  ...p,
  price: Number(p.price),
})) as RegistrationConfig["services"];
export function createRegistrationStore(
  file: string,
  overview: (user: User, product: string, id: string) => Result,
  clock = () => new Date(),
  policyFor: (user: User, product: string) => DraftPolicy = () =>
    DEFAULT_DRAFT_POLICY,
) {
  const fail = (
    status: number,
    key: string,
    fields: Record<string, string> = {},
  ): Result => ({
    status,
    body: {
      error: "registration." + key,
      fieldErrors: Object.keys(fields).length
        ? fields
        : { form: "registration." + key },
    },
  });
  function read(): Record<string, Bucket> {
    try {
      const [header, ...rows] = parseCsv(readFileSync(file, "utf8"));
      if (header.join(",") !== "scope,data")
        throw Error("Invalid registration CSV");
      const all: Record<string, Bucket> = Object.create(null);
      for (const row of rows) {
        if (row.length !== 2 || all[row[0]])
          throw Error("Invalid registration scope");
        all[row[0]] = JSON.parse(row[1]);
      }
      return all;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT")
        return Object.create(null);
      throw e;
    }
  }
  function write(all: Record<string, Bucket>) {
    const quote = (v: string) => '"' + v.replaceAll('"', '""') + '"';
    writeCsvSnapshot(
      file,
      "scope,data\r\n" +
        Object.entries(all)
          .map(([scope, b]) => [scope, JSON.stringify(b)].map(quote).join(","))
          .join("\r\n") +
        "\r\n",
    );
  }
  function scrub(user: User, product: string, policy: DraftPolicy) {
    const all = read(),
      scope = JSON.stringify([user.tenantId ?? "demo", product]),
      bucket = all[scope];
    if (!bucket) return;
    bucket.records = bucket.records.filter(
      (r) =>
        r.status !== "draft" ||
        (policy.enabled &&
          Date.parse(r.updatedAt) >=
            clock().getTime() - policy.retentionDays * 86400000),
    );
    for (const r of bucket.records)
      if (r.status === "draft")
        r.values = filterDraftValues(r.values, policy).values;
    for (const [key, receipt] of Object.entries(bucket.receipts)) {
      if (receipt.record.status === "draft") {
        const exists = bucket.records.some((r) => r.id === receipt.record.id);
        if (!exists) delete bucket.receipts[key];
        else
          receipt.record.values = filterDraftValues(
            receipt.record.values,
            policy,
          ).values;
      }
    }
    write(all);
  }
  function prune() {
    for (const scope of Object.keys(read())) {
      const [tenantId, product] = JSON.parse(scope);
      const user = { id: "system", tenantId };
      scrub(user, product, policyFor(user, product));
    }
  }
  return {
    scrub,
    prune,
    handle(
      user: User,
      product: string,
      input: unknown,
      canWrite: boolean,
    ): Result {
      if (!input || typeof input !== "object" || Array.isArray(input))
        return fail(400, "invalid");
      const body = input as RegistrationCommand,
        now = clock().toISOString(),
        today = now.slice(0, 10),
        config = { ...structuredClone(base), today, canWrite };
      if (body.action === "config") return { status: 200, body: config };
      const policy = policyFor(user, product);
      const scope = JSON.stringify([user.tenantId ?? "demo", product]),
        all = read(),
        bucket = (all[scope] ??= {
          records: [],
          appointments: [],
          receipts: Object.create(null),
        });
      bucket.records = bucket.records.filter(
        (r) =>
          r.status !== "draft" ||
          (policy.enabled &&
            Date.parse(r.updatedAt) >=
              clock().getTime() - policy.retentionDays * 86400000),
      );
      if (body.action === "worklist")
        return {
          status: 200,
          body: {
            records: bucket.records.filter(
              (r) => r.status !== "draft" || r.owner === user.id,
            ),
            appointments: bucket.appointments,
          },
        };
      if (typeof body.patientId !== "string" || body.patientId.length > 100)
        return fail(400, "invalid");
      const result = overview(user, product, body.patientId);
      if (result.status !== 200) return result;
      const patient = (result.body as PatientOverview).patient;
      const blank = (): RegistrationRecord => ({
        id: "",
        patientId: body.patientId!,
        owner: user.id,
        version: 0,
        status: "draft",
        values: structuredClone(config.defaults),
        orders: [],
        payments: [],
        signedAt: "",
        signedBy: "",
        addenda: [],
        events: [],
        updatedAt: now,
      });
      const found = body.id
        ? bucket.records.find(
            (r) =>
              r.id === body.id &&
              r.patientId === body.patientId &&
              (r.status !== "draft" || r.owner === user.id),
          )
        : bucket.records.find(
            (r) =>
              r.patientId === body.patientId &&
              r.status === "draft" &&
              r.owner === user.id,
          );
      if (body.action === "load" && body.id && !found)
        return fail(404, "notFound");
      const view = (record: RegistrationRecord) => ({
        config: { ...config, draftsEnabled: policy.enabled },
        patient,
        record:
          record.status === "draft"
            ? {
                ...record,
                values: {
                  ...config.defaults,
                  ...filterDraftValues(record.values, policy).values,
                },
              }
            : record,
        appointments: bucket.appointments.filter(
          (a) => a.patientId === body.patientId,
        ),
      });
      if (body.action === "load")
        return { status: 200, body: view(found ?? blank()) };
      if (!canWrite) return fail(403, "denied");
      if (
        typeof body.operationId !== "string" ||
        body.operationId.length < 8 ||
        body.operationId.length > 100
      )
        return fail(400, "invalid");
      const receiptKey = JSON.stringify([user.id, body.operationId]),
        hash = createHash("sha256").update(JSON.stringify(body)).digest("hex"),
        receipt = bucket.receipts[receiptKey];
      if (receipt)
        return receipt.hash === hash
          ? { status: 200, body: view(receipt.record) }
          : fail(409, "conflict");
      if (body.id && !found) return fail(404, "notFound");
      if ((found?.version ?? 0) !== body.version) return fail(409, "conflict");
      const record = structuredClone(found ?? blank()),
        payload = body.payload ?? {};
      const text = (id: string) =>
        typeof payload[id] === "string" ? String(payload[id]).trim() : "";
      const event = (key: string) =>
        record.events.unshift({
          key: "registration." + key,
          at: now,
          actor: user.name ?? user.id,
        });
      const groups = (ids: string[]) =>
        config.groups
          .filter((g) => ids.includes(g.id))
          .flatMap((g) => g.fields.map((f) => f.id));
      const clinicalFields = groups(["consultation"]);
      const editable =
        record.status === "draft"
          ? Object.keys(config.defaults)
          : groups(["nursing", "consultation", "checkout"]);
      if (body.values) {
        if (typeof body.values !== "object" || Array.isArray(body.values))
          return fail(400, "invalid");
        for (const [key, value] of Object.entries(body.values)) {
          if (
            !editable.includes(key) ||
            [
              "eligibility",
              "called",
              "nursingDone",
              "claim",
              "followupAppointment",
              "urgentNote",
              "encounterDate",
            ].includes(key)
          )
            continue;
          if (
            !["string", "boolean"].includes(typeof value) ||
            String(value).length > 10000
          )
            return fail(400, "invalid");
          if (
            record.status === "completed" ||
            (record.signedAt && clinicalFields.includes(key))
          )
            continue;
          const field = config.groups
            .flatMap((g) => g.fields)
            .find((f) => f.id === key);
          if (field?.type === "checkbox" && typeof value !== "boolean")
            return fail(400, "invalid");
          if (
            field?.options?.length &&
            !field.options.some((o) => o.value === value)
          )
            return fail(400, "invalid");
          record.values[key] = value;
        }
      }
      const v = record.values;
      // Coverage responses are server-owned and invalidated when identifying inputs change.
      if (
        found &&
        ["member", "payer", "expiry", "provider"].some(
          (k) => found.values[k] !== v[k],
        )
      )
        v.eligibility = "not-checked";
      const required = (keys: string[]) =>
        keys.every(
          (k) =>
            v[k] === true || (typeof v[k] === "string" && String(v[k]).trim()),
        );
      const minor = () => {
        const dob = String(patient.values.birthDate ?? "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
        const cutoff = new Date(now);
        cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 18);
        return dob > cutoff.toISOString().slice(0, 10);
      };
      const open = () =>
        record.orders.filter(
          (o) => !["completed", "cancelled"].includes(o.status),
        );
      if (
        record.status === "completed" &&
        ![
          "addendum",
          "payment",
          "reverse",
          "claim",
          "order-complete",
          "document",
        ].includes(body.action)
      )
        return fail(409, "conflict");
      switch (body.action) {
        case "discard": {
          if (record.status !== "draft") return fail(409, "conflict");
          bucket.records = bucket.records.filter((r) => r.id !== record.id);
          const response = { status: 200, body: view(blank()) };
          bucket.receipts[receiptKey] = {
            hash,
            record: (response.body as { record: RegistrationRecord }).record,
          };
          write(all);
          return response;
        }
        case "draft":
          if (!policy.enabled) return fail(403, "denied");
          if (record.status !== "draft") return fail(409, "conflict");
          event("draftEvent");
          break;
        case "checkin": {
          if (record.status !== "draft") return fail(409, "duplicate");
          if (!policy.enabled && v.responsibility === "insurance")
            v.eligibility =
              String(v.member).startsWith("DEMO-") &&
              (!v.expiry || String(v.expiry) >= today)
                ? "eligible"
                : "pending";
          const errors = registrationErrors(v, config, 3);
          if (Object.keys(errors).length) return fail(422, "required", errors);
          if (minor() && (!v.guardianVerified || !v.representative))
            return fail(422, "guardianRequired");
          if (
            v.responsibility === "insurance" &&
            String(v.expiry) < today &&
            v.expiry &&
            !v.financialReason
          )
            return fail(422, "expired");
          if (
            v.authorization === "approved" &&
            (!required([
              "authorizationId",
              "authorizationFrom",
              "authorizationTo",
            ]) ||
              String(v.authorizationFrom) > today ||
              String(v.authorizationTo) < today ||
              (v.template === "physiotherapy" &&
                Number(v.usedSessions) >= Number(v.approvedSessions))) &&
            !v.financialReason
          )
            return fail(422, "expired");
          const provider = config.providers.find((p) => p.id === v.provider)!;
          if (
            bucket.records.some(
              (r) =>
                r.id !== record.id &&
                r.patientId === record.patientId &&
                r.status === "active" &&
                config.providers.find((p) => p.id === r.values.provider)
                  ?.specialty === provider.specialty,
            )
          )
            return fail(409, "duplicate");
          if (v.source === "appointment") {
            const appointment = bucket.appointments.find(
              (a) =>
                a.id === v.appointmentId &&
                a.patientId === record.patientId &&
                a.date === today &&
                a.provider === v.provider,
            );
            if (!appointment || appointment.status !== "booked")
              return fail(409, "duplicate");
            appointment.status = "arrived";
            appointment.encounterId = record.id || "pending";
          }
          record.status = "active";
          v.encounterDate = today;
          event("checkinEvent");
          break;
        }
        case "eligibility":
          if (!required(["payer", "member"])) return fail(422, "required");
          v.eligibility =
            v.expiry && String(v.expiry) < today
              ? "pending"
              : String(v.member).startsWith("DEMO-")
                ? "eligible"
                : "pending";
          event("eligibilityEvent");
          break;
        case "save":
          if (record.status !== "active") return fail(409, "conflict");
          event("saveEvent");
          break;
        case "call":
          if (record.status !== "active") return fail(409, "conflict");
          v.called = true;
          event("called");
          break;
        case "nursing": {
          if (record.status !== "active") return fail(409, "conflict");
          const ranges: Record<string, [number, number]> = {
            bpSys: [20, 350],
            bpDia: [10, 250],
            pulse: [10, 350],
            temperature: [25, 45],
            spo2: [0, 100],
            pain: [0, 10],
            weight: [0.1, 500],
            height: [20, 260],
          };
          if (
            Object.entries(ranges).some(
              ([k, [min, max]]) =>
                v[k] !== "" &&
                (!Number.isFinite(Number(v[k])) ||
                  Number(v[k]) < min ||
                  Number(v[k]) > max),
            ) ||
            Boolean(v.bpSys) !== Boolean(v.bpDia) ||
            (v.bpSys && Number(v.bpSys) <= Number(v.bpDia)) ||
            !required([
              "allergy",
              "medications",
              "allergyReviewed",
              "medicationsReviewed",
            ])
          )
            return fail(422, "clinicalCheck");
          v.nursingDone = true;
          event("nursingDone");
          break;
        }
        case "resolve-consent":
          if (
            record.status !== "active" ||
            payload.confirm !== true ||
            !text("note")
          )
            return fail(422, "consentRequired");
          v.treatment = "accepted";
          v.consentNote = text("note");
          event("consentEvent");
          break;
        case "sign":
          if (
            record.status !== "active" ||
            record.signedAt ||
            v.treatment !== "accepted" ||
            !required([
              "history",
              "assessment",
              "diagnosis",
              "plan",
              "careIdentity",
            ]) ||
            payload.confirm !== true
          )
            return fail(422, "signRequired");
          record.signedAt = now;
          record.signedBy = user.name ?? user.id;
          event("signEvent");
          break;
        case "addendum":
          if (!record.signedAt || !text("note")) return fail(422, "required");
          record.addenda.push({
            text: text("note"),
            at: now,
            actor: user.name ?? user.id,
          });
          event("addendumEvent");
          break;
        case "order-add": {
          if (
            record.status !== "active" ||
            v.treatment !== "accepted" ||
            payload.confirm !== true ||
            !text("note")
          )
            return fail(422, "serviceCheck");
          const service = config.services.find(
            (s) => s.id === payload.serviceId,
          );
          if (!service) return fail(422, "invalid");
          if (
            (service.category === "imaging" && !text("site")) ||
            (service.category === "medication" &&
              !required(["allergyReviewed", "medicationsReviewed"]))
          )
            return fail(422, "serviceCheck");
          if (
            record.orders.some(
              (o) => o.serviceId === service.id && o.status !== "cancelled",
            )
          )
            return fail(409, "duplicate");
          record.orders.push({
            id: "ORD-" + randomUUID(),
            serviceId: service.id,
            label: service.label,
            category: service.category,
            price: service.price,
            status: "ordered",
            note: [text("note"), text("site")].filter(Boolean).join(" · "),
            tracking: "",
          });
          event("orderEvent");
          break;
        }
        case "order-start":
        case "order-complete":
        case "order-cancel": {
          const order = record.orders.find((o) => o.id === payload.orderId);
          if (!order) return fail(404, "notFound");
          if (body.action === "order-start") {
            if (order.status !== "ordered") return fail(409, "conflict");
            order.status = "started";
            order.tracking = "DEMO-" + randomUUID();
          } else {
            if (!["ordered", "started"].includes(order.status) || !text("note"))
              return fail(422, "required");
            if (body.action === "order-complete") {
              if (
                order.status !== "started" ||
                payload.confirm !== true ||
                (order.category === "medication" &&
                  (!text("batch") ||
                    !validDate(text("expiry")) ||
                    text("expiry") < today))
              )
                return fail(422, "serviceCheck");
              order.status = "completed";
            } else order.status = "cancelled";
            order.note += "\n" + text("note");
          }
          event("orderEvent");
          break;
        }
        case "discount": {
          const amount = Number(payload.amount);
          if (
            record.status === "draft" ||
            !Number.isFinite(amount) ||
            amount < 0 ||
            amount > registrationLedger(record, config).gross ||
            !text("note")
          )
            return fail(422, "paymentCheck");
          v.discount = String(Math.round(amount * 100) / 100);
          if (
            registrationLedger(record, config).paid >
            registrationLedger(record, config).patient
          )
            return fail(422, "paymentCheck");
          v.discountReason = text("note");
          v.claim = "claimDraft";
          event("discountEvent");
          break;
        }
        case "document":
          event("documentEvent");
          break;
        case "payment": {
          const amount = Number(payload.amount),
            ledger = registrationLedger(record, config);
          if (
            record.status === "draft" ||
            !Number.isFinite(amount) ||
            amount <= 0 ||
            Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6 ||
            amount > ledger.balance ||
            !["cash", "card", "transfer-payment"].includes(text("method"))
          )
            return fail(422, "paymentCheck");
          record.payments.push({
            id: "PAY-" + randomUUID(),
            amount,
            method: text("method"),
            at: now,
            reversed: false,
            reason: "",
          });
          event("paymentEvent");
          break;
        }
        case "reverse": {
          const payment = record.payments.find(
            (p) => p.id === payload.paymentId,
          );
          if (!payment || payment.reversed || !text("note"))
            return fail(422, "required");
          payment.reversed = true;
          payment.reason = text("note");
          event("reverseEvent");
          break;
        }
        case "claim": {
          const stage = text("stage");
          if (stage === "draft") v.claim = "claimDraft";
          else if (stage === "validate") {
            if (
              !record.signedAt ||
              !v.diagnosisCode ||
              v.responsibility !== "insurance" ||
              v.eligibility !== "eligible" ||
              ["pending", "denied"].includes(String(v.authorization)) ||
              open().length
            )
              return fail(422, "claimInvalid");
            v.claim = "claimValidated";
          } else if (stage === "submit" && v.claim === "claimValidated")
            v.claim = "claimSubmitted";
          else return fail(422, "claimInvalid");
          event("claimEvent");
          break;
        }
        case "book":
        case "book-followup": {
          const followup = body.action === "book-followup",
            date = followup ? String(v.followupDate) : text("date"),
            time = followup ? String(v.followupTime) : text("time"),
            provider = followup ? String(v.followupProvider) : text("provider");
          if (
            !validDate(date) ||
            date < today ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
            !config.providers.some((p) => p.id === provider)
          )
            return fail(422, "required");
          if (followup && v.followupAppointment) return fail(409, "duplicate");
          if (
            bucket.appointments.some(
              (a) =>
                a.provider === provider && a.date === date && a.time === time,
            )
          )
            return fail(409, "slotTaken");
          const appointment: RegistrationAppointment = {
            id: "APT-" + randomUUID(),
            patientId: record.patientId,
            provider,
            date,
            time,
            reason: followup ? "registration.followup" : text("note"),
            status: "booked",
            encounterId: "",
          };
          bucket.appointments.push(appointment);
          if (followup) v.followupAppointment = appointment.id;
          event("bookEvent");
          break;
        }
        case "urgent":
          if (payload.confirm !== true || !text("note"))
            return fail(422, "required");
          v.urgentNote = text("note");
          event("urgentEvent");
          break;
        case "complete": {
          const left = v.disposition === "left";
          if (
            record.status !== "active" ||
            (!left && (!record.signedAt || !v.instructionsReviewed)) ||
            (left && !v.followupPlan) ||
            (v.followup === "recommended" &&
              !v.followupAppointment &&
              !v.followupPlan) ||
            open().some((o) =>
              ["medication", "procedure-service"].includes(o.category),
            ) ||
            (open().length &&
              (!required(["resultOwner", "resultDue", "followupPlan"]) ||
                !validDate(String(v.resultDue)) ||
                String(v.resultDue) < today))
          )
            return fail(422, "completeRequired");
          record.status = "completed";
          event("completeEvent");
          const ap = bucket.appointments.find(
            (a) => a.encounterId === record.id,
          );
          if (ap) ap.status = "fulfilled";
          break;
        }
        default:
          return fail(400, "invalid");
      }
      if (
        [
          "save",
          "sign",
          "order-add",
          "order-start",
          "order-complete",
          "order-cancel",
          "addendum",
        ].includes(body.action) &&
        v.claim
      )
        v.claim = "claimDraft";
      if (record.status === "draft") {
        if (!policy.enabled) {
          if (body.action === "eligibility")
            return {
              status: 200,
              body: {
                config: { ...config, draftsEnabled: false },
                patient,
                record,
                appointments: [],
              },
            };
          return fail(403, "denied");
        }
        record.values = filterDraftValues(record.values, policy).values;
      }
      record.id ||= "OP-" + randomUUID();
      record.version++;
      record.updatedAt = now;
      for (const ap of bucket.appointments)
        if (ap.encounterId === "pending") ap.encounterId = record.id;
      const index = bucket.records.findIndex((r) => r.id === record.id);
      if (index >= 0) bucket.records[index] = record;
      else bucket.records.push(record);
      const response = { status: 200, body: view(record) };
      bucket.receipts[receiptKey] = {
        hash,
        record: (response.body as { record: RegistrationRecord }).record,
      };
      write(all);
      return response;
    },
  };
}
