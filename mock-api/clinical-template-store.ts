import {fileURLToPath} from "node:url";
import { searchMatch } from "./clinical-template-search.ts";
import { readFileSync } from "node:fs";
import {readClinicalCsv,writeClinicalCsv,type ClinicalBucket as Bucket} from "./clinical-template-csv.ts";
import { randomUUID, createHash } from "node:crypto";
import type {
  PatientRecord,
  PatientSummary,
  PatientFilters,
  PatientMetadata,
  PatientCareRow,
  PatientSavedSearch,
} from "../desktop-clients/packages/erp-config/src/clinical-templates.ts";
type User = { id: string; tenantId: string; name: string };
type Result = { status: number; body: unknown };
const metadata = JSON.parse(
  readFileSync(
    new URL("./config/clinical-templates/metadata.json", import.meta.url),
    "utf8",
  ),
) as PatientMetadata;
const seed = readClinicalCsv(fileURLToPath(new URL("./config/clinical-templates/seed.csv", import.meta.url)))['["seed","seed"]'];
if(!seed)throw Error('Missing clinical CSV seed scope');
const ok = (body: unknown): Result => ({ status: 200, body });
const fail = (
  status: number,
  key = "template.clinical.invalid",
  extra: object = {},
): Result => ({ status, body: { error: key, ...extra } });
const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
function summary(p: PatientRecord): PatientSummary {
  return {
    country:
      (
        p.collections.addresses.find((r) => r.primary === "yes") ??
        p.collections.addresses[0]
      )?.country ?? "",
    identifier:
      (
        p.collections.identifiers.find((r) => r.primary === "yes") ??
        p.collections.identifiers[0]
      )?.value ?? "",
    id: p.id,
    mrn: p.mrn,
    internalCode: p.internalCode,
    version: p.version,
    name: [p.values.firstName, p.values.middleName, p.values.lastName]
      .filter(Boolean)
      .join(" "),
    birthDate: text(p.values.birthDate),
    gender: text(p.values.gender),
    mobile: text(p.values.mobile),
    email: text(p.values.email),
    nationality: text(p.values.nationality),
    status: text(p.values.status),
    registeredAt: p.activity[0]?.at ?? "",
  };
}
function newRecord(): PatientRecord {
  return {
    id: "new",
    mrn: "",
    internalCode: "",
    version: 0,
    values: {
      ...Object.fromEntries(
        metadata.sections.flatMap((s) =>
          s.fields.map((f) => [f.id, f.type === "checkbox" ? false : ""]),
        ),
      ),
      status: "active",
      dobPrecision: "unknown",
      branch: "main",
    },
    collections: Object.fromEntries(
      metadata.collections.map((c) => [c.id, []]),
    ),
    activity: [],
  };
}
function validate(record: PatientRecord): Record<string, string> {
  const errors: Record<string, string> = {};
  const fields = (
    list: PatientMetadata["sections"][number]["fields"],
    values: Record<string, unknown>,
    prefix: string,
  ) => {
    for (const f of list) {
      const v = values[f.id],
        key = prefix + f.id;
      if (typeof v !== (f.type === "checkbox" ? "boolean" : "string"))
        errors[key] = "template.clinical.invalid";
      else if (
        f.type === "time" &&
        v &&
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(text(v))
      )
        errors[key] = "template.clinical.invalid";
      else if (f.required && !text(v))
        errors[key] = "template.validation.required";
      else if (typeof v === "string" && v.length > 4000)
        errors[key] = "template.clinical.tooLong";
      else if (
        f.type === "email" &&
        v &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(v))
      )
        errors[key] = "template.validation.email";
      else if (
        f.type === "date" &&
        v &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(text(v)) ||
          !Number.isFinite(Date.parse(text(v))) ||
          new Date(text(v)).toISOString().slice(0, 10) !== v)
      )
        errors[key] = "template.validation.date";
      else if (
        f.options &&
        !f.allowCustom &&
        v &&
        !f.options.some((o) => o.value === v)
      )
        errors[key] = "template.clinical.invalid";
    }
  };
  for (const section of metadata.sections)
    fields(section.fields, record.values, "");
  if (text(record.values.birthDate) > new Date().toISOString().slice(0, 10))
    errors.birthDate = "template.validation.date";
  if (record.values.deceased && !record.values.deathDate)
    errors.deathDate = "template.validation.required";
  if (
    record.values.deathDate &&
    text(record.values.deathDate) < text(record.values.birthDate)
  )
    errors.deathDate = "template.validation.date";
  for (const c of metadata.collections) {
    const rows = record.collections[c.id];
    if (!Array.isArray(rows) || rows.length > 30) {
      errors[c.id] = "template.clinical.invalid";
      continue;
    }
    const ids = new Set();
    for (const [i, row] of rows.entries()) {
      if (!row || typeof row !== "object" || !text(row.id) || ids.has(row.id)) {
        errors[c.id] = "template.clinical.invalid";
        continue;
      }
      ids.add(row.id);
      fields(c.fields, row, `${c.id}.${i}.`);
      if (
        c.id === "contacts" &&
        row.contactType === "email" &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.value)
      )
        errors[`${c.id}.${i}.value`] = "template.validation.email";
    }
  }
  for (const id of ["communications"]) {
    const rows = record.collections[id];
    if (Array.isArray(rows)) {
      const values = rows.map((r) => r?.purpose).filter(Boolean);
      if (new Set(values).size !== values.length)
        errors[id] = "template.clinical.invalid";
    }
  }
  for (const id of ["contacts", "addresses"]) {
    const rows = record.collections[id];
    if (Array.isArray(rows)) {
      const groups = rows
        .filter((r) => r?.primary === "yes")
        .map((r) => (id === "contacts" ? r.contactType : "address"));
      if (new Set(groups).size !== groups.length)
        errors[id] = "template.clinical.invalid";
    }
  }
  return errors;
}
export function createClinicalTemplateStore(file: string) {
  const csvFile = file.endsWith('.csv') ? file : file.replace(/\.json$/, '') + '.csv';
  const legacyFile = file.endsWith('.csv') ? file.slice(0,-4)+'.json' : file;
  let data: Record<string, Bucket> = {};
  try { data=readClinicalCsv(csvFile); }
  catch(error){
    if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
    try { data=JSON.parse(readFileSync(legacyFile,'utf8')); }
    catch(legacyError){if((legacyError as NodeJS.ErrnoException).code!=='ENOENT')throw legacyError;}
    writeClinicalCsv(csvFile,data);
  }
  const persist = (next: typeof data) => {writeClinicalCsv(csvFile,next);data=next;};
  return {
    handle(
      user: User,
      product: string,
      input: unknown,
      canWrite: boolean,
    ): Result {
      if (!input || typeof input !== "object" || Array.isArray(input))
        return fail(400);
      const body = input as Record<string, unknown>,
        action = text(body.action),
        scope = JSON.stringify([user.tenantId, product]);
      // Read the committed CSV snapshot for every request; never silently reseed a corrupt file.
      data=readClinicalCsv(csvFile);
      if(!data[scope])persist({...data,[scope]:structuredClone(seed)});
      const bucket = data[scope];
      // Add new schema fields without overwriting saved values or changing record versions.
      for (const record of bucket.records) {
        if (
          record.values.email &&
          !record.collections.contacts.some((r) => r.contactType === "email")
        )
          record.collections.contacts.push({
            id: "legacy-email-" + record.id,
            contactType: "email",
            value: String(record.values.email),
            primary: "yes",
          });

        for (const section of metadata.sections)
          for (const field of section.fields)
            record.values[field.id] ??= field.type === "checkbox" ? false : "";
        for (const collection of metadata.collections) {
          record.collections[collection.id] ??= [];
          for (const row of record.collections[collection.id])
            for (const field of collection.fields) row[field.id] ??= "";
        }
      }
      const find = () => bucket.records.find((p) => p.id === body.id);
      const overview = (id: string, b = bucket) => ({
        patient: b.records.find((p) => p.id === id),
        rows: b.care[id] ?? [],
        loadedAt: new Date().toISOString(),
      });
      if (action === "metadata") {
        const known =
          metadata.collections
            .find((c) => c.id === "addresses")
            ?.fields.find((f) => f.id === "country")?.options ?? [];
        const country = [...known];
        for (const value of new Set(
          bucket.records
            .flatMap((p) => p.collections.addresses.map((r) => r.country))
            .filter(Boolean),
        )) {
          if (!country.some((o) => o.value === value))
            country.push({ value, label: value });
        }
        return ok({ ...metadata, canWrite, searchOptions: { country } });
      }
      if (action === "new")
        return canWrite
          ? ok(newRecord())
          : fail(403, "template.clinical.denied");
      if (action === "load" || action === "overview") {
        const p = find();
        return p
          ? ok(action === "load" ? p : overview(p.id))
          : fail(404, "template.clinical.notFound");
      }
      if (action === "eligibility") {
        const record = bucket.records.find((p) => p.id === body.patientId),
          insurance = record?.collections.insurances.find(
            (r) => r.id === body.insuranceId,
          );
        if (!insurance) return fail(404, "template.clinical.notFound");
        return ok({
          status: insurance.expiry
            ? insurance.expiry < new Date().toISOString().slice(0, 10)
              ? "expired"
              : "eligible"
            : "unknown",
          checkedAt: new Date().toISOString(),
          reference: `DEMO-ELIG-${randomUUID()}`,
        });
      }
      if (action === "saved-searches")
        return ok(bucket.searches[user.id] ?? []);
      if (action === "search" || action === "export") {
        const f = (body.filters ?? {}) as PatientFilters;
        if (!f || typeof f !== "object" || Array.isArray(f)) return fail(400);
        const duplicateKey = (p: PatientRecord) =>
          [p.values.firstName, p.values.lastName, p.values.birthDate]
            .map((v) => text(v).toLowerCase())
            .join("|");
        const counts = new Map<string, number>();
        bucket.records.forEach((p) =>
          counts.set(duplicateKey(p), (counts.get(duplicateKey(p)) ?? 0) + 1),
        );
        const rows = bucket.records.flatMap((p) => {
          const match = searchMatch(p, f);
          return match.matches
            ? [
                {
                  ...summary(p),
                  matchedIn: match.matchedIn,
                  possibleDuplicate:
                    !!p.values.birthDate &&
                    (counts.get(duplicateKey(p)) ?? 0) > 1,
                },
              ]
            : [];
        });
        const sort = ["name", "mrn", "birthDate", "registeredAt"].includes(
          f.sort ?? "",
        )
          ? (f.sort as keyof PatientSummary)
          : "name";
        rows.sort(
          (a, b) =>
            String(a[sort]).localeCompare(String(b[sort])) *
            (f.direction === "desc" ? -1 : 1),
        );
        if (action === "export") {
          const next = structuredClone({ ...data, [scope]: bucket });
          next[scope].exports.push({
            userId: user.id,
            at: new Date().toISOString(),
            count: rows.length,
          });
          persist(next);
          return ok({ rows });
        }
        const pageSize = [10, 20, 50, 100].includes(Number(f.pageSize))
            ? Number(f.pageSize)
            : 20,
          page = Math.max(
            1,
            Math.min(
              Math.ceil(rows.length / pageSize) || 1,
              Math.floor(Number(f.page) || 1),
            ),
          );
        return ok({
          rows: rows.slice((page - 1) * pageSize, page * pageSize),
          total: rows.length,
          page,
          pageSize,
        });
      }
      if (action === "save-search" || action === "delete-search") {
        const next = structuredClone({ ...data, [scope]: bucket }),
          list = next[scope].searches[user.id] ?? [];
        if (action === "save-search") {
          if (
            !text(body.name) ||
            text(body.name).length > 80 ||
            !body.filters ||
            typeof body.filters !== "object" ||
            JSON.stringify(body.filters).length > 4000
          )
            return fail(400);
          next[scope].searches[user.id] = [
            {
              id: randomUUID(),
              name: text(body.name),
              filters: body.filters as PatientFilters,
            },
            ...list.filter((s) => s.name !== text(body.name)),
          ].slice(0, 20);
        } else
          next[scope].searches[user.id] = list.filter((s) => s.id !== body.id);
        persist(next);
        return ok(next[scope].searches[user.id]);
      }
      if (!["save", "schedule"].includes(action)) return fail(400);
      if (!canWrite) return fail(403, "template.clinical.denied");
      const operationId = text(body.operationId);
      if (!operationId || operationId.length > 100) return fail(400);
      const receiptKey = JSON.stringify([user.id, operationId]),
        hash = createHash("sha256").update(JSON.stringify(body)).digest("hex"),
        receipt = bucket.receipts[receiptKey];
      if (receipt)
        return receipt.hash === hash
          ? structuredClone(receipt.result)
          : fail(409, "template.clinical.conflict");
      const next = structuredClone({ ...data, [scope]: bucket }),
        b = next[scope];
      let result: Result;
      if (action === "save") {
        const raw = body.record as PatientRecord;
        if (
          !raw ||
          typeof raw !== "object" ||
          !raw.values ||
          typeof raw.values !== "object" ||
          !raw.collections ||
          typeof raw.collections !== "object"
        )
          return fail(400);
        const errors = validate(raw);
        if (Object.keys(errors).length)
          return fail(422, "template.clinical.invalid", {
            fieldErrors: errors,
          });
        const old = b.records.find((p) => p.id === raw.id);
        if (raw.id !== "new" && !old)
          return fail(404, "template.clinical.notFound");
        if ((old?.version ?? 0) !== body.expectedVersion)
          return fail(409, "template.clinical.conflict");
        const ids = raw.collections.identifiers.map((r) =>
          r.value.trim().toLowerCase(),
        );
        if (
          new Set(ids).size !== ids.length ||
          b.records.some(
            (p) =>
              p.id !== raw.id &&
              p.collections.identifiers.some((r) =>
                ids.includes(r.value.trim().toLowerCase()),
              ),
          )
        )
          return fail(422, "template.clinical.duplicate", {
            fieldErrors: { identifiers: "template.clinical.duplicate" },
          });
        const id = old?.id ?? `PT-${randomUUID()}`,
          seq = b.records.length + 1;
        const record: PatientRecord = {
          id,
          mrn: old?.mrn ?? `DEMO-${String(seq).padStart(6, "0")}`,
          internalCode: old?.internalCode ?? `DEMO-${randomUUID()}`,
          version: (old?.version ?? 0) + 1,
          values: Object.fromEntries(
            metadata.sections.flatMap((s) =>
              s.fields.map((f) => [f.id, raw.values[f.id]]),
            ),
          ),
          collections: Object.fromEntries(
            metadata.collections.map((c) => [
              c.id,
              raw.collections[c.id].map((row) =>
                Object.fromEntries([
                  ["id", row.id],
                  ...c.fields.map((f) => [f.id, row[f.id]]),
                ]),
              ),
            ]),
          ),
          activity: [
            ...(old?.activity ?? []),
            {
              id: randomUUID(),
              at: new Date().toISOString(),
              messageKey: old
                ? "template.clinical.updated"
                : "template.clinical.registered",
              detail: old
                ? "template.clinical.updated"
                : "template.clinical.registered",
              actor: user.name,
            },
          ],
        };

        record.values.uhid =
          old?.values.uhid ||
          `DEMO-UHID-${old?.id ?? String(seq).padStart(4, "0")}`;
        record.values.branchMrn = old?.values.branchMrn || record.mrn;
        record.values.status = old?.values.status ?? "active";
        const primaryContact = (kinds: string[]) => {
          const rows = record.collections.contacts.filter((r) =>
            kinds.includes(r.contactType),
          );
          const contact = rows.find((r) => r.primary === "yes") ?? rows[0];
          if (!contact) return "";
          return contact.contactType === "email" ||
            contact.value.startsWith("+")
            ? contact.value
            : [contact.countryCode, contact.value].filter(Boolean).join(" ");
        };
        record.values.email = primaryContact(["email"]);
        record.values.mobile = primaryContact(["mobile", "phone"]);
        b.records = old
          ? b.records.map((p) => (p.id === id ? record : p))
          : [...b.records, record];
        b.care[id] ??= [];
        result = ok(record);
      } else {
        const id = text(body.patientId),
          kind = body.kind,
          date = text(body.date),
          time = text(body.time),
          provider = text(body.provider);
        if (!b.records.some((p) => p.id === id))
          return fail(404, "template.clinical.notFound");
        if (
          !["appointment", "encounter"].includes(String(kind)) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
          !metadata.providers.some((p) => p.value === provider) ||
          text(body.notes).length > 2000
        )
          return fail(422);
        const at = `${date}T${time}:00.000Z`;
        if (
          !Number.isFinite(Date.parse(at)) ||
          new Date(at).toISOString() !== at
        )
          return fail(422);
        const providerName = metadata.providers.find(
          (p) => p.value === provider,
        )!.label;
        if (
          kind === "appointment" &&
          Object.values(b.care)
            .flat()
            .some(
              (r) =>
                r.kind === "appointment" &&
                r.date === at &&
                r.provider === providerName,
            )
        )
          return fail(409, "template.clinical.slotConflict");
        (b.care[id] ??= []).push({
          id: randomUUID(),
          kind: kind as "appointment" | "encounter",
          date: at,
          title:
            kind === "appointment"
              ? "template.clinical.followUp"
              : "template.clinical.outpatient",
          detail: text(body.notes),
          provider: providerName,
          status: kind === "appointment" ? "scheduled" : "inProgress",
        });
        result = ok(overview(id, b));
      }
      b.receipts[receiptKey] = { hash, result };
      persist(next);
      return structuredClone(result);
    },
  };
}
