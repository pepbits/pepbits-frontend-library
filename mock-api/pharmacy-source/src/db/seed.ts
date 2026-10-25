import { pathToFileURL } from "node:url";
import { db, resetDb, tx } from "./index.js";
import { addDays, setClock } from "../lib/clock.js";
import { uid } from "../lib/ids.js";
import { logHistory } from "../services/history.js";
import * as rx from "../services/rx.js";
import * as rcm from "../services/rcm.js";
import * as ops from "../services/ops.js";
import * as stock from "../services/stock.js";
import * as orders from "../services/orders.js";
import * as sales from "../services/sales.js";

// Deterministic randomness so every fresh seed looks the same
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261001);
const pick = <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
const between = (a: number, b: number) => Math.floor(a + rng() * (b - a + 1));
const iso = (d: Date) => d.toISOString().slice(0, 10);

const USERS = [
  ["u_amira", "Amira Haddad", "pharmacist", "AH"],
  ["u_omar", "Omar Farouk", "pharmacist", "OF"],
  ["u_lina", "Lina Joseph", "technician", "LJ"],
  ["u_ravi", "Ravi Menon", "billing", "RM"],
  ["u_sara", "Sara Al Mansoori", "admin", "SM"],
] as const;

const SUPPLIERS = [
  ["sup_gulf", "Gulfstream Pharma Distribution", "Hassan Ali", 2, 4.6],
  ["sup_medline", "Medline Wholesale", "Priya Nair", 3, 4.2],
  ["sup_cold", "ColdPath Biologics", "Karim Saleh", 4, 4.8],
  ["sup_city", "CityCare Supplies", "Mona Ibrahim", 1, 3.9],
] as const;

