import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { parseCsv, writeCsvSnapshot } from "./clinical-template-csv.ts";
import type {
  ClinicalDocument,
  ClinicalDocumentView,
  ClinicalDocumentSave,
} from "../desktop-clients/packages/erp-config/src/clinical-document.ts";
import type { PatientOverview } from "../desktop-clients/packages/erp-config/src/clinical-templates.ts";
type User = { id: string; tenantId?: string; name?: string };
type Result = { status: number; body: unknown };
type Bucket<V> = {
  assessments: ClinicalDocument<V>[];
  receipts: Record<string, { hash: string; record: ClinicalDocument<V> }>;
};
export interface ClinicalDocumentRecipe<V, C> {
  prefix: string;
  idPrefix: string;
  version?: string;
  config: C;
  blank: () => V;
  validate: (values: V, config: C, complete: boolean) => Record<string, string>;
  sanitize: (values: V, previous?: V) => V;
}
/** Single-process CSV assessment journal, isolated from registration and billing. */
export function createClinicalDocumentStore<V, C>(
  file: string,
  recipe: ClinicalDocumentRecipe<V, C>,
  overview: (user: User, product: string, id: string) => Result,
) {
  const config = recipe.config;
  const fail = (
    status: number,
    key: string,
    fieldErrors: Record<string, string> = {},
  ): Result => ({
    status,
    body: {
      error: recipe.prefix + key,
      fieldErrors: {
        ...fieldErrors,
        ...(Object.keys(fieldErrors).length
          ? {}
          : { form: recipe.prefix + key }),
      },
    },
  });
  const read = (): Record<string, Bucket<V>> => {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT")
        return Object.create(null);
      throw e;
    }
    const [header, ...rows] = parseCsv(text);
    if (header?.join(",") !== "tenant,application,patient,data")
      throw Error("Invalid clinical document CSV");
    const data: Record<string, Bucket<V>> = Object.create(null);
    for (const cells of rows) {
      if (cells.length !== 4) throw Error("Invalid clinical document row");
      const [tenant, product, patient, json] = cells,
        key = JSON.stringify([tenant, product, patient]);
      if (data[key]) throw Error("Duplicate clinical document scope");
      const bucket = JSON.parse(json) as Bucket<V>;
      if (
        !Array.isArray(bucket.assessments) ||
        !bucket.receipts ||
        bucket.assessments.some(
          (r) =>
            r.patientId !== patient ||
            !Number.isSafeInteger(r.version) ||
            r.version < 1 ||
            !["draft", "completed"].includes(r.status),
        )
      )
        throw Error("Invalid clinical document snapshot");
      data[key] = bucket;
    }
    return data;
  };
  const persist = (data: Record<string, Bucket<V>>) => {
    const quote = (v: string) => '"' + v.replaceAll('"', '""') + '"';
    writeCsvSnapshot(
      file,
      "tenant,application,patient,data\r\n" +
        Object.entries(data)
          .map(([key, b]) =>
            [...JSON.parse(key), JSON.stringify(b)].map(quote).join(","),
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
        return fail(400, "invalid");
      const body = input as ClinicalDocumentSave<V> & { action: string };
      if (
        typeof body.patientId !== "string" ||
        !body.patientId ||
        body.patientId.length > 100
      )
        return fail(400, "invalid");
      const response = overview(user, product, body.patientId);
      if (response.status !== 200) return response;
      const patient = response.body as PatientOverview,
        key = JSON.stringify([
          user.tenantId ?? "demo",
          product,
          body.patientId,
        ]),
        data = read(),
        bucket = (data[key] ??= {
          assessments: [],
          receipts: Object.create(null),
        }),
        now = new Date().toISOString();
      const blank: ClinicalDocument<V> = {
        id: "new",
        patientId: body.patientId,
        encounterId: "",
        version: 0,
        status: "draft",
        values: recipe.blank(),
        updatedAt: "",
        actor: "",
        history: [],
      };
      const view: ClinicalDocumentView<V, C> = {
        patient: patient.patient,
        encounters: patient.rows.filter((r) => r.kind === "encounter"),
        assessments: bucket.assessments,
        blank,
        config,
        canWrite,
      };
      if (body.action === "load") return { status: 200, body: view };
      if (body.action !== "save") return fail(400, "invalid");
      if (!canWrite) return fail(403, "denied");
      if (
        typeof body.operationId !== "string" ||
        !body.operationId ||
        body.operationId.length > 100 ||
        typeof body.complete !== "boolean" ||
        !Number.isSafeInteger(body.expectedVersion) ||
        !body.assessment?.values ||
        body.assessment.patientId !== body.patientId
      )
        return fail(400, "invalid");
      const op = JSON.stringify([user.id, body.operationId]),
        hash = createHash("sha256").update(JSON.stringify(body)).digest("hex"),
        receipt = bucket.receipts[op];
      if (receipt)
        return receipt.hash === hash
          ? { status: 200, body: receipt.record }
          : fail(409, "conflict");
      const record = body.assessment,
        old = bucket.assessments.find((r) => r.id === record.id);
      if (record.id !== "new" && !old) return fail(404, "notFound");
      if ((old?.version ?? 0) !== body.expectedVersion)
        return fail(409, "conflict");
      if (old?.status === "completed") return fail(409, "completedLocked");
      if (
        typeof record.encounterId !== "string" ||
        record.encounterId.length > 100 ||
        (record.encounterId &&
          !view.encounters.some((e) => e.id === record.encounterId))
      )
        return fail(400, "invalid", { encounterId: recipe.prefix + "invalid" });
      const errors = recipe.validate(record.values, config, body.complete);
      if (Object.keys(errors).length) return fail(400, "invalid", errors);
      const values = recipe.sanitize(record.values, old?.values);
      const saved: ClinicalDocument<V> = {
        id: old?.id ?? recipe.idPrefix + randomUUID(),
        patientId: body.patientId,
        encounterId: record.encounterId,
        version: (old?.version ?? 0) + 1,
        status: body.complete ? "completed" : "draft",
        values,
        updatedAt: now,
        actor: user.name ?? user.id,
        ...(recipe.version ? { configurationVersion: recipe.version } : {}),
        history: [
          ...(old?.history ?? []),
          {
            at: now,
            actor: user.name ?? user.id,
            messageKey: body.complete
              ? recipe.prefix + "event.completed"
              : recipe.prefix + "event.saved",
          },
        ],
      };
      bucket.assessments = [
        saved,
        ...bucket.assessments.filter((r) => r.id !== saved.id),
      ];
      bucket.receipts[op] = { hash, record: saved };
      data[key] = bucket;
      persist(data);
      return { status: 200, body: saved };
    },
  };
}
