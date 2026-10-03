// End-to-end smoke test against a running API: node scripts/smoke.mjs [baseUrl]
const B = (process.argv[2] ?? "http://localhost:4000") + "/api";
const j = async (m, p, b) => {
  const r = await fetch(B + p, { method: m, headers: { "content-type": "application/json", "x-user": "u_omar" }, body: b ? JSON.stringify(b) : undefined });
  const t = await r.json();
  if (!r.ok) throw new Error(`${m} ${p} → ${r.status} ${JSON.stringify(t)}`);
  return t;
};
const ok = (label, v) => console.log(`✓ ${label}`, v ?? "");

const meta = await j("GET", "/meta");
const pats = await j("GET", "/patients");
const pat = pats.find((p) => p.payer_code === "GMA") ?? pats[0];
const prods = await j("GET", "/products/lookup?q=Lipitor");
let rx = await j("POST", "/prescriptions", { patient_id: pat.id, doctor_id: meta.doctors[0].id, source: "erx", priority: "urgent", diagnosis_code: "E78.5", diagnosis: "Hyperlipidaemia",
  items: [{ product_id: prods[0].id, dose: 1, frequency_per_day: 1, days: 30, sig: "1 tablet at night" }] });
ok("prescription received", `${rx.rx_no} stage=${rx.stage}`);
rx = await j("POST", `/prescriptions/${rx.id}/review`);
rx = await j("POST", `/prescriptions/${rx.id}/verify`, { overrides: rx.alerts.filter((a) => a.severity === "major").map((a) => ({ key: a.key, reason: "Prescriber confirmed by phone" })) });
ok("verified", rx.status);
rx = await j("POST", `/prescriptions/${rx.id}/dispensings`, { items: [{ prescription_item_id: rx.items[0].id, qty: 15 }] });
ok("partial supply prepared", `${rx.dispensings[0].disp_no} claims=${rx.claims.map((c) => c.status)}`);
rx = await j("POST", `/dispensings/${rx.dispensings[0].id}/check`);
rx = await j("POST", `/dispensings/${rx.dispensings[0].id}/handover`, { payment_method: "card", override_rejected: true });
ok("handed over", `rx=${rx.status} stage=${rx.stage}`);
const drafts = rx.claims.filter((c) => c.status === "draft").map((c) => c.id);
if (drafts.length) {
  ok("submitted", (await j("POST", "/claims/submit", { ids: drafts })).submitted);
  const adj = await j("POST", "/claims/adjudicate", { ids: drafts });
  const ra = await j("GET", `/remittances/${adj.remittances[0]}`);
  ok("remittance", `${ra.ra_no} approved=${ra.total_approved} ${ra.lines.map((l) => l.outcome)}`);
  if (ra.total_approved > 0) ok("payment posted", (await j("POST", `/remittances/${ra.id}/post-payment`, { method: "eft" })).payment_ref);
}
rx = await j("GET", `/prescriptions/${rx.id}`);
ok("chain", rx.chain.map((c) => `${c.key}:${c.status}`).join("  "));
const otc = await j("GET", "/products/lookup?q=Panadol&schedule=otc");
ok("counter sale", (await j("POST", "/sales", { items: [{ product_id: otc[0].id, qty: 2 }], payment_method: "cash" })).bill_no);
const sup = await j("GET", "/suppliers");
let po = await j("POST", "/purchase-orders", { supplier_id: sup[0].id, items: [{ product_id: prods[0].id, qty: 50 }] });
po = await j("POST", `/purchase-orders/${po.id}/approve`);
po = await j("POST", `/purchase-orders/${po.id}/send`);
po = await j("POST", `/purchase-orders/${po.id}/receive`, { lines: [{ po_item_id: po.items[0].id, qty: 50, batch_no: "T12345", expiry: "2028-01-01" }] });
ok("purchase order received", `${po.po_no} ${po.status}`);
const exp = await j("GET", "/batches?filter=expiring");
const tr = await j("GET", `/batches/${exp[0].id}/trace`);
ok("batch trace", `${tr.batch.batch_no} patients=${tr.patients.length} movements=${tr.movements.length}`);
ok("claims summary", JSON.stringify((await j("GET", "/claims/summary")).aging[0]));
ok("search", (await j("GET", "/search?q=Ahm")).length);
ok("audit rows", (await j("GET", "/audit?limit=5")).total);
try { await j("POST", "/sales", { items: [{ product_id: prods[0].id, qty: 1 }], payment_method: "cash" }); console.log("✗ Rx item sold over the counter"); process.exit(1); }
catch (e) { ok("rx item blocked at counter", e.message.includes("needs a prescription")); }