// name, generic, ingredient, class, strength, form, category, schedule, auth, cold, unit, pack, cost, price, reorder, max, maxDaily, doseUnit, supplier
type P = [string, string, string, string, string, string, string, "otc" | "rx" | "controlled", 0 | 1, 0 | 1, string, number, number, number, number, number, number | null, string, string];
const PRODUCTS: P[] = [
  ["Panadol 500", "Paracetamol", "paracetamol", "Analgesic", "500 mg", "Tablet", "Pain & fever", "otc", 0, 0, "tablet", 24, 0.12, 0.35, 200, 1200, 4000, "mg", "sup_city"],
  ["Brufen 400", "Ibuprofen", "ibuprofen", "NSAID", "400 mg", "Tablet", "Pain & fever", "otc", 0, 0, "tablet", 30, 0.2, 0.55, 150, 900, 2400, "mg", "sup_city"],
  ["Aspirin Protect 81", "Aspirin", "aspirin", "Antiplatelet", "81 mg", "Tablet", "Cardiovascular", "otc", 0, 0, "tablet", 30, 0.08, 0.25, 150, 900, 325, "mg", "sup_city"],
  ["Zyrtec 10", "Cetirizine", "cetirizine", "Antihistamine", "10 mg", "Tablet", "Allergy", "otc", 0, 0, "tablet", 20, 0.3, 0.95, 100, 600, 10, "mg", "sup_city"],
  ["Claritine 10", "Loratadine", "loratadine", "Antihistamine", "10 mg", "Tablet", "Allergy", "otc", 0, 0, "tablet", 20, 0.28, 0.9, 100, 600, 10, "mg", "sup_city"],
  ["D-Vital 1000", "Cholecalciferol", "cholecalciferol", "Vitamin", "1000 IU", "Capsule", "Vitamins", "otc", 0, 0, "capsule", 60, 0.1, 0.4, 120, 800, null, "IU", "sup_medline"],
  ["Rehydra ORS", "Oral rehydration salts", "oral rehydration salts", "Electrolyte", "20.5 g", "Sachet", "Digestive", "otc", 0, 0, "sachet", 10, 0.6, 1.75, 60, 300, null, "sachet", "sup_medline"],
  ["Imodium 2", "Loperamide", "loperamide", "Antidiarrheal", "2 mg", "Capsule", "Digestive", "otc", 0, 0, "capsule", 12, 0.35, 1.1, 60, 300, 16, "mg", "sup_city"],
  ["Pepcid 20", "Famotidine", "famotidine", "H2 blocker", "20 mg", "Tablet", "Digestive", "otc", 0, 0, "tablet", 28, 0.25, 0.8, 80, 400, 80, "mg", "sup_medline"],
  ["Voltaren Emulgel", "Diclofenac gel 1%", "diclofenac", "NSAID", "1%", "Gel", "Pain & fever", "otc", 0, 0, "tube", 1, 9.5, 24, 20, 120, null, "g", "sup_city"],
  ["Losec 20", "Omeprazole", "omeprazole", "Proton pump inhibitor", "20 mg", "Capsule", "Digestive", "rx", 0, 0, "capsule", 28, 0.45, 1.4, 120, 800, 40, "mg", "sup_gulf"],
  ["Nexium 40", "Esomeprazole", "esomeprazole", "Proton pump inhibitor", "40 mg", "Tablet", "Digestive", "rx", 0, 0, "tablet", 28, 1.1, 3.2, 100, 600, 80, "mg", "sup_gulf"],
  ["Amoxil 500", "Amoxicillin", "amoxicillin", "Penicillin", "500 mg", "Capsule", "Anti-infectives", "rx", 0, 0, "capsule", 21, 0.35, 1.05, 150, 900, 3000, "mg", "sup_gulf"],
  ["Augmentin 625", "Amoxicillin + clavulanate", "amoxicillin", "Penicillin", "625 mg", "Tablet", "Anti-infectives", "rx", 0, 0, "tablet", 14, 1.2, 3.4, 120, 700, 1875, "mg", "sup_gulf"],
  ["Zithromax 500", "Azithromycin", "azithromycin", "Macrolide", "500 mg", "Tablet", "Anti-infectives", "rx", 0, 0, "tablet", 3, 3.5, 9.8, 40, 240, 500, "mg", "sup_gulf"],
  ["Klacid 500", "Clarithromycin", "clarithromycin", "Macrolide", "500 mg", "Tablet", "Anti-infectives", "rx", 0, 0, "tablet", 14, 2.1, 5.9, 60, 300, 1000, "mg", "sup_gulf"],
  ["Ciprobay 500", "Ciprofloxacin", "ciprofloxacin", "Fluoroquinolone", "500 mg", "Tablet", "Anti-infectives", "rx", 0, 0, "tablet", 10, 1.4, 3.9, 60, 300, 1500, "mg", "sup_gulf"],
  ["Glucophage 850", "Metformin", "metformin", "Biguanide", "850 mg", "Tablet", "Diabetes", "rx", 0, 0, "tablet", 60, 0.15, 0.45, 300, 1800, 2550, "mg", "sup_medline"],
  ["Diamicron MR 60", "Gliclazide", "gliclazide", "Sulfonylurea", "60 mg", "Tablet", "Diabetes", "rx", 0, 0, "tablet", 30, 0.5, 1.5, 120, 700, 120, "mg", "sup_medline"],
  ["Januvia 100", "Sitagliptin", "sitagliptin", "DPP-4 inhibitor", "100 mg", "Tablet", "Diabetes", "rx", 0, 0, "tablet", 28, 4.2, 10.5, 80, 420, 100, "mg", "sup_gulf"],
  ["Jardiance 10", "Empagliflozin", "empagliflozin", "SGLT2 inhibitor", "10 mg", "Tablet", "Diabetes", "rx", 1, 0, "tablet", 30, 5.1, 12.8, 60, 360, 25, "mg", "sup_gulf"],
  ["Lantus SoloStar", "Insulin glargine", "insulin glargine", "Long-acting insulin", "100 U/mL", "Pen", "Diabetes", "rx", 1, 1, "pen", 5, 38, 82, 25, 120, null, "unit", "sup_cold"],
  ["Ozempic 1 mg", "Semaglutide", "semaglutide", "GLP-1 agonist", "1 mg", "Pen", "Diabetes", "rx", 1, 1, "pen", 1, 310, 640, 8, 40, null, "mg", "sup_cold"],
  ["Lipitor 20", "Atorvastatin", "atorvastatin", "Statin", "20 mg", "Tablet", "Cardiovascular", "rx", 0, 0, "tablet", 30, 0.6, 1.9, 200, 1200, 80, "mg", "sup_gulf"],
  ["Crestor 10", "Rosuvastatin", "rosuvastatin", "Statin", "10 mg", "Tablet", "Cardiovascular", "rx", 0, 0, "tablet", 28, 0.9, 2.7, 150, 900, 40, "mg", "sup_gulf"],
  ["Zocor 20", "Simvastatin", "simvastatin", "Statin", "20 mg", "Tablet", "Cardiovascular", "rx", 0, 0, "tablet", 28, 0.3, 0.95, 100, 600, 40, "mg", "sup_medline"],
  ["Norvasc 5", "Amlodipine", "amlodipine", "Calcium channel blocker", "5 mg", "Tablet", "Cardiovascular", "rx", 0, 0, "tablet", 30, 0.25, 0.85, 200, 1200, 10, "mg", "sup_medline"],
  ["Zestril 10", "Lisinopril", "lisinopril", "ACE inhibitor", "10 mg", "Tablet", "Cardiovascular", "rx", 0, 0, "tablet", 28, 0.22, 0.7, 150, 900, 80, "mg", "sup_medline"],
  ["Cozaar 50", "Losartan", "losartan", "ARB", "50 mg", "Tablet", "Cardiovascular", "rx", 0, 0, "tablet", 28, 0.4, 1.2, 150, 900, 100, "mg", "sup_medline"],
  ["Concor 5", "Bisoprolol", "bisoprolol", "Beta blocker", "5 mg", "Tablet", "Cardiovascular", "rx", 0, 0, "tablet", 30, 0.3, 0.95, 150, 900, 20, "mg", "sup_medline"],
  ["Aldactone 25", "Spironolactone", "spironolactone", "Potassium-sparing diuretic", "25 mg", "Tablet", "Cardiovascular", "rx", 0, 0, "tablet", 30, 0.35, 1.0, 60, 360, 100, "mg", "sup_medline"],
  ["Marevan 5", "Warfarin", "warfarin", "Vitamin K antagonist", "5 mg", "Tablet", "Anticoagulants", "rx", 0, 0, "tablet", 28, 0.2, 0.6, 80, 500, 10, "mg", "sup_gulf"],
  ["Eliquis 5", "Apixaban", "apixaban", "Factor Xa inhibitor", "5 mg", "Tablet", "Anticoagulants", "rx", 1, 0, "tablet", 60, 3.4, 8.4, 120, 720, 20, "mg", "sup_gulf"],
  ["Clexane 40", "Enoxaparin", "enoxaparin", "Low molecular weight heparin", "40 mg", "Syringe", "Anticoagulants", "rx", 0, 1, "syringe", 10, 14, 31, 30, 160, 200, "mg", "sup_cold"],
  ["Plavix 75", "Clopidogrel", "clopidogrel", "P2Y12 inhibitor", "75 mg", "Tablet", "Cardiovascular", "rx", 0, 0, "tablet", 28, 0.8, 2.4, 120, 700, 75, "mg", "sup_gulf"],
  ["Euthyrox 100", "Levothyroxine", "levothyroxine", "Thyroid hormone", "100 mcg", "Tablet", "Endocrine", "rx", 0, 0, "tablet", 50, 0.12, 0.4, 150, 900, 300, "mcg", "sup_medline"],
  ["Ventolin Evohaler", "Salbutamol", "salbutamol", "Short-acting beta agonist", "100 mcg/dose", "Inhaler", "Respiratory", "rx", 0, 0, "inhaler", 1, 9, 19.5, 40, 200, null, "puff", "sup_gulf"],
  ["Seretide 250", "Fluticasone + salmeterol", "fluticasone", "Inhaled corticosteroid", "250/50 mcg", "Inhaler", "Respiratory", "rx", 0, 0, "inhaler", 1, 58, 121, 20, 100, null, "puff", "sup_gulf"],
  ["Singulair 10", "Montelukast", "montelukast", "Leukotriene antagonist", "10 mg", "Tablet", "Respiratory", "rx", 0, 0, "tablet", 28, 1.3, 3.6, 100, 560, 10, "mg", "sup_gulf"],
  ["Predsol 5", "Prednisolone", "prednisolone", "Corticosteroid", "5 mg", "Tablet", "Endocrine", "rx", 0, 0, "tablet", 30, 0.18, 0.6, 100, 600, 60, "mg", "sup_medline"],
  ["Zoloft 50", "Sertraline", "sertraline", "SSRI", "50 mg", "Tablet", "Mental health", "rx", 0, 0, "tablet", 28, 0.9, 2.6, 80, 480, 200, "mg", "sup_gulf"],
  ["Prozac 20", "Fluoxetine", "fluoxetine", "SSRI", "20 mg", "Capsule", "Mental health", "rx", 0, 0, "capsule", 28, 0.7, 2.1, 60, 360, 80, "mg", "sup_gulf"],
  ["Imigran 50", "Sumatriptan", "sumatriptan", "Triptan", "50 mg", "Tablet", "Neurology", "rx", 0, 0, "tablet", 6, 4.5, 11, 24, 120, 300, "mg", "sup_gulf"],
  ["Methotrexate 2.5", "Methotrexate", "methotrexate", "Antimetabolite", "2.5 mg", "Tablet", "Immunology", "rx", 0, 0, "tablet", 30, 0.6, 1.8, 40, 240, 25, "mg", "sup_gulf"],
  ["Humira 40", "Adalimumab", "adalimumab", "TNF inhibitor", "40 mg", "Pen", "Immunology", "rx", 1, 1, "pen", 2, 2100, 3950, 4, 16, null, "mg", "sup_cold"],
  ["Tramal 50", "Tramadol", "tramadol", "Opioid analgesic", "50 mg", "Capsule", "Controlled", "controlled", 0, 0, "capsule", 20, 0.9, 2.7, 60, 300, 400, "mg", "sup_gulf"],
  ["MST Continus 10", "Morphine sulfate", "morphine", "Opioid analgesic", "10 mg", "Tablet", "Controlled", "controlled", 0, 0, "tablet", 30, 1.6, 4.4, 30, 180, 120, "mg", "sup_gulf"],
  ["Xanax 0.5", "Alprazolam", "alprazolam", "Benzodiazepine", "0.5 mg", "Tablet", "Controlled", "controlled", 0, 0, "tablet", 30, 0.5, 1.6, 30, 180, 4, "mg", "sup_gulf"],
  ["Lyrica 75", "Pregabalin", "pregabalin", "Gabapentinoid", "75 mg", "Capsule", "Controlled", "controlled", 0, 0, "capsule", 56, 1.1, 3.1, 60, 360, 600, "mg", "sup_gulf"],
];

