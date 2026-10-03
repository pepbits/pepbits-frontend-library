import type { Request } from "express";
import { db } from "../db.js";

const ins = db.prepare(
  "INSERT INTO audit_logs (user_id, user_name, action, entity, entity_id, details, ip) VALUES (?, ?, ?, ?, ?, ?, ?)"
);

/** Records who did what to which record. Never put clinical free text in details. */
export function audit(req: Request | null, action: string, entity: string, entityId?: number | string | null, details?: unknown) {
  const user = req?.user;
  ins.run(
    user?.id ?? null,
    user?.name ?? "system",
    action,
    entity,
    entityId == null ? null : String(entityId),
    details ? JSON.stringify(details) : null,
    req?.ip ?? null
  );
}
