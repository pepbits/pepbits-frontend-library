import { db } from "../db.js";

/** Surgical Apgar Score (Gawande et al., 2007). 0–10, lower = higher risk of major complications. */
export function surgicalApgar(caseId: number) {
  const c = db.prepare(`SELECT ebl_ml FROM cases WHERE id = ?`).get(caseId) as { ebl_ml: number | null };
  const vitals = db
    .prepare(`SELECT hr, sbp, dbp FROM anesthesia_vitals WHERE case_id = ? AND hr IS NOT NULL AND sbp IS NOT NULL AND dbp IS NOT NULL`)
    .all(caseId) as { hr: number; sbp: number; dbp: number }[];
  if (c.ebl_ml == null || vitals.length === 0) return null;
  const lowestMap = Math.min(...vitals.map((v) => Math.round((v.sbp + 2 * v.dbp) / 3)));
  const lowestHr = Math.min(...vitals.map((v) => v.hr));
  const ebl = c.ebl_ml;
  const eblPts = ebl > 1000 ? 0 : ebl > 600 ? 1 : ebl > 100 ? 2 : 3;
  const mapPts = lowestMap < 40 ? 0 : lowestMap < 55 ? 1 : lowestMap < 70 ? 2 : 3;
  const hrPts = lowestHr > 85 ? 0 : lowestHr > 75 ? 1 : lowestHr > 65 ? 2 : lowestHr > 55 ? 3 : 4;
  const value = eblPts + mapPts + hrPts;
  const band = value <= 4 ? "High risk" : value <= 6 ? "Moderate risk" : "Low risk";
  return { value, band, details: { ebl, lowestMap, lowestHr, eblPts, mapPts, hrPts } };
}

export type RcriInputs = {
  highRiskSurgery?: boolean;
  ischemicHeartDisease?: boolean;
  heartFailure?: boolean;
  cerebrovascularDisease?: boolean;
  insulinDiabetes?: boolean;
  creatinineOver2?: boolean;
};

/** Revised Cardiac Risk Index (Lee, 1999). */
export function rcri(inputs: RcriInputs) {
  const value = Object.values(inputs).filter(Boolean).length;
  const risk = ["0.4%", "0.9%", "6.6%", "11%"][Math.min(value, 3)];
  const band = `Class ${["I", "II", "III", "IV"][Math.min(value, 3)]} — major cardiac event risk ${risk}`;
  return { value, band, details: inputs };
}

/** NNIS surgical site infection risk index (0–3). */
export function nnis(caseId: number) {
  const c = db
    .prepare(`SELECT asa_class, wound_class FROM cases WHERE id = ?`)
    .get(caseId) as { asa_class: string; wound_class: string };
  const t = db
    .prepare(
      `SELECT MAX(p.t_time_min) t FROM case_procedures cp JOIN procedures p ON p.id = cp.procedure_id WHERE cp.case_id = ? AND cp.role = 'Primary'`,
    )
    .get(caseId) as { t: number | null };
  const ms = db
    .prepare(`SELECT code, ts FROM case_milestones WHERE case_id = ? AND code IN ('INCISION','CLOSURE_END')`)
    .all(caseId) as { code: string; ts: string }[];
  const inc = ms.find((m) => m.code === "INCISION");
  const clo = ms.find((m) => m.code === "CLOSURE_END");
  const duration = inc && clo ? Math.round((new Date(clo.ts).getTime() - new Date(inc.ts).getTime()) / 60000) : null;
  const asaPt = ["III", "IV", "V", "VI"].some((a) => c.asa_class.replace("E", "") === a) ? 1 : 0;
  const woundPt = ["III", "IV"].includes(c.wound_class) ? 1 : 0;
  const durPt = duration !== null && t.t !== null && duration > t.t ? 1 : 0;
  const value = asaPt + woundPt + durPt;
  const band = ["Low (≈1.5%)", "Moderate (≈2.9%)", "High (≈6.8%)", "Very high (≈13%)"][value];
  return { value, band, details: { asa: c.asa_class, wound: c.wound_class, durationMin: duration, tTimeMin: t.t, asaPt, woundPt, durPt } };
}

export type AldreteInputs = { activity: number; respiration: number; circulation: number; consciousness: number; oxygenation: number };

/** Modified Aldrete recovery score (0–10). 9 or more allows PACU discharge. */
export function aldrete(i: AldreteInputs) {
  const clamp = (n: number) => Math.max(0, Math.min(2, Math.round(Number(n) || 0)));
  const d = {
    activity: clamp(i.activity),
    respiration: clamp(i.respiration),
    circulation: clamp(i.circulation),
    consciousness: clamp(i.consciousness),
    oxygenation: clamp(i.oxygenation),
  };
  const value = Object.values(d).reduce((a, b) => a + b, 0);
  return { value, band: value >= 9 ? "Ready for discharge" : "Continue monitoring", details: d };
}