const INTERACTIONS: [string, string, "major" | "moderate" | "minor", string][] = [
  ["warfarin", "aspirin", "major", "Additive bleeding risk. Avoid unless the prescriber confirms dual therapy."],
  ["warfarin", "ibuprofen", "major", "NSAIDs raise bleeding risk and INR. Prefer paracetamol."],
  ["warfarin", "clarithromycin", "major", "Clarithromycin inhibits warfarin metabolism; INR may rise sharply."],
  ["warfarin", "ciprofloxacin", "moderate", "May raise INR. Advise an INR check within 5 days."],
  ["simvastatin", "clarithromycin", "major", "Contraindicated: high risk of myopathy and rhabdomyolysis."],
  ["clopidogrel", "omeprazole", "moderate", "Omeprazole reduces clopidogrel activation. Consider pantoprazole."],
  ["sertraline", "tramadol", "major", "Risk of serotonin syndrome and lowered seizure threshold."],
  ["fluoxetine", "tramadol", "major", "Risk of serotonin syndrome; fluoxetine also blocks tramadol activation."],
  ["lisinopril", "spironolactone", "moderate", "Risk of hyperkalaemia. Check potassium."],
  ["methotrexate", "ibuprofen", "major", "NSAIDs reduce methotrexate clearance; toxicity risk."],
  ["apixaban", "aspirin", "moderate", "Increased bleeding risk."],
  ["apixaban", "enoxaparin", "major", "Do not combine anticoagulants outside a bridging plan."],
  ["alprazolam", "morphine", "major", "Combined CNS and respiratory depression."],
  ["sumatriptan", "sertraline", "moderate", "Possible serotonin syndrome; counsel the patient."],
  ["levothyroxine", "omeprazole", "minor", "Reduced absorption; separate doses."],
];

const PAYERS = [
  ["pay_crescent", "Crescent Health Insurance", "CHI", "insurer", "pre_adjudication", 30, 80],
  ["pay_gulfmut", "Gulf Mutual Assurance", "GMA", "insurer", "post_dispense", 45, 90],
  ["pay_nexa", "Nexa Claims TPA", "NXT", "tpa", "post_dispense", 30, 70],
  ["pay_gov", "National Health Program", "NHP", "government", "post_dispense", 60, 100],
  ["pay_meridian", "Meridian Care", "MRC", "insurer", "pre_adjudication", 30, 50],
] as const;

const FIRST = ["Ahmed", "Fatima", "Yousef", "Mariam", "Rahul", "Anjali", "John", "Grace", "Khalid", "Noura", "Omar", "Layla", "Arjun", "Sofia", "Hamad", "Aisha", "David", "Meera", "Tariq", "Huda", "Joseph", "Reem", "Imran", "Elena", "Faisal", "Salma", "Nikhil", "Zainab"];
const LAST = ["Al Hashimi", "Rahman", "Pereira", "Nair", "Al Suwaidi", "Thomas", "Hussain", "Fernandes", "Al Kaabi", "Siddiqui", "Mathew", "Kovacs", "Al Zaabi", "Khan"];
const FEMALE = new Set(["Fatima", "Mariam", "Anjali", "Grace", "Noura", "Layla", "Sofia", "Aisha", "Meera", "Huda", "Reem", "Elena", "Salma", "Zainab"]);
const ALLERGY_POOL = ["penicillin", "aspirin", "NSAID", "sulfonamide", "codeine"];
const CONDITIONS = ["Type 2 diabetes", "Hypertension", "Asthma", "Atrial fibrillation", "Hypothyroidism", "Rheumatoid arthritis", "Dyslipidaemia", "Depression"];

const DOCTORS = [
  ["doc_1", "Dr. Nadia Karim", "Family medicine", "Al Noor Clinic"],
  ["doc_2", "Dr. Samuel Ortiz", "Cardiology", "Riverside Heart Centre"],
  ["doc_3", "Dr. Fatma Al Ali", "Endocrinology", "Al Noor Clinic"],
  ["doc_4", "Dr. Vikram Shah", "Internal medicine", "City General Hospital"],
  ["doc_5", "Dr. Helen Brooks", "Rheumatology", "City General Hospital"],
  ["doc_6", "Dr. Yasir Qureshi", "Psychiatry", "Wellmind Clinic"],
  ["doc_7", "Dr. Leila Haddad", "Pulmonology", "Riverside Heart Centre"],
  ["doc_8", "Dr. Ahmed Saleh", "Emergency medicine", "City General Hospital"],
];

