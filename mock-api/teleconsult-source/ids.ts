// Identifier and clock helpers shared by the copied source modules.
// Source: backend/src/store.ts (uid, nowIso). Identifiers are demo-only and not security tokens.
let seq = 1000;
export const uid = (prefix: string) => `${prefix}_${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const nowIso = () => new Date().toISOString();