// Customer order: new → confirmed (stock reserved) → ready → out for delivery → completed (invoice + payment)
const pana = (await j("GET", "/products/lookup?q=Panadol&schedule=otc"))[0];
let ord = await j("POST", "/orders", { customer_name: "Smoke Test", phone: "+971500000000", channel: "web", fulfilment: "delivery", address: "1 Test Street", payment: "cash_on_delivery", items: [{ product_id: pana.id, qty: 3 }] });
for (const step of ["confirm", "ready", "dispatch"]) ord = await j("POST", `/orders/${ord.id}/${step}`, { rider: "Test rider" });
ord = await j("POST", `/orders/${ord.id}/complete`, { payment_method: "cash" });
ok("order delivered and invoiced", `${ord.order_no} ${ord.status} ${ord.bill_no}`);
try { await j("POST", "/orders", { customer_name: "Rx Check", phone: "+971500000001", channel: "web", fulfilment: "pickup", payment: "prepaid", items: [{ product_id: prods[0].id, qty: 1 }] }); console.log("✗ Rx item accepted on an order"); process.exit(1); }
catch (e) { ok("rx item blocked on orders", e.message.includes("needs a prescription")); }

// Sales return: refund 1 of 3 units, then the rest; invoice reverses when everything is back
const inv = await j("GET", `/sales/${ord.bill_id}`);
await j("POST", `/sales/${inv.id}/returns`, { lines: [{ bill_line_id: inv.lines[0].id, qty: 1 }], reason: "Packaging damaged", method: "cash" });
await j("POST", `/sales/${inv.id}/returns`, { lines: [{ bill_line_id: inv.lines[0].id, qty: 2 }], reason: "Customer changed mind", method: "card" });
const after = await j("GET", `/sales/${inv.id}`);
ok("sales returned in two parts", `${after.returns.length} credit notes, refunded ${after.refunded}, invoice ${after.status}`);
try { await j("POST", `/sales/${inv.id}/returns`, { lines: [{ bill_line_id: inv.lines[0].id, qty: 1 }], reason: "again", method: "cash" }); console.log("✗ over-return allowed"); process.exit(1); }
catch (e) { ok("over-return blocked", e.message.slice(0, 40)); }
ok("sales list and summary", `${(await j("GET", "/sales?days=7")).length} invoices, net ${(await j("GET", "/sales/summary?days=7")).net}`);
ok("returns list", (await j("GET", "/sales/returns?days=30")).length);

// Prior authorization: request with justification, then record the payer's partial approval
const humira = (await j("GET", "/products/lookup?q=Humira"))[0];
const covered = pats.find((p) => p.payer_code && p.coverage_to >= new Date().toISOString().slice(0, 10));
let arx = await j("POST", "/prescriptions", { patient_id: covered.id, doctor_id: meta.doctors[0].id, source: "erx", priority: "routine", items: [{ product_id: humira.id, dose: 1, frequency_per_day: 1, days: 2, qty: 4, sig: "Inject 40 mg every other week" }] });
arx = await j("POST", `/prescriptions/${arx.id}/authorizations`, { justification: "Failed two conventional DMARDs" });
const auth = arx.authorizations[0];
const ad = await j("GET", `/authorizations/${auth.id}`);
await j("POST", `/authorizations/${auth.id}/decision`, { decision: "partially_approved", items: [{ id: ad.items[0].id, qty_approved: 2 }], payer_ref: "CHI-PA-778812", valid_to: "2027-03-31", note: "Approved for 2 pens pending review" });
const decided = await j("GET", `/authorizations/${auth.id}`);
ok("authorization decision recorded", `${decided.auth_no} ${decided.status} ${decided.items[0].qty_approved}/${decided.items[0].qty_requested} ref ${decided.payer_ref}`);
ok("authorization worklist", JSON.stringify((await j("GET", "/authorizations")).counts));

console.log("\nAll smoke checks passed.");
