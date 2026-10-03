import type {
  AiSuggestion,
  CdsAlert,
  Encounter,
  Patient,
  ScoreResult,
  Soap,
  Vitals,
} from "./types.ts";
import { CROSS_REACTIVITY, DRUGS, ICD, INTERACTIONS, ORDER_SETS, ORDERABLES, SCORES } from "./catalog.ts";
import { uid, nowIso } from "./ids.ts";

export const ageOf = (dob: string) => {
  const d = new Date(dob);
  const n = new Date();
  let age = n.getFullYear() - d.getFullYear();
  if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) age--;
  return age;
};

// ---------------- Clinical decision support ----------------

export function runCds(patient: Patient, enc: Encounter): CdsAlert[] {
  const alerts: CdsAlert[] = [];
  const rxIds = enc.prescriptions.map((p) => p.drugId);
  const activeAllergies = patient.allergies.filter((a) => a.status === "active");

  // Drug-allergy and cross-reactivity
  for (const rx of enc.prescriptions) {
    const d = DRUGS.find((x) => x.id === rx.drugId);
    if (!d?.allergyClass) continue;
    for (const al of activeAllergies) {
      if (!al.allergyClass) continue;
      const rule = CROSS_REACTIVITY[al.allergyClass]?.find((r) => r.cls === d.allergyClass);
      if (rule) {
        alerts.push({
          id: uid("cds"),
          level: rule.level,
          source: "allergy",
          title: rule.level === "critical" ? `${d.name} contraindicated` : `${d.name}: cross-reactivity`,
          detail: `Recorded allergy to ${al.substance} (${al.reaction}, ${al.severity}). ${rule.level === "critical" ? "Choose a different agent." : "Low cross-reactivity risk; use only if benefit outweighs risk."}`,
        });
      }
    }
  }

  // Interactions: new prescriptions against each other and against current home meds
  const homeMedIds = patient.medications
    .filter((m) => m.status === "active")
    .map((m) => DRUGS.find((d) => m.name.toLowerCase().startsWith(d.name.toLowerCase().split(" ")[0]))?.id)
    .filter(Boolean) as string[];
  const all = Array.from(new Set([...rxIds, ...homeMedIds]));
  for (const rule of INTERACTIONS) {
    const hitA = all.filter((x) => rule.a.includes(x));
    const hitB = all.filter((x) => rule.b.includes(x));
    if (hitA.length && hitB.length && (hitA.some((x) => rxIds.includes(x)) || hitB.some((x) => rxIds.includes(x)))) {
      const names = [...hitA, ...hitB].map((id) => DRUGS.find((d) => d.id === id)?.name ?? id);
      alerts.push({ id: uid("cds"), level: rule.level, source: "interaction", title: rule.title, detail: `${names.join(" + ")}. ${rule.detail}` });
    }
  }

  // Duplicate therapy
  const classes = enc.prescriptions.map((p) => DRUGS.find((d) => d.id === p.drugId)?.drugClass);
  const dupes = classes.filter((c, i) => c && classes.indexOf(c) !== i);
  for (const c of Array.from(new Set(dupes))) {
    alerts.push({ id: uid("cds"), level: "warning", source: "duplicate", title: "Duplicate therapy", detail: `More than one ${c} prescribed.` });
  }

  // Already on the same drug at home
  for (const rx of enc.prescriptions) {
    if (homeMedIds.includes(rx.drugId)) {
      alerts.push({ id: uid("cds"), level: "info", source: "duplicate", title: `${rx.name} already on medication list`, detail: "Confirm this is a repeat or a dose change." });
    }
  }

  // Vitals
  const latest = latestVitals(enc.vitals);
  if (latest?.spo2 !== undefined && latest.spo2 < 92) {
    alerts.push({ id: uid("cds"), level: "critical", source: "vitals", title: `SpO2 ${latest.spo2}%`, detail: "Hypoxia on remote reading. Consider urgent in-person assessment." });
  } else if (latest?.spo2 !== undefined && latest.spo2 <= 94) {
    alerts.push({ id: uid("cds"), level: "warning", source: "vitals", title: `SpO2 ${latest.spo2}%`, detail: "Borderline saturation. Recheck after rest; safety-net clearly." });
  }
  if (latest?.sys !== undefined && latest.sys >= 180) {
    alerts.push({ id: uid("cds"), level: "critical", source: "vitals", title: `BP ${latest.sys}/${latest.dia}`, detail: "Severe hypertension. Assess for end-organ symptoms." });
  }
  if (latest?.sys !== undefined && latest.sys < 105 && patient.medications.some((m) => /furosemide|bisoprolol/i.test(m.name))) {
    alerts.push({ id: uid("cds"), level: "warning", source: "vitals", title: `Low BP on rate/diuretic therapy`, detail: `Systolic ${latest.sys}. Consider postural hypotension from diuretic or beta-blocker.` });
  }
  if (latest?.temp !== undefined && latest.temp >= 39.5) {
    alerts.push({ id: uid("cds"), level: "warning", source: "vitals", title: `High fever ${latest.temp} °C`, detail: "Assess for sepsis features." });
  }

  // Guidelines
  const age = ageOf(patient.dob);
  if (patient.medications.some((m) => /warfarin/i.test(m.name)) && !enc.orders.some((o) => o.code === "6301-6")) {
    alerts.push({ id: uid("cds"), level: "info", source: "guideline", title: "Patient on warfarin", detail: "No INR ordered in this encounter. Consider PT/INR if bleeding, falls or new medicines." });
  }
  if (patient.pregnant && enc.prescriptions.some((p) => ["doxycycline", "ciprofloxacin", "atorvastatin", "warfarin", "lisinopril", "losartan"].includes(p.drugId))) {
    alerts.push({ id: uid("cds"), level: "critical", source: "guideline", title: "Pregnancy", detail: "One or more prescribed drugs is not recommended in pregnancy." });
  }
  if (age < 12 && enc.prescriptions.some((p) => p.drugId === "aspirin")) {
    alerts.push({ id: uid("cds"), level: "critical", source: "dose", title: "Aspirin in a child", detail: "Avoid aspirin under 16 years (Reye syndrome)." });
  }
  if (age < 12 && enc.prescriptions.some((p) => !["amoxicillin-susp", "paracetamol", "ibuprofen", "cetirizine", "emollient", "hydrocortisone-cream", "ors"].includes(p.drugId))) {
    alerts.push({ id: uid("cds"), level: "warning", source: "dose", title: "Pediatric dosing", detail: `Patient is ${age} years, ${patient.weightKg ?? "?"} kg. Confirm weight-based dosing.` });
  }
  if (patient.smoking === "current" && !enc.diagnoses.some((d) => d.code.startsWith("F17"))) {
    alerts.push({ id: uid("cds"), level: "info", source: "guideline", title: "Current smoker", detail: "Offer brief cessation advice and record nicotine dependence." });
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}

export function latestVitals(vs: Vitals[]): Vitals | undefined {
  if (!vs.length) return undefined;
  const sorted = [...vs].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  // Merge so the latest value of each parameter is used
  return sorted.reduce((acc, cur) => ({ ...acc, ...Object.fromEntries(Object.entries(cur).filter(([, val]) => val !== undefined)) }), {} as Vitals);
}

// ---------------- AI suggestions (rule-based mock) ----------------

const RULES: { match: RegExp; dx: string[]; orders: string[]; drugs: string[]; scores: string[]; set?: string }[] = [
  { match: /fever|temperature|pyrex/i, dx: ["R50.9"], orders: ["58410-2", "1988-5"], drugs: ["paracetamol"], scores: ["news2"] },
  { match: /cough|sputum|chest infection/i, dx: ["J20.9", "R05.9", "J18.9"], orders: ["IMG-CXR", "94500-6", "92142-9"], drugs: [], scores: ["curb65"], set: "os-fever" },
  { match: /wheez|asthma|inhaler/i, dx: ["J45.901"], orders: ["PRC-PEF", "NUR-INHALER"], drugs: ["prednisolone", "salbutamol"], scores: [] },
  { match: /sore throat|swallow|tonsil/i, dx: ["J02.9", "J02.0"], orders: ["18481-2"], drugs: ["phenoxymethylpenicillin"], scores: ["centor"], set: "os-throat" },
  { match: /dizz|lighthead|faint|near-fall|fall/i, dx: ["R42"], orders: ["PRC-ECG", "51990-0", "58410-2"], drugs: [], scores: ["news2"], set: "os-dizzy" },
  { match: /blood pressure|bp |hypertens/i, dx: ["I10"], orders: ["51990-0", "57698-3", "NUR-BPDIARY"], drugs: [], scores: [], set: "os-htn" },
  { match: /diabet|sugar|glucose|hba1c/i, dx: ["E11.9"], orders: ["4548-4", "9343-4"], drugs: [], scores: [], set: "os-dm" },
  { match: /anxi|worry|panic|nervous/i, dx: ["F41.1"], orders: ["3016-3", "REF-CBT"], drugs: [], scores: ["gad7"], set: "os-mood" },
  { match: /depress|low mood|hopeless/i, dx: ["F32.9"], orders: ["3016-3", "REF-CBT"], drugs: [], scores: ["phq9"], set: "os-mood" },
  { match: /urin|dysuria|burning when/i, dx: ["N39.0"], orders: ["24356-8", "630-4"], drugs: ["nitrofurantoin"], scores: [], set: "os-uti" },
  { match: /eczema|rash|itch|dermatitis/i, dx: ["L20.9", "L30.9"], orders: ["NUR-WOUND"], drugs: ["emollient", "hydrocortisone-cream"], scores: [] },
  { match: /back pain|lifting|lumbar/i, dx: ["M54.50"], orders: ["REF-PHYSIO"], drugs: ["naproxen", "paracetamol"], scores: [] },
  { match: /ear pain|otitis|\bear\b|earache/i, dx: ["H66.90"], orders: [], drugs: ["paracetamol", "amoxicillin-susp"], scores: [] },
  { match: /chest pain|tightness/i, dx: ["R07.9"], orders: ["PRC-ECG", "10839-9"], drugs: [], scores: ["news2"], set: "os-chest" },
  { match: /headache|migraine/i, dx: ["R51.9", "G43.909"], orders: [], drugs: ["paracetamol"], scores: [] },
  { match: /sleep|insomnia/i, dx: ["G47.00"], orders: [], drugs: ["melatonin"], scores: [] },
];

export function suggest(patient: Patient, enc: Encounter): AiSuggestion[] {
  const raw = [enc.triage.chiefComplaint, enc.triage.nurseNote, enc.soap.subjective, enc.soap.objective, enc.soap.assessment, ...enc.transcript.map((t) => t.text)].join(" \n ");
  // Allergy history ("penicillin allergy (rash)") describes past reactions, not today's problem
  const text = raw
    .split(/(?<=[.!?\n])\s+/)
    .filter((sentence) => !/allerg|anaphyla/i.test(sentence))
    .join(" ");
  const out: AiSuggestion[] = [];
  const have = {
    dx: new Set(enc.diagnoses.map((d) => d.code)),
    orders: new Set(enc.orders.map((o) => o.code)),
    drugs: new Set(enc.prescriptions.map((p) => p.drugId)),
    scores: new Set(enc.scores.map((s) => s.key)),
  };
  const seen = new Set<string>();
  const push = (s: AiSuggestion) => {
    if (seen.has(s.type + s.ref)) return;
    seen.add(s.type + s.ref);
    out.push(s);
  };
  const allergyClasses = patient.allergies.filter((a) => a.status === "active").map((a) => a.allergyClass);

  RULES.forEach((rule) => {
    const m = text.match(rule.match);
    if (!m) return;
    const cue = m[0].trim();
    rule.dx.forEach((code, i) => {
      if (have.dx.has(code)) return;
      const c = ICD.find((x) => x.code === code);
      if (c) push({ id: uid("ai"), type: "diagnosis", ref: code, label: `${code} ${c.display}`, reason: `Mentions “${cue}”`, confidence: Math.max(0.45, 0.88 - i * 0.14) });
    });
    rule.orders.forEach((code) => {
      if (have.orders.has(code)) return;
      const c = ORDERABLES.find((x) => x.code === code);
      if (c) push({ id: uid("ai"), type: "order", ref: code, label: c.name, reason: `Commonly ordered for ${cue}`, confidence: 0.7 });
    });
    rule.drugs.forEach((id) => {
      if (have.drugs.has(id)) return;
      const d = DRUGS.find((x) => x.id === id);
      if (!d) return;
      if (d.allergyClass && allergyClasses.includes(d.allergyClass)) return; // never suggest an allergen
      push({ id: uid("ai"), type: "drug", ref: id, label: `${d.name} ${d.strength}`, reason: `First-line for ${cue}`, confidence: 0.62 });
    });
    rule.scores.forEach((key) => {
      if (have.scores.has(key)) return;
      const s = SCORES.find((x) => x.key === key);
      if (s) push({ id: uid("ai"), type: "score", ref: key, label: s.name, reason: s.purpose, confidence: 0.75 });
    });
    if (rule.set) {
      const set = ORDER_SETS.find((x) => x.id === rule.set);
      if (set && !set.orders.every((c) => have.orders.has(c))) push({ id: uid("ai"), type: "orderset", ref: set.id, label: `Order set: ${set.name}`, reason: set.description, confidence: 0.66 });
    }
  });

  if (patient.smoking === "current" && !have.dx.has("F17.210")) {
    push({ id: uid("ai"), type: "diagnosis", ref: "F17.210", label: "F17.210 Nicotine dependence, cigarettes", reason: "Smoking status: current", confidence: 0.8 });
  }
  return out.sort((a, b) => b.confidence - a.confidence).slice(0, 14);
}

// ---------------- Scores ----------------

const bandFor = (key: string, value: number) => {
  const def = SCORES.find((s) => s.key === key)!;
  const b = [...def.bands].reverse().find((x) => value >= x.min) ?? def.bands[0];
  return b;
};

export function computeScore(key: string, answers: Record<string, number>, vitals?: Vitals): ScoreResult {
  const def = SCORES.find((s) => s.key === key);
  if (!def) throw new Error(`Unknown score ${key}`);
  let value = 0;
  let max = 0;
  let parts = answers;
  if (key === "news2") {
    const r = news2(vitals);
    value = r.total;
    parts = r.parts;
    max = 20;
  } else {
    value = Object.values(answers).reduce((s, x) => s + x, 0);
    max = def.items.reduce((s, it) => s + Math.max(...it.options.map((o) => o.points)), 0);
  }
  let b = bandFor(key, value);
  if (key === "news2" && Object.values(parts).some((p) => p === 3) && b.band === "low") {
    b = { min: 0, band: "moderate", interpretation: "Single parameter scored 3. Urgent ward-based review equivalent." };
  }
  if (key === "phq9" && (answers.q9 ?? 0) > 0) {
    b = { ...b, band: "high", interpretation: `${b.interpretation}. Item 9 positive: complete a suicide risk assessment now.` };
  }
  return { id: uid("score"), key, name: def.name, value, max, band: b.band, interpretation: b.interpretation, answers: parts, at: nowIso() };
}

function news2(vs?: Vitals) {
  const parts: Record<string, number> = {};
  if (!vs) return { total: 0, parts };
  const rr = vs.rr;
  if (rr !== undefined) parts.rr = rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3;
  const s = vs.spo2;
  if (s !== undefined) parts.spo2 = s <= 91 ? 3 : s <= 93 ? 2 : s <= 95 ? 1 : 0;
  parts.oxygen = vs.onOxygen ? 2 : 0;
  const sys = vs.sys;
  if (sys !== undefined) parts.sys = sys <= 90 ? 3 : sys <= 100 ? 2 : sys <= 110 ? 1 : sys <= 219 ? 0 : 3;
  const hr = vs.hr;
  if (hr !== undefined) parts.hr = hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3;
  parts.consciousness = vs.consciousness && vs.consciousness !== "alert" ? 3 : 0;
  const t = vs.temp;
  if (t !== undefined) parts.temp = t <= 35 ? 3 : t <= 36 ? 1 : t <= 38 ? 0 : t <= 39 ? 1 : 2;
  return { total: Object.values(parts).reduce((a, b) => a + b, 0), parts };
}

// ---------------- Ambient scribe ----------------

interface Script {
  match: RegExp;
  lines: [("clinician" | "patient"), string][];
  soap: Soap;
}

const SCRIPTS: Script[] = [
  {
    match: /fever|cough/i,
    lines: [
      ["clinician", "Hi Ana, I can see you and hear you well. Tell me what's been going on."],
      ["patient", "I've had a fever and a cough for three days. Last night it was 38.6."],
      ["clinician", "Are you bringing up any phlegm? What colour is it?"],
      ["patient", "Yes, a bit yellow. And I feel tight in the chest when I cough."],
      ["clinician", "How often are you using your blue inhaler compared with normal?"],
      ["patient", "Maybe four or five times a day. Normally once a week."],
      ["clinician", "Any chest pain when you breathe in, or coughing up blood?"],
      ["patient", "No blood. A little pain on the right side when I cough hard."],
      ["clinician", "Your oximeter is showing 95 percent and a heart rate around 104. Can you take a deep breath for me?"],
      ["patient", "Okay… that makes me cough."],
      ["clinician", "I can hear an occasional wheeze over the call. You're speaking in full sentences, which is reassuring."],
      ["clinician", "Remember you're allergic to penicillin, so I'll avoid amoxicillin. I'd like a chest X-ray and some bloods today."],
      ["patient", "Okay, can I do those near my home?"],
      ["clinician", "Yes, the orders go to the nearest partner lab. I'll also give you a short course of steroid for the asthma."],
    ],
    soap: {
      subjective: "3 days of fever (Tmax 38.6 °C) and productive cough with yellow sputum. Chest tightness, reliever use increased to 4–5×/day from weekly. Right-sided pleuritic pain on forceful cough. No haemoptysis. Known asthma. Allergy: penicillin (anaphylaxis).",
      objective: "Video: alert, speaking full sentences, occasional audible wheeze, cough on deep inspiration. Remote: SpO2 95% RA, HR 104, T 38.4 °C, RR 20.",
      assessment: "Lower respiratory tract infection with acute asthma exacerbation. Pneumonia not excluded. NEWS2 low–medium; CRB-65 0.",
      plan: "CXR PA/lateral, CBC, CRP, SARS-CoV-2 and influenza PCR. Prednisolone 40 mg × 5 days, salbutamol via spacer as needed. If antibiotic required: doxycycline (penicillin allergy). Nurse device recheck in 30 min. Safety-net: worsening breathlessness, SpO2 < 94%, inability to speak in sentences → ED. Review with results in 48 h.",
    },
  },
  {
    match: /dizz|stand/i,
    lines: [
      ["clinician", "Hello Grace, the nurse told me you've been dizzy when standing up."],
      ["patient", "Yes doctor, everything goes grey for a moment and I have to hold on."],
      ["clinician", "Did you hit your head or black out at any point?"],
      ["patient", "No, I grabbed the counter. My daughter was there."],
      ["clinician", "Your water tablet was increased last week, is that right?"],
      ["patient", "Yes, the cardiologist doubled it. I've been going to the toilet a lot and not drinking much."],
      ["clinician", "Any chest pain, palpitations that are worse than usual, or new shortness of breath?"],
      ["patient", "No, my breathing is actually better. The ankles are less swollen."],
      ["clinician", "Can you stand up slowly with the cuff on, so we take a standing pressure?"],
      ["patient", "Alright… I'm standing now. A little woozy."],
      ["clinician", "Standing pressure is lower, around 92. I think the higher furosemide dose is dropping your pressure."],
    ],
    soap: {
      subjective: "2 days postural lightheadedness, near-fall yesterday without head injury or LOC. Furosemide increased 20 → 40 mg last week. Reduced oral intake (nausea). Breathing and ankle oedema improved. No chest pain or new palpitations. On warfarin, bisoprolol.",
      objective: "Video: alert, oriented. Remote lying BP 102/60, standing ~92 systolic with symptoms. HR 92–94 irregular. SpO2 94%. Afebrile.",
      assessment: "Orthostatic hypotension, likely diuretic-related volume depletion. AF rate controlled. Fall risk on anticoagulation.",
      plan: "Reduce furosemide to 20 mg, liaise with cardiology. BMP (renal function, K+), CBC, INR, 12-lead ECG. Falls risk assessment. Daily weights. Safety-net: syncope, head injury, chest pain → ED. Nurse call in 24 h.",
    },
  },
  {
    match: /throat/i,
    lines: [
      ["clinician", "Hi Kwame, tell me about the sore throat."],
      ["patient", "It started two days ago, really painful to swallow. Fever last night."],
      ["clinician", "Any cough or runny nose?"],
      ["patient", "No cough at all."],
      ["clinician", "Could you open your mouth wide and point the camera at your throat? Say aah."],
      ["patient", "Aaah."],
      ["clinician", "I can see swollen tonsils with some white patches. Feel under your jaw, is it tender there?"],
      ["patient", "Yes, both sides are sore."],
    ],
    soap: {
      subjective: "2 days of severe odynophagia with fever. No cough or coryza. No drooling, stridor or trismus.",
      objective: "Video oropharynx: enlarged tonsils with exudate bilaterally. Self-palpated tender anterior cervical nodes. Remote T 38.2 °C, HR 88.",
      assessment: "Acute pharyngitis, likely streptococcal. Centor/McIsaac 4.",
      plan: "Rapid strep test at partner pharmacy; if positive, penicillin V 500 mg QID × 10 days. Paracetamol for pain. Safety-net: difficulty breathing, drooling, unable to swallow fluids → urgent care.",
    },
  },
  {
    match: /.*/,
    lines: [
      ["clinician", "Hello, thanks for joining. What would you like to talk about today?"],
      ["patient", "I wanted to go through my symptoms and my medicines."],
      ["clinician", "Of course. When did this start, and is it getting better or worse?"],
      ["patient", "About a week ago. It's about the same."],
      ["clinician", "Any red-flag symptoms like chest pain, breathlessness or fever?"],
      ["patient", "No, none of those."],
      ["clinician", "Good. Let's review your readings and agree a plan."],
    ],
    soap: {
      subjective: "Symptoms for approximately 1 week, stable. No chest pain, breathlessness or fever. Medications reviewed with patient.",
      objective: "Video: well, comfortable at rest. Remote vitals reviewed.",
      assessment: "",
      plan: "Plan agreed with patient. Safety-netting advice given. Follow-up as needed.",
    },
  },
];

export function scriptFor(reason: string): Script {
  return SCRIPTS.find((s) => s.match.test(reason)) ?? SCRIPTS[SCRIPTS.length - 1];
}

export function scribe(reason: string, patient: Patient, enc: Encounter): Soap {
  const s = scriptFor(reason);
  const heard = enc.transcript.length;
  const first = s.soap;
  const name = `${patient.firstName} ${patient.lastName}`;
  return {
    subjective: heard ? first.subjective : `${first.subjective}\n(Draft generated from triage and pre-visit answers for ${name}; no audio captured.)`,
    objective: first.objective,
    assessment: first.assessment,
    plan: first.plan,
  };
}
