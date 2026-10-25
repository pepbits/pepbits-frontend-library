import "server-only";
import type { DB } from "../db";
import { insertCase, insertEncounter, insertEpisode, insertMaster, insertPatient, setSequence, writeAdmissionRequest } from "../repo";
import { createDemoData } from "./demo";
import { MASTER_SEED } from "./master";

/** Inserts reference data and demo records in one transaction. Expects empty tables. */
export function seedDatabase(db: DB) {
  const { state, sequences } = createDemoData();
  db.transaction(() => {
    insertMaster(db, MASTER_SEED);
    Object.entries(sequences).forEach(([name, value]) => setSequence(db, name, value));
    // Insert order follows the foreign keys.
    state.patients.forEach((p) => insertPatient(db, p));
    state.episodes.forEach((e) => insertEpisode(db, e));
    state.cases.forEach((c) => insertCase(db, c));
    state.admissionRequests.forEach((r) => writeAdmissionRequest(db, r));
    state.encounters.forEach((e) => insertEncounter(db, e));
  })();
}

export const isSeeded = (db: DB) => (db.prepare("SELECT COUNT(*) AS n FROM departments").get() as { n: number }).n > 0;