// Plausible regimens: [product generic ingredient, dose units per intake, frequency/day, days, sig]
const REGIMENS: Record<string, [string, number, number, number, string][]> = {
  "Type 2 diabetes": [["metformin", 1, 2, 30, "1 tablet twice daily with meals"], ["gliclazide", 1, 1, 30, "1 tablet each morning with breakfast"], ["sitagliptin", 1, 1, 30, "1 tablet once daily"], ["empagliflozin", 1, 1, 30, "1 tablet each morning"], ["insulin glargine", 1, 1, 15, "Inject 18 units at bedtime; 1 pen per 15 days"], ["semaglutide", 1, 1, 1, "Inject 1 mg once weekly"]],
  Hypertension: [["amlodipine", 1, 1, 30, "1 tablet once daily"], ["lisinopril", 1, 1, 28, "1 tablet once daily"], ["losartan", 1, 1, 28, "1 tablet once daily"], ["bisoprolol", 1, 1, 30, "1 tablet each morning"], ["spironolactone", 1, 1, 30, "1 tablet each morning"]],
  Asthma: [["salbutamol", 1, 1, 1, "2 puffs when needed for wheeze"], ["fluticasone", 1, 1, 1, "1 puff twice daily; rinse mouth"], ["montelukast", 1, 1, 28, "1 tablet at night"]],
  "Atrial fibrillation": [["apixaban", 1, 2, 30, "1 tablet twice daily"], ["warfarin", 1, 1, 28, "Take as directed by INR clinic"], ["bisoprolol", 1, 1, 30, "1 tablet each morning"]],
  Hypothyroidism: [["levothyroxine", 1, 1, 50, "1 tablet before breakfast on an empty stomach"]],
  "Rheumatoid arthritis": [["methotrexate", 4, 1, 4, "4 tablets once weekly on the same day"], ["adalimumab", 1, 1, 2, "Inject 40 mg every other week"], ["prednisolone", 1, 1, 30, "1 tablet each morning with food"]],
  Dyslipidaemia: [["atorvastatin", 1, 1, 30, "1 tablet at night"], ["rosuvastatin", 1, 1, 28, "1 tablet at night"], ["simvastatin", 1, 1, 28, "1 tablet at night"]],
  Depression: [["sertraline", 1, 1, 28, "1 tablet each morning"], ["fluoxetine", 1, 1, 28, "1 capsule each morning"], ["alprazolam", 1, 2, 7, "1 tablet twice daily when needed"]],
};
const ACUTE: [string, number, number, number, string, string, string][] = [
  ["amoxicillin", 1, 3, 7, "1 capsule three times daily for 7 days", "J02.9", "Acute pharyngitis"],
  ["amoxicillin", 1, 2, 7, "1 tablet twice daily for 7 days", "J01.90", "Acute sinusitis"],
  ["azithromycin", 1, 1, 3, "1 tablet daily for 3 days", "J20.9", "Acute bronchitis"],
  ["clarithromycin", 1, 2, 7, "1 tablet twice daily for 7 days", "J18.9", "Community-acquired pneumonia"],
  ["ciprofloxacin", 1, 2, 5, "1 tablet twice daily for 5 days", "N39.0", "Urinary tract infection"],
  ["omeprazole", 1, 1, 28, "1 capsule before breakfast", "K21.9", "Gastro-oesophageal reflux"],
  ["esomeprazole", 1, 1, 14, "1 tablet before breakfast", "K29.70", "Gastritis"],
  ["tramadol", 1, 3, 5, "1 capsule up to three times daily when needed", "M54.5", "Low back pain"],
  ["pregabalin", 1, 2, 28, "1 capsule twice daily", "G62.9", "Neuropathic pain"],
  ["morphine", 1, 2, 7, "1 tablet every 12 hours", "C80.1", "Cancer pain"],
  ["sumatriptan", 1, 1, 6, "1 tablet at migraine onset; may repeat after 2 h", "G43.909", "Migraine"],
  ["enoxaparin", 1, 1, 10, "Inject 40 mg once daily for 10 days", "Z96.651", "Post-operative prophylaxis"],
  ["prednisolone", 6, 1, 5, "6 tablets once daily for 5 days", "J45.901", "Asthma exacerbation"],
];
const DX: Record<string, [string, string]> = {
  "Type 2 diabetes": ["E11.9", "Type 2 diabetes mellitus"], Hypertension: ["I10", "Essential hypertension"], Asthma: ["J45.909", "Asthma"],
  "Atrial fibrillation": ["I48.91", "Atrial fibrillation"], Hypothyroidism: ["E03.9", "Hypothyroidism"], "Rheumatoid arthritis": ["M06.9", "Rheumatoid arthritis"],
  Dyslipidaemia: ["E78.5", "Hyperlipidaemia"], Depression: ["F32.9", "Major depressive disorder"],
};

const at = (dayOffset: number, hour: number, minute = 0) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return new Date(addDays(d, dayOffset).getTime() + (hour * 60 + minute) * 60_000);
};

