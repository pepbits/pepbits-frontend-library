import crypto from "node:crypto";
import { Router } from "express";
import { db, nowIso, parseJson } from "../db.js";
import { audit, requireAuth, requirePermission } from "../auth.js";
import { EVENT_DOMAINS, isEventDomain, localDateStartIso } from "../domain.js";
import { getDefinition, tatAnalysis } from "../services/tat.js";

export const eventsRouter = Router();
eventsRouter.use(requireAuth);

function rangeFrom(query: Record<string, unknown>) {
  const to = query.to ? new Date(localDateStartIso(String(query.to))) : new Date();
  const toExclusive = query.to ? new Date(to.getTime() + 86400000) : to;
  const from = query.from ? new Date(localDateStartIso(String(query.from))) : new Date(toExclusive.getTime() - 30 * 86400000);
  return { from: from.toISOString(), to: toExclusive.toISOString() };
}

eventsRouter.get("/tat/definitions", (_req, res) => {
  res.json(db.prepare("SELECT * FROM tat_definitions ORDER BY domain, id").all().map((d: any) => ({ ...d, filter: parseJson(d.filter, {}) })));
});

eventsRouter.post("/tat/definitions", requirePermission("indicators.manage"), (req, res) => {
  const b = req.body ?? {};
  if (!b.code || !b.name || !isEventDomain(b.domain)) return res.status(400).json({ error: "validation", message: "Code, name and a valid domain are required." });
  const stages = EVENT_DOMAINS[b.domain as keyof typeof EVENT_DOMAINS].stages as readonly string[];
  if (!stages.includes(b.start_event) || !stages.includes(b.end_event)) return res.status(400).json({ error: "validation", message: "Start and end must be stages of the selected domain." });
  if (stages.indexOf(b.end_event) <= stages.indexOf(b.start_event)) return res.status(400).json({ error: "validation", message: "The end stage must come after the start stage." });
  if (!(Number(b.target_minutes) > 0)) return res.status(400).json({ error: "validation", message: "Target must be greater than zero minutes." });
  if (db.prepare("SELECT 1 FROM tat_definitions WHERE code = ?").get(b.code)) return res.status(409).json({ error: "duplicate", message: `A TAT measure with code ${b.code} already exists.` });
  const r = db
    .prepare("INSERT INTO tat_definitions (code, name, domain, start_event, end_event, target_minutes, filter, description) VALUES (?,?,?,?,?,?,?,?)")
    .run(b.code, b.name, b.domain, b.start_event, b.end_event, Number(b.target_minutes), JSON.stringify(b.filter ?? {}), b.description ?? null);
  audit(req, "tat_definition.created", "tat_definition", Number(r.lastInsertRowid), `Created TAT measure ${b.code}`, { after: b });
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

eventsRouter.get("/tat/analysis", (req, res) => {
  const def = getDefinition(Number(req.query.definition));
  if (!def) return res.status(404).json({ error: "not_found", message: "Choose a TAT measure." });
  const range = rangeFrom(req.query as Record<string, unknown>);
  const facilityIds = req.query.facility ? String(req.query.facility).split(",").map(Number).filter(Boolean) : [];
  res.json({ range, ...tatAnalysis(def, { ...range, facilityIds }) });
});

eventsRouter.get("/events/stats", (_req, res) => {
  const since = new Date(Date.now() - 86400000).toISOString();
  const byDomain = db
    .prepare(
      `SELECT domain, COUNT(*) AS transactions, SUM(is_complete) AS complete, SUM(CASE WHEN started_at >= ? THEN 1 ELSE 0 END) AS last24h
       FROM transactions GROUP BY domain`,
    )
    .all(since);
  const ingestion = db.prepare("SELECT outcome, COUNT(*) AS n FROM ingestion_log GROUP BY outcome").all();
  const lastIngested = db.prepare("SELECT source_system, MAX(ingested_at) AS last FROM clinical_events GROUP BY source_system").all();
  const corrections = db.prepare("SELECT event_kind, COUNT(*) AS n FROM clinical_events GROUP BY event_kind").all();
  const hourly = db
    .prepare(
      `SELECT substr(occurred_at, 1, 13) AS hour, COUNT(*) AS n FROM clinical_events WHERE occurred_at >= ? GROUP BY hour ORDER BY hour`,
    )
    .all(since);
  res.json({ byDomain, ingestion, lastIngested, corrections, hourly });
});

eventsRouter.get("/events", (req, res) => {
  const where: string[] = [];
  const params: unknown[] = [];
  const q = req.query;
  if (q.domain) { where.push("e.domain = ?"); params.push(q.domain); }
  if (q.facility) { where.push("e.facility_id = ?"); params.push(Number(q.facility)); }
  if (q.type) { where.push("e.event_type = ?"); params.push(q.type); }
  if (q.kind) { where.push("e.event_kind = ?"); params.push(q.kind); }
  if (q.search) { where.push("(e.transaction_id LIKE ? OR e.source_event_key LIKE ?)"); params.push(`%${q.search}%`, `%${q.search}%`); }
  const limit = Math.min(200, Number(q.limit) || 100);
  const offset = Math.max(0, Number(q.offset) || 0);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM clinical_events e ${whereSql}`).get(...params) as { n: number }).n;
  const rows = db
    .prepare(
      `SELECT e.*, f.code AS facility_code FROM clinical_events e JOIN facilities f ON f.id = e.facility_id ${whereSql}
       ORDER BY e.occurred_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset);
  res.json({ total, rows });
});

eventsRouter.get("/transactions", (req, res) => {
  const where: string[] = [];
  const params: unknown[] = [];
  const q = req.query;
  if (q.domain) { where.push("t.domain = ?"); params.push(q.domain); }
  if (q.facility) { where.push("t.facility_id = ?"); params.push(Number(q.facility)); }
  if (q.state === "open") where.push("t.is_complete = 0");
  if (q.state === "complete") where.push("t.is_complete = 1");
  if (q.search) { where.push("(t.id LIKE ? OR t.patient_ref LIKE ?)"); params.push(`%${q.search}%`, `%${q.search}%`); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(200, Number(q.limit) || 50);
  const offset = Math.max(0, Number(q.offset) || 0);
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM transactions t ${whereSql}`).get(...params) as { n: number }).n;
  const rows = db
    .prepare(`SELECT t.*, f.code AS facility_code FROM transactions t JOIN facilities f ON f.id = t.facility_id ${whereSql} ORDER BY t.current_state_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset)
    .map((t: any) => ({ ...t, attributes: parseJson(t.attributes, {}) }));
  res.json({ total, rows });
});

eventsRouter.get("/transactions/:id", (req, res) => {
  const t = db.prepare("SELECT t.*, f.code AS facility_code, f.name AS facility_name FROM transactions t JOIN facilities f ON f.id = t.facility_id WHERE t.id = ?").get(req.params.id) as any;
  if (!t) return res.status(404).json({ error: "not_found", message: "Transaction not found." });
  const events = db.prepare("SELECT * FROM clinical_events WHERE transaction_id = ? ORDER BY occurred_at, source_sequence").all(t.id) as any[];
  const superseded = new Set(events.filter((e) => e.supersedes_event_id).map((e) => e.supersedes_event_id));
  res.json({
    transaction: { ...t, attributes: parseJson(t.attributes, {}) },
    stages: EVENT_DOMAINS[t.domain as keyof typeof EVENT_DOMAINS]?.stages ?? [],
    events: events.map((e) => ({ ...e, payload: parseJson(e.payload, {}), superseded: superseded.has(e.event_id) })),
  });
});

/**
 * Ingests one clinical event. Deduplicates on (source_system, source_event_key),
 * stores the immutable event and updates the transaction's current-state projection.
 */
eventsRouter.post("/events/ingest", requirePermission("events.ingest"), (req, res) => {
  const b = req.body ?? {};
  const now = nowIso();
  const log = (outcome: string, reason: string | null) =>
    db.prepare("INSERT INTO ingestion_log (received_at, source_system, source_event_key, outcome, reason) VALUES (?,?,?,?,?)").run(now, b.source_system ?? "unknown", b.source_event_key ?? "unknown", outcome, reason);

  if (!isEventDomain(b.domain)) { log("rejected", "Unknown domain"); return res.status(400).json({ error: "validation", message: "Domain must be lab, radiology, ed, outpatient or pharmacy." }); }
  const cfg = EVENT_DOMAINS[b.domain as keyof typeof EVENT_DOMAINS];
  const validTypes = [...cfg.stages, cfg.cancel] as string[];
  if (!validTypes.includes(b.event_type)) { log("rejected", "Unknown event type"); return res.status(400).json({ error: "validation", message: `Event type must be one of: ${validTypes.join(", ")}.` }); }
  if (!b.transaction_id || !b.source_system || !b.source_event_key || !b.occurred_at || Number.isNaN(Date.parse(b.occurred_at))) {
    log("rejected", "Missing required fields");
    return res.status(400).json({ error: "validation", message: "transaction_id, source_system, source_event_key and a valid occurred_at are required." });
  }
  if (db.prepare("SELECT 1 FROM clinical_events WHERE source_system = ? AND source_event_key = ?").get(b.source_system, b.source_event_key)) {
    log("duplicate", "Source event key already ingested; ignored");
    return res.status(200).json({ outcome: "duplicate", message: "This event was already received. Nothing was counted twice." });
  }
  const facilityId = Number(b.facility_id);
  if (!db.prepare("SELECT 1 FROM facilities WHERE id = ?").get(facilityId)) { log("rejected", "Unknown facility"); return res.status(400).json({ error: "validation", message: "Unknown facility." }); }
  const occurred = new Date(b.occurred_at).toISOString();
  const eventId = crypto.randomUUID();

  const tx = db.transaction(() => {
    let t = db.prepare("SELECT * FROM transactions WHERE id = ?").get(b.transaction_id) as any;
    if (!t) {
      db.prepare("INSERT INTO transactions (id, domain, facility_id, priority, attributes, patient_ref, started_at, current_state, current_state_at, last_sequence, is_complete) VALUES (?,?,?,?,?,?,?,?,?,0,0)").run(
        b.transaction_id, b.domain, facilityId, b.priority === "STAT" ? "STAT" : "routine", JSON.stringify(b.attributes ?? {}), b.patient_ref ?? `P-${crypto.randomBytes(5).toString("hex")}`, occurred, b.event_type, occurred,
      );
      t = db.prepare("SELECT * FROM transactions WHERE id = ?").get(b.transaction_id);
    } else if (t.domain !== b.domain || t.facility_id !== facilityId) {
      throw Object.assign(new Error("This transaction belongs to a different domain."), { status: 409 });
    }
    if (b.supersedes_event_id) {
      const replaced = db.prepare("SELECT * FROM clinical_events WHERE event_id=? AND transaction_id=? AND facility_id=?").get(b.supersedes_event_id,t.id,facilityId);
      if (!replaced) throw Object.assign(new Error("The correction must reference an event from this transaction and facility."),{status:409});
      if (db.prepare("SELECT 1 FROM clinical_events WHERE supersedes_event_id=?").get(b.supersedes_event_id)) throw Object.assign(new Error("This event has already been superseded. Correct its replacement."),{status:409});
    }
    db.prepare(
      `INSERT INTO clinical_events (event_id, transaction_id, domain, event_type, facility_id, occurred_at, ingested_at, source_system, source_event_key, source_sequence, actor, event_kind, supersedes_event_id, payload)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(eventId, t.id, b.domain, b.event_type, facilityId, occurred, now, b.source_system, b.source_event_key, Number(b.source_sequence ?? t.last_sequence + 1), b.actor ?? null, b.supersedes_event_id ? "correction" : "normal", b.supersedes_event_id ?? null, JSON.stringify(b.payload ?? {}));
    // Projection: current state follows the latest occurrence time, not arrival order.
    const latest = db.prepare("SELECT event_type, occurred_at FROM clinical_events WHERE transaction_id = ? AND event_kind != 'retraction' AND event_id NOT IN (SELECT supersedes_event_id FROM clinical_events WHERE supersedes_event_id IS NOT NULL) ORDER BY occurred_at DESC, source_sequence DESC LIMIT 1").get(t.id) as { event_type: string; occurred_at: string };
    const first = db.prepare("SELECT MIN(occurred_at) AS a FROM clinical_events WHERE transaction_id = ? AND event_kind != 'retraction' AND event_id NOT IN (SELECT supersedes_event_id FROM clinical_events WHERE supersedes_event_id IS NOT NULL)").get(t.id) as { a: string };
    const types = (db.prepare("SELECT DISTINCT event_type FROM clinical_events WHERE transaction_id = ? AND event_kind != 'retraction' AND event_id NOT IN (SELECT supersedes_event_id FROM clinical_events WHERE supersedes_event_id IS NOT NULL)").all(t.id) as { event_type: string }[]).map((r) => r.event_type);
    const complete = types.some((x) => (cfg.terminal as readonly string[]).includes(x) || x === cfg.cancel);
    db.prepare("UPDATE transactions SET current_state = ?, current_state_at = ?, started_at = ?, last_sequence = last_sequence + 1, is_complete = ? WHERE id = ?").run(latest.event_type, latest.occurred_at, first.a, complete ? 1 : 0, t.id);
  });
  try {
    tx();
  } catch (err: any) {
    log("rejected", err.message);
    return res.status(err.status ?? 500).json({ error: "ingest_failed", message: err.message });
  }
  log("accepted", null);
  audit(req, "event.ingested", "transaction", b.transaction_id, `Ingested ${b.event_type} for ${b.transaction_id}`, { event_id: eventId, source: b.source_system, key: b.source_event_key });
  res.status(201).json({ outcome: "accepted", event_id: eventId });
});