export function seed() {
  const today = new Date();
  setClock(at(-60, 6));

  tx(() => {
    const ins = (sql: string, ...rows: unknown[][]) => { const st = db.prepare(sql); for (const r of rows) st.run(...r); };
    ins("INSERT INTO users VALUES (?,?,?,?)", ...USERS.map((u) => [...u]));
    ins("INSERT INTO settings (key, value) VALUES (?,?)",
      ["pharmacy_name", "Phial Pharmacy"], ["branch_name", "Marina Branch"], ["currency", "AED"], ["license_no", "PH-2291-DXB"], ["timezone", "Asia/Dubai"], ["near_expiry_days", "90"]);
    ins("INSERT INTO suppliers (id, name, contact, phone, email, lead_time_days, rating, terms) VALUES (?,?,?,?,?,?,?,?)",
      ...SUPPLIERS.map(([id, name, contact, lead, rating]) => [id, name, contact, `+971 4 ${between(200, 899)} ${between(1000, 9999)}`, `orders@${id.slice(4)}.example`, lead, rating, "Net 30"]));

    PRODUCTS.forEach((p, i) => {
      const [name, generic, ingredient, cls, strength, form, category, schedule, auth, cold, unit, pack, cost, price, reorder, max, maxDaily, doseUnit, sup] = p;
      const id = `prd_${String(i + 1).padStart(3, "0")}`;
      db.prepare(
        `INSERT INTO products (id, sku, name, generic, ingredient, drug_class, strength, form, category, manufacturer, drug_code, barcode, schedule, requires_auth, cold_chain,
          dispense_unit, pack_size, cost_per_unit, price_per_unit, tax_rate, reorder_level, max_level, max_daily_dose, dose_unit, location, preferred_supplier_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(id, `SKU-${1000 + i}`, name, generic, ingredient, cls, strength, form, category, pick(["Pfizer", "GSK", "Novartis", "Sanofi", "AstraZeneca", "Julphar", "Hikma", "Novo Nordisk", "AbbVie"]),
        `${between(1000, 9999)}-${between(100, 999)}-${between(10, 99)}`, `629${between(1000000000, 9999999999)}`, schedule, auth, cold, unit, pack, cost, price,
        schedule === "otc" ? 0.05 : 0, reorder, max, maxDaily, doseUnit, cold ? `Fridge ${between(1, 2)}` : schedule === "controlled" ? "CD cabinet" : `${String.fromCharCode(65 + (i % 8))}-${between(1, 6)}-${between(1, 4)}`, sup);
    });
    ins("INSERT INTO interactions VALUES (?,?,?,?)", ...INTERACTIONS);

    for (const [id, name, code, type, wf, terms] of PAYERS) {
      db.prepare("INSERT INTO payers VALUES (?,?,?,?,?,?,?)").run(id, name, code, type, wf, terms, `claims@${code.toLowerCase()}.example`);
      // Contract prices: most at list, some payers discount specific lines
      PRODUCTS.forEach((p, i) => {
        if (p[7] === "otc") return;
        const factor = id === "pay_nexa" && i % 3 === 0 ? 0.88 : id === "pay_gov" && i % 4 === 0 ? 0.92 : 1;
        db.prepare("INSERT INTO payer_contract_prices VALUES (?,?,?,?)").run(id, `prd_${String(i + 1).padStart(3, "0")}`, Math.round(p[13] * factor * 100) / 100, "2025-01-01");
      });
    }

    DOCTORS.forEach(([id, name, spec, fac]) =>
      db.prepare("INSERT INTO doctors VALUES (?,?,?,?,?,?)").run(id, name, spec, `DHA-P-${between(10000, 99999)}`, fac, `+971 4 ${between(300, 899)} ${between(1000, 9999)}`));

    for (let i = 0; i < 34; i++) {
      const id = `pat_${String(i + 1).padStart(3, "0")}`;
      const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 5) % LAST.length]}`;
      const gender = FEMALE.has(FIRST[i % FIRST.length]) ? "F" : "M";
      const allergies = rng() < 0.3 ? [pick(ALLERGY_POOL)] : [];
      const conditions = Array.from(new Set([pick(Object.keys(REGIMENS)), ...(rng() < 0.5 ? [pick(Object.keys(REGIMENS))] : [])]));
      const dob = iso(new Date(Date.UTC(between(1948, 2004), between(0, 11), between(1, 28))));
      db.prepare("INSERT INTO patients VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(id, `MRN-${300100 + i * 7}`, name, dob, gender,
        `+971 5${between(0, 8)} ${between(100, 999)} ${between(1000, 9999)}`, `${name.split(" ")[0].toLowerCase()}.${i}@mail.example`, pick(["Dubai Marina", "JLT", "Al Barsha", "Jumeirah", "Discovery Gardens"]),
        between(48, 104), JSON.stringify(allergies), JSON.stringify(conditions), at(-60, 6).toISOString());
      if (i % 9 === 8) continue; // self-pay patients
      const primary = PAYERS[i % PAYERS.length];
      const expired = i === 13;
      db.prepare("INSERT INTO coverages VALUES (?,?,?,?,?,?,?,?,?)").run(uid("cov"), id, primary[0], `${primary[2]}-${between(1000000, 9999999)}`, pick(["Gold", "Silver", "Enhanced", "Essential"]), 1, primary[6],
        "2025-01-01", expired ? iso(addDays(today, -20)) : iso(addDays(today, 300)));
      if (i % 5 === 1 && primary[0] !== "pay_gov") {
        db.prepare("INSERT INTO coverages VALUES (?,?,?,?,?,?,?,?,?)").run(uid("cov"), id, "pay_gov", `NHP-${between(1000000, 9999999)}`, "Supplementary", 2, 100, "2025-01-01", iso(addDays(today, 300)));
      }
    }

    // Opening stock: two or three batches per product with spread expiries
    const prods = db.prepare("SELECT * FROM products").all() as { id: string; max_level: number; reorder_level: number; cost_per_unit: number; preferred_supplier_id: string; location: string }[];
    prods.forEach((p, i) => {
      const lowStock = [7, 20, 33, 44].includes(i);
      const n = lowStock ? 1 : between(2, 3);
      for (let b = 0; b < n; b++) {
        const expiryDays = b === 0 ? (i % 6 === 0 ? between(20, 85) : between(120, 400)) : between(200, 720);
        const qty = lowStock ? Math.max(2, Math.floor(p.reorder_level * 0.4)) : Math.floor(p.max_level * (0.6 + rng() * 0.6));
        stock.receive({ product_id: p.id, supplier_id: p.preferred_supplier_id, batch_no: `${String.fromCharCode(65 + b)}${between(10000, 99999)}`,
          expiry: iso(addDays(today, expiryDays)), qty, unit_cost: p.cost_per_unit, location: p.location }, "u_lina", { type: "opening_balance", id: "ob-1" });
      }
      if (i % 11 === 3) { // an already-expired batch awaiting disposal
        const id = stock.receive({ product_id: p.id, supplier_id: p.preferred_supplier_id, batch_no: `X${between(10000, 99999)}`, expiry: iso(addDays(today, -between(3, 25))),
          qty: between(5, 30), unit_cost: p.cost_per_unit, location: p.location }, "u_lina", { type: "opening_balance", id: "ob-1" });
        db.prepare("UPDATE batches SET status = 'expired' WHERE id = ?").run(id);
      }
    });
  });

  const products = db.prepare("SELECT id, ingredient, drug_class, schedule FROM products").all() as { id: string; ingredient: string; drug_class: string; schedule: string }[];
  const patients = db.prepare("SELECT id, allergies, conditions FROM patients").all() as { id: string; allergies: string; conditions: string }[];
  const prodByIng = (ing: string) => products.find((p) => p.ingredient === ing)!;
  const actors = ["u_amira", "u_omar"];

  function makeRx(when: Date): string | null {
    const pat = pick(patients);
    const conds = JSON.parse(pat.conditions) as string[];
    const allergies = (JSON.parse(pat.allergies) as string[]).map((a) => a.toLowerCase());
    const acute = rng() < 0.45;
    const items: rx.NewRxItem[] = [];
    let dx: [string, string];
    if (acute) {
      const a = pick(ACUTE);
      dx = [a[5], a[6]];
      items.push({ product_id: prodByIng(a[0]).id, dose: a[1], frequency_per_day: a[2], days: a[3], sig: a[4] });
    } else {
      const c = pick(conds);
      dx = DX[c];
      const regs = [...REGIMENS[c]].sort(() => rng() - 0.5).slice(0, between(1, Math.min(3, REGIMENS[c].length)));
      for (const r of regs) items.push({ product_id: prodByIng(r[0]).id, dose: r[1], frequency_per_day: r[2], days: r[3], sig: r[4] });
    }
    // Mostly avoid prescribing against allergies; leave a few for the safety screen to catch
    const filtered = items.filter((it) => {
      const p = products.find((x) => x.id === it.product_id)!;
      const hit = allergies.includes(p.ingredient) || allergies.includes(p.drug_class.toLowerCase());
      return !hit || rng() < 0.15;
    });
    if (!filtered.length) return null;
    setClock(when);
    return rx.createPrescription({
      patient_id: pat.id, doctor_id: pick(DOCTORS)[0], source: pick(["erx", "erx", "erx", "paper", "hospital"]) as "erx",
      priority: rng() < 0.1 ? "urgent" : rng() < 0.03 ? "stat" : "routine", diagnosis_code: dx[0], diagnosis: dx[1], items: filtered,
    }, "system");
  }

  type Stage = "received" | "in_review" | "on_hold" | "verified" | "prepared" | "checked" | "handed_over";
  const realNow = Date.now();
  function advance(rxId: string, start: Date, target: Stage) {
    let t = start.getTime();
    const step = (minutes = 6 + rng() * 22) => { t += minutes * 60_000; setClock(new Date(Math.min(t, realNow - 60_000))); };
    const who = pick(actors);
    if (target === "received") return;
    step(); rx.startReview(rxId, who);
    if (target === "in_review") return;
    if (target === "on_hold") { step(); rx.hold(rxId, pick(["Called prescriber to confirm dose", "Waiting for prescriber to clarify duration", "Patient to confirm current medicines"]), who); return; }
    const alerts = rx.safety(rxId);
    if (alerts.some((a) => a.type === "authorization")) {
      step();
      try {
        const au = rx.requestAuthorization(rxId, who);
        step(40 + rng() * 80); rx.decideAuthorization(au, "payer", rng);
      } catch { /* no coverage */ }
    }
    const majors = rx.safety(rxId).filter((a) => a.severity === "major" && !a.overridden);
    step();
    rx.verify(rxId, majors.map((a) => ({ key: a.key, reason: pick(["Prescriber confirmed by phone; benefits outweigh risk", "Patient tolerated previously; monitoring advised", "Dose confirmed with specialist"]) })), who);
    if (target === "verified") return;
    fill(rxId, step, target, who);
  }

  function fill(rxId: string, step: () => void, target: Stage, who: string) {
    const items = db.prepare("SELECT id, product_id, qty_prescribed, qty_dispensed FROM prescription_items WHERE prescription_id = ?").all(rxId) as { id: string; product_id: string; qty_prescribed: number; qty_dispensed: number }[];
    const lines = items.map((i) => ({ prescription_item_id: i.id, qty: Math.min(i.qty_prescribed - i.qty_dispensed, stock.availableQty(i.product_id)) })).filter((l) => l.qty > 0);
    if (!lines.length) return;
    step();
    const disp = rx.createDispensing(rxId, { items: lines, collection: rng() < 0.15 ? "delivery" : "pickup" }, "u_lina", rng);
    if (target === "prepared") return;
    step(); rx.checkDispensing(disp, who);
    if (target === "checked") return;
    const bill = db.prepare("SELECT id FROM bills WHERE dispensing_id = ?").get(disp) as { id: string };
    const rejected = db.prepare("SELECT c.id FROM claims c JOIN payers p ON p.id = c.payer_id WHERE c.bill_id = ? AND c.status = 'rejected' AND p.workflow = 'pre_adjudication'").all(bill.id) as { id: string }[];
    for (const r of rejected) {
      step(); rcm.submitClaim(r.id, who, "Corrected member details and resubmitted");
      rcm.adjudicate([r.id], who, rng);
    }
    // Secondary real-time claims wait for the primary result
    for (const c of db.prepare("SELECT c.id FROM claims c JOIN payers p ON p.id = c.payer_id WHERE c.bill_id = ? AND c.status = 'draft' AND p.workflow = 'pre_adjudication'").all(bill.id) as { id: string }[]) {
      try { rcm.submitClaim(c.id, who); rcm.adjudicate([c.id], who, rng); } catch { /* leave draft */ }
    }
    step(); rx.handover(disp, { payment_method: pick(["card", "card", "cash", "wallet"]), override_rejected: true }, who);
  }

  /** Weekly delivery: order and receive everything at or below reorder level, then supply owed balances. */
  function weeklyReplenishment(d: number) {
    const sugg = ops.reorderSuggestions();
    const bySup = new Map<string, { product_id: string; qty: number }[]>();
    for (const s of sugg) bySup.set(s.supplier_id, [...(bySup.get(s.supplier_id) ?? []), { product_id: s.product_id, qty: s.suggested }]);
    for (const [sup, items] of bySup) {
      setClock(at(d - 2, 6));
      const po = ops.createPO({ supplier_id: sup, items }, "u_sara");
      ops.advancePO(po, "approve", "u_sara"); ops.advancePO(po, "send", "u_sara");
      setClock(at(d, 5));
      const lines = db.prepare("SELECT id, qty_ordered FROM po_items WHERE po_id = ?").all(po) as { id: string; qty_ordered: number }[];
      ops.receivePO(po, lines.map((l) => ({ po_item_id: l.id, qty: l.qty_ordered, batch_no: `R${between(10000, 99999)}`, expiry: iso(addDays(today, between(240, 700))) })), "u_lina");
    }
    const owed = db.prepare("SELECT id FROM prescriptions WHERE status IN ('verified','partially_dispensed') AND received_at < ?").all(at(d, 0).toISOString()) as { id: string }[];
    let t = at(d, 6).getTime();
    for (const o of owed) {
      try { fill(o.id, () => { t += (5 + rng() * 15) * 60_000; setClock(new Date(t)); }, "handed_over", pick(actors)); } catch { /* still short */ }
    }
  }

  // Replay ~6 weeks of operations
  for (let d = -42; d <= 0; d++) {
    const isToday = d === 0;
    const count = isToday ? 18 : between(5, 9);
    for (let k = 0; k < count; k++) {
      const when = isToday ? new Date(realNow - (count - k) * 24 * 60_000 - between(0, 10) * 60_000) : at(d, 4 + Math.floor((k / count) * 12), between(0, 59));
      const id = makeRx(when);
      if (!id) continue;
      let target: Stage = "handed_over";
      if (isToday) target = (["received", "received", "in_review", "on_hold", "verified", "prepared", "checked", "handed_over", "handed_over", "received", "verified", "prepared", "checked", "handed_over", "in_review", "received", "handed_over", "checked"] as Stage[])[k % 18];
      else if (d === -1 && k < 2) target = "checked";
      try { advance(id, when, target); } catch (e) { if (process.env.SEED_DEBUG) console.log("stopped:", (e as Error).message); }
    }
    // OTC counter sales
    const otc = products.filter((p) => p.schedule === "otc");
    for (let k = 0; k < (isToday ? 9 : between(6, 14)); k++) {
      setClock(isToday ? new Date(realNow - between(5, 400) * 60_000) : at(d, between(4, 17), between(0, 59)));
      try {
        ops.counterSale({ items: Array.from(new Set([pick(otc).id, ...(rng() < 0.4 ? [pick(otc).id] : [])])).map((id) => ({ product_id: id, qty: between(1, 3) })), payment_method: pick(["card", "cash", "wallet"]) }, "u_lina");
      } catch { /* out of stock */ }
    }
    if (d % 7 === 0 && d < -6) weeklyReplenishment(d);
    if (isToday) continue;
    setClock(at(d, 19));
    // Nightly batch: submit yesterday's post-dispense claims
    const drafts = db.prepare(
      `SELECT c.id FROM claims c JOIN payers p ON p.id = c.payer_id JOIN bills b ON b.id = c.bill_id
       WHERE c.status = 'draft' AND p.workflow = 'post_dispense' AND b.status = 'finalized' AND c.created_at < ? ORDER BY c.priority`,
    ).all(at(d, 0).toISOString()) as { id: string }[];
    for (const c of drafts) { try { rcm.submitClaim(c.id, "u_ravi", "Nightly e-claim batch"); } catch { /* secondary waits */ } }
    // Payers respond 3–6 days after submission
    const due = db.prepare("SELECT id FROM claims WHERE status = 'submitted' AND submitted_at < ?").all(addDays(at(d, 0), -between(3, 6)).toISOString()) as { id: string }[];
    if (due.length && d < -1) { setClock(at(d, 20)); rcm.adjudicate(due.map((c) => c.id), "u_ravi", rng); }
    // Billing team resubmits most rejections within a few days
    const rej = db.prepare("SELECT id FROM claims WHERE status = 'rejected' AND adjudicated_at < ? AND submissions < 2 AND denial_code NOT IN ('COV-02','PA-01')").all(addDays(at(d, 0), -2).toISOString()) as { id: string }[];
    for (const c of rej) if (rng() < 0.7) { setClock(at(d, 18)); rcm.submitClaim(c.id, "u_ravi", "Corrected and resubmitted"); }
    // Payment posting against RAs older than ~2 weeks
    const ras = db.prepare("SELECT id, total_approved FROM remittances WHERE status = 'received' AND received_at < ? AND total_approved > 0").all(addDays(at(d, 0), -between(10, 16)).toISOString()) as { id: string; total_approved: number }[];
    for (const ra of ras) {
      setClock(at(d, 17));
      const short = rng() < 0.12;
      rcm.postRemittancePayment(ra.id, { amount: short ? Math.round(ra.total_approved * 0.93 * 100) / 100 : undefined, method: "eft" }, "u_ravi");
    }
  }

  // Purchasing history
  const sugg = ops.reorderSuggestions();
  setClock(at(-20, 10));
  const po1 = ops.createPO({ supplier_id: "sup_gulf", items: [{ product_id: "prd_024", qty: 600 }, { product_id: "prd_033", qty: 240 }] }, "u_sara");
  ops.advancePO(po1, "approve", "u_sara"); ops.advancePO(po1, "send", "u_sara");
  setClock(at(-18, 11));
  const items1 = db.prepare("SELECT id, qty_ordered FROM po_items WHERE po_id = ?").all(po1) as { id: string; qty_ordered: number }[];
  ops.receivePO(po1, items1.map((i, k) => ({ po_item_id: i.id, qty: i.qty_ordered, batch_no: `G${70000 + k}`, expiry: iso(addDays(today, 500)) })), "u_lina");
  setClock(at(-3, 9));
  const po2 = ops.createPO({ supplier_id: "sup_cold", items: [{ product_id: "prd_022", qty: 60 }, { product_id: "prd_023", qty: 20 }] }, "u_sara");
  ops.advancePO(po2, "approve", "u_sara"); ops.advancePO(po2, "send", "u_sara");
  setClock(at(-1, 15));
  const items2 = db.prepare("SELECT id, qty_ordered FROM po_items WHERE po_id = ?").all(po2) as { id: string; qty_ordered: number }[];
  ops.receivePO(po2, [{ po_item_id: items2[0].id, qty: 30, batch_no: "CP88120", expiry: iso(addDays(today, 330)) }], "u_lina");
  setClock(at(0, 8, 30));
  const bySup = new Map<string, { product_id: string; qty: number }[]>();
  for (const s of sugg) bySup.set(s.supplier_id, [...(bySup.get(s.supplier_id) ?? []), { product_id: s.product_id, qty: s.suggested }]);
  const first = [...bySup.entries()][0];
  if (first) { const po3 = ops.createPO({ supplier_id: first[0], items: first[1] }, "u_sara"); ops.advancePO(po3, "approve", "u_sara"); }

  // A recalled batch with traceable patients, and a quarantined one
  setClock(at(-2, 12));
  const traced = db.prepare("SELECT DISTINCT batch_id FROM dispensing_items LIMIT 1").get() as { batch_id: string } | undefined;
  if (traced) {
    const b = db.prepare("SELECT qty_reserved FROM batches WHERE id = ?").get(traced.batch_id) as { qty_reserved: number };
    if (!b.qty_reserved) stock.setBatchStatus(traced.batch_id, "recalled", "u_sara", "Manufacturer recall notice MR-2026-114 (labelling error)");
  }
  const q = db.prepare("SELECT id FROM batches WHERE status = 'available' AND qty_reserved = 0 AND product_id IN (SELECT id FROM products WHERE cold_chain = 1) LIMIT 1").get() as { id: string } | undefined;
  if (q) stock.setBatchStatus(q.id, "quarantined", "u_omar", "Fridge 2 temperature excursion: 9.4 °C for 47 minutes");

  // Customer orders in every state
  const otcIds = products.filter((p) => p.schedule === "otc").map((p) => p.id);
  const customers = db.prepare("SELECT id, name, phone, address FROM patients ORDER BY mrn LIMIT 14").all() as { id: string; name: string; phone: string; address: string }[];
  const plan: [number, string, "pickup" | "delivery"][] = [
    [-4, "completed", "delivery"], [-3, "completed", "pickup"], [-2, "completed", "delivery"], [-2, "cancelled", "delivery"], [-1, "completed", "pickup"],
    [-1, "completed", "delivery"], [0, "out_for_delivery", "delivery"], [0, "ready", "pickup"], [0, "ready", "delivery"], [0, "confirmed", "delivery"],
    [0, "confirmed", "pickup"], [0, "new", "delivery"], [0, "new", "pickup"], [0, "new", "delivery"],
  ];
  plan.forEach(([d, target, fulfilment], i) => {
    let t = d === 0 ? realNow - (plan.length - i) * 17 * 60_000 : at(d, 5 + i).getTime();
    const tick = () => { t = Math.min(t + (8 + rng() * 25) * 60_000, realNow - 60_000); setClock(new Date(t)); };
    setClock(new Date(t));
    const c = customers[i % customers.length];
    const payment = fulfilment === "delivery" ? (rng() < 0.5 ? "prepaid" : "cash_on_delivery") : (rng() < 0.3 ? "prepaid" : "pay_at_counter");
    try {
      const id = orders.createOrder({
        patient_id: c.id, customer_name: c.name, phone: c.phone, channel: pick(["phone", "web", "whatsapp", "web"]) as "web", fulfilment,
        address: fulfilment === "delivery" ? `${between(1, 40)} ${c.address} Street, Dubai` : undefined, payment: payment as "prepaid",
        notes: rng() < 0.3 ? pick(["Ring the bell twice", "Leave with building security", "Call on arrival"]) : undefined,
        items: Array.from(new Set([pick(otcIds), pick(otcIds), ...(rng() < 0.5 ? [pick(otcIds)] : [])])).map((product_id) => ({ product_id, qty: between(1, 3) })),
      }, "u_lina");
      if (target === "new") return;
      if (target === "cancelled") { tick(); orders.cancelOrder(id, "Customer cancelled by phone", "u_lina"); return; }
      tick(); orders.confirmOrder(id, "u_lina");
      if (target === "confirmed") return;
      tick(); orders.markReady(id, "u_lina");
      if (target === "ready") return;
      if (fulfilment === "delivery") { tick(); orders.dispatch(id, pick(["Imran (bike 2)", "Joseph (bike 1)"]), "u_lina"); }
      if (target === "out_for_delivery") return;
      tick(); orders.completeOrder(id, pick(["cash", "card"]), "u_lina");
    } catch { /* stock short: order stays where it stopped */ }
  });

  // A few counter returns in the last week
  const recentOtc = db.prepare(`SELECT b.id, b.created_at FROM bills b WHERE b.kind = 'otc' AND b.status = 'finalized' AND b.created_at >= ? AND b.created_at < ? ORDER BY b.created_at`)
    .all(at(-8, 0).toISOString(), at(-1, 0).toISOString()) as { id: string; created_at: string }[];
  for (const b of recentOtc.filter((_, i) => i % 9 === 4).slice(0, 5)) {
    setClock(new Date(new Date(b.created_at).getTime() + between(2, 30) * 3_600_000));
    const line = db.prepare("SELECT id, qty FROM bill_lines WHERE bill_id = ? LIMIT 1").get(b.id) as { id: string; qty: number };
    try {
      sales.returnSale(b.id, { lines: [{ bill_line_id: line.id, qty: 1 }], reason: pick(["Bought the wrong strength", "Packaging damaged", "Customer changed mind, unopened"]), method: pick(["cash", "card"]) }, "u_lina");
    } catch { /* skip */ }
  }

  // Prior authorizations still waiting on the payer
  const authProducts = ["prd_045", "prd_023", "prd_021", "prd_033"];
  const covered = db.prepare(`SELECT c.patient_id FROM coverages c WHERE c.priority = 1 AND c.valid_to >= ? GROUP BY c.patient_id ORDER BY c.patient_id LIMIT 4`).all(iso(today)) as { patient_id: string }[];
  covered.forEach((c, i) => {
    setClock(new Date(realNow - (90 - i * 20) * 60_000));
    try {
      const id = rx.createPrescription({ patient_id: c.patient_id, doctor_id: DOCTORS[(i + 2) % DOCTORS.length][0], source: "erx", priority: i === 0 ? "urgent" : "routine",
        diagnosis_code: ["M06.9", "E11.9", "E11.9", "I48.91"][i], diagnosis: ["Rheumatoid arthritis", "Type 2 diabetes mellitus", "Type 2 diabetes mellitus", "Atrial fibrillation"][i],
        items: [{ product_id: authProducts[i], dose: 1, frequency_per_day: 1, days: [2, 1, 30, 30][i], qty: [2, 4, 30, 60][i], sig: ["Inject 40 mg every other week", "Inject 1 mg once weekly", "1 tablet each morning", "1 tablet twice daily"][i] }] }, "erx-gateway");
      setClock(new Date(realNow - (80 - i * 20) * 60_000));
      rx.startReview(id, "u_omar");
      rx.requestAuthorization(id, "u_omar", ["Inadequate response to methotrexate for 6 months; DAS28 5.4", "HbA1c 8.9% despite metformin and gliclazide; BMI 34", "HbA1c 8.1% on metformin; eGFR 68", "Non-valvular AF, CHA2DS2-VASc 3; warfarin INR unstable"][i]);
    } catch { /* skip */ }
  });

  setClock(null);
  logHistory("payment", "seed", "SEED", null, "complete", "system", "Demo data loaded");
  db.prepare("DELETE FROM status_history WHERE entity_id = 'seed'").run();
}

export function seedIfEmpty() {
  const n = db.prepare("SELECT COUNT(*) n FROM products").get() as { n: number };
  if (n.n === 0) {
    const t = Date.now();
    seed();
    console.log(`Seeded demo data in ${Date.now() - t} ms`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  if (process.argv.includes("--reset")) resetDb();
  seedIfEmpty();
  const counts = ["prescriptions", "dispensings", "bills", "claims", "remittances", "payments", "batches", "stock_movements", "status_history"]
    .map((t) => `${t}: ${(db.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n}`);
  console.log(counts.join("\n"));
}
