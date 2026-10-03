import { all, get, insert, update, run, tx, Row } from './db';
import { createOrder } from './workflow';
import { newMrn } from './ids';
import { generateStudy } from './dicom/generator';
import { ingestDicom } from './dicom/ingest';

const MODALITIES = [
  ['CR', 'Computed Radiography', 'CR_ROOM1', 'X-Ray Room 1', 'Carestream'],
  ['DX', 'Digital Radiography / DEXA', 'DX_ROOM2', 'X-Ray Room 2', 'GE Healthcare'],
  ['CT', 'Computed Tomography', 'CT_SOMATOM', 'CT Suite A', 'Siemens'],
  ['MR', 'Magnetic Resonance', 'MR_3T', 'MRI 3T', 'Philips'],
  ['US', 'Ultrasound', 'US_LOGIQ', 'Ultrasound Bay 1', 'GE Healthcare'],
  ['MG', 'Mammography', 'MG_SENO', 'Breast Imaging', 'Hologic'],
  ['NM', 'Nuclear Medicine', 'NM_SPECT', 'Nuclear Medicine', 'Siemens'],
  ['PT', 'PET/CT', 'PT_BIOGRAPH', 'PET/CT Suite', 'Siemens'],
  ['XA', 'Angiography', 'XA_CATHLAB', 'Cath Lab 1', 'Philips'],
  ['RF', 'Fluoroscopy', 'RF_LUMINOS', 'Fluoro Room', 'Siemens'],
];

// code, name, modality, body part, CPT, price, minutes, contrast, prep
const PROCEDURES: [string, string, string, string, string, number, number, number, string?][] = [
  ['XR-CHEST-2V', 'XR Chest PA and lateral', 'CR', 'CHEST', '71046', 45, 10, 0],
  ['XR-CHEST-1V', 'XR Chest single view', 'CR', 'CHEST', '71045', 35, 5, 0],
  ['XR-ABD', 'XR Abdomen supine', 'CR', 'ABDOMEN', '74018', 40, 10, 0],
  ['XR-KNEE', 'XR Knee 3 views', 'CR', 'KNEE', '73562', 50, 10, 0],
  ['XR-HAND', 'XR Hand 3 views', 'CR', 'HAND', '73130', 45, 10, 0],
  ['XR-WRIST', 'XR Wrist 3 views', 'CR', 'WRIST', '73110', 45, 10, 0],
  ['XR-LSPINE', 'XR Lumbar spine 3 views', 'CR', 'LSPINE', '72100', 60, 15, 0],
  ['XR-PELVIS', 'XR Pelvis AP', 'CR', 'PELVIS', '72170', 45, 10, 0],
  ['XR-SHOULDER', 'XR Shoulder 2 views', 'CR', 'SHOULDER', '73030', 45, 10, 0],
  ['XR-ANKLE', 'XR Ankle 3 views', 'CR', 'ANKLE', '73610', 45, 10, 0],
  ['DX-DEXA', 'DEXA bone densitometry', 'DX', 'SPINE', '77080', 90, 20, 0, 'No calcium supplements 24 hours before'],
  ['CT-HEAD', 'CT Head without contrast', 'CT', 'HEAD', '70450', 250, 15, 0],
  ['CT-CHEST-C', 'CT Chest with contrast', 'CT', 'CHEST', '71260', 380, 20, 1, 'Check creatinine; nil by mouth 4 hours'],
  ['CT-CHEST', 'CT Chest without contrast', 'CT', 'CHEST', '71250', 320, 15, 0],
  ['CT-CAP-C', 'CT Chest, abdomen and pelvis with contrast', 'CT', 'CHEST', '74177', 520, 30, 1, 'Oral contrast 60 min prior; check creatinine'],
  ['CT-CTPA', 'CT Pulmonary angiography', 'CT', 'CHEST', '71275', 450, 20, 1, 'Check creatinine; 18G IV access'],
  ['CT-KUB', 'CT KUB (renal stone protocol)', 'CT', 'ABDOMEN', '74176', 300, 10, 0],
  ['CT-CSPINE', 'CT Cervical spine without contrast', 'CT', 'CSPINE', '72125', 300, 15, 0],
  ['CT-SINUS', 'CT Paranasal sinuses', 'CT', 'HEAD', '70486', 260, 10, 0],
  ['CT-CORONARY', 'CT Coronary angiography', 'CT', 'HEART', '75574', 650, 40, 1, 'Beta-blocker per protocol; no caffeine 12 hours'],
  ['MR-BRAIN', 'MRI Brain without contrast', 'MR', 'BRAIN', '70551', 600, 30, 0, 'MRI safety screening form'],
  ['MR-BRAIN-C', 'MRI Brain with and without contrast', 'MR', 'BRAIN', '70553', 850, 45, 1, 'MRI safety screening; check eGFR'],
  ['MR-LSPINE', 'MRI Lumbar spine without contrast', 'MR', 'LSPINE', '72148', 650, 30, 0, 'MRI safety screening form'],
  ['MR-KNEE', 'MRI Knee without contrast', 'MR', 'KNEE', '73721', 600, 30, 0, 'MRI safety screening form'],
  ['MR-ABD', 'MRI Abdomen with and without contrast', 'MR', 'ABDOMEN', '74183', 900, 45, 1, 'Nil by mouth 4 hours; check eGFR'],
  ['MR-SHOULDER', 'MRI Shoulder without contrast', 'MR', 'SHOULDER', '73221', 600, 30, 0],
  ['MR-PELVIS', 'MRI Pelvis with and without contrast', 'MR', 'PELVIS', '72197', 850, 45, 1],
  ['US-ABD', 'US Abdomen complete', 'US', 'ABDOMEN', '76700', 150, 30, 0, 'Nil by mouth 6 hours'],
  ['US-PELVIS', 'US Pelvis transabdominal', 'US', 'PELVIS', '76856', 140, 30, 0, 'Full bladder: drink 1 L water 1 hour before'],
  ['US-THYROID', 'US Thyroid and neck', 'US', 'NECK', '76536', 130, 20, 0],
  ['US-OB', 'US Obstetric first trimester', 'US', 'PELVIS', '76801', 160, 30, 0],
  ['US-RENAL', 'US Kidneys and bladder', 'US', 'KIDNEY', '76770', 140, 20, 0],
  ['US-BREAST', 'US Breast unilateral', 'US', 'BREAST', '76641', 130, 20, 0],
  ['US-DVT', 'US Doppler lower limb venous', 'US', 'LEG', '93970', 180, 30, 0],
  ['MG-SCREEN', 'Screening mammography bilateral', 'MG', 'BREAST', '77067', 180, 20, 0, 'No deodorant or talc on the day'],
  ['MG-DIAG', 'Diagnostic mammography bilateral', 'MG', 'BREAST', '77066', 220, 30, 0, 'No deodorant or talc on the day'],
  ['NM-BONE', 'NM Whole body bone scan', 'NM', 'WHOLEBODY', '78306', 480, 60, 0, 'Hydrate well; injection 3 hours before imaging'],
  ['NM-THYROID', 'NM Thyroid uptake and scan', 'NM', 'NECK', '78014', 350, 45, 0, 'Stop thyroid medication per protocol'],
  ['PT-WB', 'PET/CT FDG whole body', 'PT', 'WHOLEBODY', '78815', 1500, 90, 0, 'Fast 6 hours; blood glucose < 200 mg/dL'],
  ['XA-CEREBRAL', 'Cerebral angiography', 'XA', 'HEAD', '36224', 2200, 90, 1, 'Consent; coagulation profile; NPO 6 hours'],
  ['XA-CORONARY', 'Coronary angiography', 'XA', 'HEART', '93454', 2400, 60, 1, 'Consent; NPO 6 hours'],
  ['RF-SWALLOW', 'Barium swallow', 'RF', 'ESOPHAGUS', '74220', 220, 30, 1, 'Nil by mouth 6 hours'],
  ['RF-HSG', 'Hysterosalpingography', 'RF', 'PELVIS', '74740', 320, 30, 1, 'Schedule day 7-10 of cycle'],
];

const TEMPLATES: Row[] = [
  { name: 'Chest radiograph - normal', modality_code: 'CR', body_part: 'CHEST', kind: 'NORMAL',
    technique: 'PA and lateral views of the chest.',
    findings: 'Lungs: Clear. No focal consolidation, effusion or pneumothorax.\nHeart: Normal cardiothoracic ratio.\nMediastinum: Normal contour. Trachea central.\nBones and soft tissues: No acute abnormality.',
    impression: 'No acute cardiopulmonary abnormality.' },
  { name: 'Chest radiograph - structured', modality_code: 'CR', body_part: 'CHEST', kind: 'TEMPLATE',
    technique: '___ views of the chest.',
    findings: 'Lines and tubes: ___\nLungs: ___\nPleura: ___\nHeart and mediastinum: ___\nBones: ___',
    impression: '___' },
  { name: 'Extremity radiograph', modality_code: 'CR', body_part: null, kind: 'TEMPLATE',
    technique: '___ views of the ___.',
    findings: 'Alignment: ___\nBones: No fracture or dislocation.\nJoints: Joint spaces preserved.\nSoft tissues: Unremarkable.',
    impression: 'No acute osseous abnormality.' },
  { name: 'CT head - normal', modality_code: 'CT', body_part: 'HEAD', kind: 'NORMAL',
    technique: 'Axial CT images of the head without intravenous contrast.',
    findings: 'Brain parenchyma: Normal grey-white matter differentiation. No intracranial haemorrhage, mass effect or midline shift.\nVentricles: Normal size and configuration.\nExtra-axial spaces: No collection.\nCalvarium: Intact.\nVisualised sinuses and mastoids: Clear.',
    impression: 'No acute intracranial abnormality.' },
  { name: 'CT chest with contrast', modality_code: 'CT', body_part: 'CHEST', kind: 'TEMPLATE',
    technique: 'Contrast-enhanced axial CT of the chest with multiplanar reformats.',
    findings: 'Lungs and airways: ___\nPleura: ___\nMediastinum and hila: ___\nHeart and great vessels: ___\nUpper abdomen: ___\nBones: ___',
    impression: '___' },
  { name: 'CT pulmonary angiogram', modality_code: 'CT', body_part: 'CHEST', kind: 'TEMPLATE',
    technique: 'CT pulmonary angiography with bolus-tracked IV contrast.',
    findings: 'Pulmonary arteries: ___ (no filling defect to the subsegmental level)\nRight heart strain: RV/LV ratio ___\nLungs: ___\nPleura: ___',
    impression: '___' },
  { name: 'CT abdomen and pelvis', modality_code: 'CT', body_part: 'ABDOMEN', kind: 'TEMPLATE',
    technique: 'Axial CT of the abdomen and pelvis after IV contrast in the portal venous phase.',
    findings: 'Liver: ___\nGallbladder and bile ducts: ___\nPancreas: ___\nSpleen: ___\nAdrenals: ___\nKidneys: ___\nBowel: ___\nLymph nodes: ___\nPelvic organs: ___\nBones: ___',
    impression: '___' },
  { name: 'MRI brain', modality_code: 'MR', body_part: 'BRAIN', kind: 'TEMPLATE',
    technique: 'Multiplanar multisequence MRI of the brain including T1, T2, FLAIR, DWI and SWI.',
    findings: 'Brain parenchyma: ___\nDiffusion: No restricted diffusion.\nVentricles and sulci: Age-appropriate.\nPosterior fossa: ___\nVascular flow voids: Preserved.\nOrbits, sinuses, mastoids: ___',
    impression: '___' },
  { name: 'MRI knee', modality_code: 'MR', body_part: 'KNEE', kind: 'TEMPLATE',
    technique: 'Multiplanar MRI of the knee without contrast.',
    findings: 'Menisci: Medial ___ ; Lateral ___\nCruciate ligaments: ACL ___ ; PCL ___\nCollateral ligaments: ___\nExtensor mechanism: ___\nCartilage: ___\nBone marrow: ___\nJoint effusion: ___',
    impression: '___' },
  { name: 'US abdomen - normal', modality_code: 'US', body_part: 'ABDOMEN', kind: 'NORMAL',
    technique: 'Real-time grey-scale and colour Doppler ultrasound of the abdomen.',
    findings: 'Liver: Normal size and echotexture. No focal lesion.\nGallbladder: No calculi or wall thickening.\nCommon bile duct: Normal calibre.\nPancreas: Unremarkable where seen.\nSpleen: Normal size.\nKidneys: Normal size and corticomedullary differentiation. No hydronephrosis.\nAorta: Normal calibre.',
    impression: 'Normal abdominal ultrasound.' },
  { name: 'Thyroid ultrasound (TI-RADS)', modality_code: 'US', body_part: 'NECK', kind: 'TEMPLATE',
    technique: 'High-frequency ultrasound of the thyroid and neck.',
    findings: 'Right lobe: ___ mm\nLeft lobe: ___ mm\nIsthmus: ___ mm\nNodules: ___\nCervical lymph nodes: ___',
    impression: 'ACR TI-RADS ___' },
  { name: 'Mammography (BI-RADS)', modality_code: 'MG', body_part: 'BREAST', kind: 'TEMPLATE',
    technique: 'Bilateral CC and MLO digital mammography.',
    findings: 'Breast composition: ___\nMasses: ___\nCalcifications: ___\nArchitectural distortion: None.\nAsymmetries: ___\nAxillae: ___',
    impression: 'BI-RADS ___' },
  { name: 'Bone scan', modality_code: 'NM', body_part: 'WHOLEBODY', kind: 'TEMPLATE',
    technique: 'Whole-body planar imaging 3 hours after IV Tc-99m MDP.',
    findings: 'Skeletal distribution: ___\nFocal uptake: ___\nRenal excretion: ___',
    impression: '___' },
  { name: 'Macro: no acute intracranial', modality_code: null, body_part: null, kind: 'MACRO', findings: '', impression: 'No acute intracranial abnormality.' },
  { name: 'Macro: clinical correlation', modality_code: null, body_part: null, kind: 'MACRO', findings: '', impression: 'Clinical correlation and follow-up as appropriate.' },
  { name: 'Macro: incidental pulmonary nodule', modality_code: null, body_part: null, kind: 'MACRO', findings: '', impression: 'Incidental pulmonary nodule. Follow-up per Fleischner Society 2017 guidelines.' },
];

const PATIENTS: [string, string, string, string][] = [
  ['Amelia', 'Hughes', '1958-03-12', 'F'], ['Rohan', 'Sharma', '1972-07-25', 'M'], ['Fatima', 'Al-Sayed', '1985-11-02', 'F'],
  ['Kenji', 'Watanabe', '1949-01-19', 'M'], ['Grace', 'Oyelaran', '1990-05-30', 'F'], ['Mateo', 'García', '1967-09-14', 'M'],
  ['Ingrid', 'Johansson', '1979-12-08', 'F'], ['Samuel', 'Mensah', '2001-02-17', 'M'], ['Leila', 'Haddad', '1995-08-21', 'F'],
  ['William', 'Carter', '1953-04-04', 'M'], ['Ananya', 'Iyer', '1988-10-10', 'F'], ['Luca', 'Romano', '1976-06-28', 'M'],
  ['Chloé', 'Dubois', '1964-03-03', 'F'], ['Arjun', 'Reddy', '1982-01-26', 'M'], ['Zanele', 'Dlamini', '1970-09-09', 'F'],
  ['Thomas', 'Becker', '1945-11-11', 'M'], ['Mei', 'Chen', '1999-04-15', 'F'], ['Olumide', 'Adebayo', '1961-07-07', 'M'],
  ['Sara', 'Nilsson', '1987-02-02', 'F'], ['David', 'Levi', '1974-12-19', 'M'], ['Hana', 'Kobayashi', '1993-06-06', 'F'],
  ['Carlos', 'Mendoza', '1956-08-30', 'M'], ['Aisha', 'Khan', '1983-05-12', 'F'], ['Patrick', "O'Neill", '1968-10-31', 'M'],
];

const HISTORIES = [
  'Cough and fever for 5 days, rule out pneumonia', 'Sudden severe headache, rule out haemorrhage', 'Right upper quadrant pain after meals',
  'Fall on outstretched hand, wrist pain', 'Shortness of breath, raised D-dimer', 'Chronic low back pain radiating to left leg',
  'Twisting knee injury playing football', 'Annual screening', 'Palpable thyroid nodule', 'Staging of known lung carcinoma',
  'Left flank pain with haematuria', 'Follow-up of pulmonary nodule', 'Weight loss and night sweats', 'Dizziness and left arm weakness',
];

function daysAgo(d: number, hour = 9, min = 0) {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, min, 0, 0);
  return t;
}
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

export function seed() {
  const port = process.env.PORT || '3000';
  tx(() => {
    for (const [code, name, ae, room, mfr] of MODALITIES)
      insert('modalities', { code, name, ae_title: ae, room, manufacturer: mfr, daily_capacity: code === 'CR' ? 80 : code === 'MR' ? 24 : 40 });
    for (const [code, name, mod, bp, cpt, price, dur, contrast, prep] of PROCEDURES)
      insert('procedures', { code, name, modality_code: mod, body_part: bp, cpt, price, duration_min: dur, contrast, prep });
    for (const t of TEMPLATES) insert('templates', t);
    for (const [priority, mod, minutes] of [['STAT', '*', 60], ['URGENT', '*', 240], ['ROUTINE', '*', 1440], ['ROUTINE', 'MR', 2880], ['ROUTINE', 'MG', 4320], ['STAT', 'CT', 45]] as const)
      insert('tat_rules', { priority, modality_code: mod, target_minutes: minutes });

    const users: Row[] = [
      { username: 'admin', name: 'System Administrator', role: 'ADMIN', title: 'RIS Administrator' },
      { username: 'priya', name: 'Priya Nair', role: 'FRONT_DESK', title: 'Patient Services' },
      { username: 'omar', name: 'Omar Haddad', role: 'BILLING', title: 'Billing Officer' },
      { username: 'ana', name: 'Ana Souza', role: 'TECHNOLOGIST', title: 'Senior CT/MR Technologist', modalities: 'CT,MR,PT,NM' },
      { username: 'james', name: 'James Okafor', role: 'TECHNOLOGIST', title: 'Radiographer', modalities: 'CR,DX,US,MG,RF,XA' },
      { username: 'hpark', name: 'Dr. Helena Park', role: 'RADIOLOGIST', title: 'Consultant Neuroradiologist', license_no: 'MC-20431', signature: 'Helena Park, MD, FRCR' },
      { username: 'rmehta', name: 'Dr. Rahul Mehta', role: 'RADIOLOGIST', title: 'Consultant Body Radiologist', license_no: 'MC-18872', signature: 'Rahul Mehta, MD, DNB' },
      { username: 'slind', name: 'Dr. Sofia Lindqvist', role: 'RADIOLOGIST', title: 'Consultant MSK & Breast Radiologist', license_no: 'MC-22109', signature: 'Sofia Lindqvist, MD, PhD' },
      { username: 'dkim', name: 'Dr. Daniel Kim', role: 'RESIDENT', title: 'Radiology Resident (R3)', license_no: 'RES-5521' },
    ];
    for (const u of users) insert('users', u);

    const refs: Row[] = [
      { code: 'D1001', name: 'Dr. Marcus Bell', specialty: 'Emergency Medicine', facility: 'City General ED', phone: '+1 555 0101' },
      { code: 'D1002', name: 'Dr. Yuki Tanaka', specialty: 'Internal Medicine', facility: 'City General', phone: '+1 555 0102' },
      { code: 'D1003', name: 'Dr. Elena Petrova', specialty: 'Orthopaedics', facility: 'Northside Clinic', phone: '+1 555 0103' },
      { code: 'D1004', name: 'Dr. Kwame Asante', specialty: 'Oncology', facility: 'Cancer Centre', phone: '+1 555 0104' },
      { code: 'D1005', name: 'Dr. Laura Fischer', specialty: 'Family Medicine', facility: 'Riverside Practice', phone: '+1 555 0105' },
      { code: 'D1006', name: 'Dr. Imran Qureshi', specialty: 'Neurology', facility: 'City General', phone: '+1 555 0106' },
    ];
    for (const r of refs) insert('referrers', r);

    PATIENTS.forEach(([first, last, dob, sex], i) =>
      insert('patients', {
        mrn: newMrn(), first_name: first, last_name: last, dob, sex, phone: `+1 555 ${String(2000 + i * 37).padStart(4, '0')}`,
        email: `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, '')}@example.com`, address: `${10 + i * 3} Harbour Street, Springfield`,
        insurance: i % 3 === 0 ? 'Self-pay' : i % 3 === 1 ? 'MediCare Plus' : 'Allied Health Insurance', allergies: i % 7 === 0 ? 'Iodinated contrast (hives)' : null,
      }),
    );

    insert('interfaces', { name: 'HIS order feed', type: 'HL7_MLLP', direction: 'IN', host: '0.0.0.0', port: 2575, events: 'ORM^O01,ADT^A08,ORU^R01', facility: 'CITY_GENERAL' });
    insert('interfaces', { name: 'FHIR ServiceRequest API', type: 'FHIR', direction: 'IN', url: `http://localhost:${port}/api/fhir/ServiceRequest`, events: 'ServiceRequest' });
    insert('interfaces', { name: 'EMR results (MLLP)', type: 'HL7_MLLP', direction: 'OUT', host: '127.0.0.1', port: 2576, events: 'REPORT_PRELIM,REPORT_FINAL,REPORT_CORRECTED', facility: 'CITY_GENERAL' });
    insert('interfaces', { name: 'Teleradiology partner (HTTP)', type: 'HL7_HTTP', direction: 'OUT', url: `http://localhost:${port}/api/integration/echo`, events: 'ORDER_NEW,ORDER_UPDATE,ORDER_CANCEL' });
    insert('interfaces', { name: 'Regional FHIR repository', type: 'FHIR', direction: 'OUT', url: `http://localhost:${port}/api/integration/echo?fhir=1`, events: 'REPORT_FINAL,REPORT_CORRECTED' });
    insert('interfaces', { name: 'Long-term archive PACS', type: 'DICOM', direction: 'OUT', host: '127.0.0.1', port: 11112, ae_title: 'LTA_PACS', events: 'STUDY_ROUTE', active: 0 });
  });

  seedOrders();
}

function seedOrders() {
  const procs = all('SELECT * FROM procedures');
  const byCode = (c: string) => procs.find((p) => p.code === c)!;
  const patients = all('SELECT * FROM patients');
  const refs = all('SELECT id FROM referrers');
  const u = (username: string) => get('SELECT id FROM users WHERE username = ?', username)!.id as number;
  const techFor = (m: string) => (['CT', 'MR', 'PT', 'NM'].includes(m) ? u('ana') : u('james'));
  const radFor = (m: string, bp: string) => (/HEAD|BRAIN|CSPINE|NECK/.test(bp) ? u('hpark') : ['MG', 'CR', 'DX'].includes(m) || /KNEE|SHOULDER|HAND|WRIST|ANKLE/.test(bp) ? u('slind') : u('rmehta'));
  const templates = all('SELECT * FROM templates');
  const templateFor = (m: string, bp: string) =>
    templates.find((t) => t.modality_code === m && t.body_part === bp && t.kind === 'NORMAL') ||
    templates.find((t) => t.modality_code === m && t.body_part === bp) ||
    templates.find((t) => t.modality_code === m);

  // [procedure, days ago, hour, target status, priority, with images]
  const plan: [string, number, number, string, string, boolean][] = [
    // Today: every stage of the workflow
    ['CT-HEAD', 0, 7, 'COMPLETED', 'STAT', true],
    ['CT-CTPA', 0, 7, 'COMPLETED', 'STAT', true],
    ['XR-CHEST-2V', 0, 8, 'COMPLETED', 'URGENT', true],
    ['MR-BRAIN', 0, 8, 'COMPLETED', 'ROUTINE', true],
    ['US-ABD', 0, 8, 'PRELIMINARY', 'ROUTINE', true],
    ['MG-SCREEN', 0, 8, 'COMPLETED', 'ROUTINE', true],
    ['XR-WRIST', 0, 9, 'COMPLETED', 'ROUTINE', true],
    ['CT-CAP-C', 0, 9, 'IN_PROGRESS', 'URGENT', true],
    ['MR-KNEE', 0, 9, 'ARRIVED', 'ROUTINE', false],
    ['US-THYROID', 0, 10, 'ARRIVED', 'ROUTINE', false],
    ['XR-CHEST-1V', 0, 10, 'ARRIVED', 'STAT', false],
    ['CT-KUB', 0, 10, 'SCHEDULED', 'URGENT', false],
    ['MR-LSPINE', 0, 11, 'SCHEDULED', 'ROUTINE', false],
    ['NM-BONE', 0, 11, 'SCHEDULED', 'ROUTINE', false],
    ['US-PELVIS', 0, 12, 'ORDERED', 'ROUTINE', false],
    ['XR-KNEE', 0, 12, 'ORDERED', 'ROUTINE', false],
    ['PT-WB', 0, 13, 'ORDERED', 'ROUTINE', false],
    ['CT-CHEST', 1, 15, 'FINAL', 'ROUTINE', true],
    ['XR-HAND', 1, 11, 'FINAL', 'ROUTINE', true],
    ['MR-BRAIN-C', 1, 10, 'FINAL', 'URGENT', true],
    ['US-RENAL', 1, 9, 'FINAL', 'ROUTINE', true],
    ['CT-HEAD', 2, 22, 'FINAL', 'STAT', true],
    ['XR-CHEST-2V', 2, 10, 'FINAL', 'ROUTINE', true],
  ];
  // Historical volume for analytics (no images kept locally)
  const hist = ['XR-CHEST-2V', 'CT-HEAD', 'US-ABD', 'MR-LSPINE', 'CT-CAP-C', 'XR-KNEE', 'MG-SCREEN', 'US-PELVIS', 'MR-KNEE', 'CT-CTPA', 'XR-ANKLE', 'US-DVT', 'DX-DEXA', 'MR-BRAIN'];
  for (let d = 3; d <= 13; d++) {
    const n = 3 + ((d * 7) % 4);
    for (let k = 0; k < n; k++) plan.push([hist[(d * 3 + k) % hist.length], d, 8 + ((k * 3) % 9), k === 0 && d === 5 ? 'CANCELLED' : 'FINAL', k % 5 === 0 ? 'STAT' : k % 3 === 0 ? 'URGENT' : 'ROUTINE', false]);
  }

  plan.forEach(([code, ago, hour, status, priority, withImages], idx) => {
    const proc = byCode(code);
    const patient = patients[idx % patients.length];
    const ordered = daysAgo(ago, hour, (idx * 7) % 50);
    const orderId = createOrder({
      patient_id: patient.id, procedure_id: proc.id, priority, clinical_history: HISTORIES[idx % HISTORIES.length],
      referrer_id: refs[idx % refs.length].id, ordered_at: ordered.toISOString(), placer_order_no: `HIS${100200 + idx}`,
      source: idx % 4 === 0 ? 'HL7' : 'RIS', source_system: idx % 4 === 0 ? 'CITY_GENERAL_HIS' : null,
      payer: patient.insurance === 'Self-pay' ? 'SELF' : 'INSURANCE',
    }, { id: u('priya'), name: 'Priya Nair' } as any, { silent: true });

    const speed = priority === 'STAT' ? 0.15 : priority === 'URGENT' ? 0.5 : 1;
    const t: Row = {};
    const order = ['ORDERED', 'SCHEDULED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'PRELIMINARY', 'FINAL'];
    const reach = (s: string) => order.indexOf(status) >= order.indexOf(s);
    if (status === 'CANCELLED') {
      update('orders', orderId, { status, cancelled_at: addMin(ordered, 30).toISOString(), cancel_reason: 'Patient did not attend' });
      run("UPDATE invoices SET status = 'CANCELLED' WHERE order_id = ?", orderId);
      return;
    }
    if (reach('SCHEDULED')) t.scheduled_at = addMin(ordered, 60 * speed).toISOString();
    if (reach('ARRIVED')) t.arrived_at = addMin(ordered, 50 * speed).toISOString();
    if (reach('IN_PROGRESS')) { t.exam_started_at = addMin(ordered, 70 * speed).toISOString(); t.technologist_id = techFor(proc.modality_code); }
    if (reach('COMPLETED')) {
      t.exam_completed_at = addMin(ordered, (70 + proc.duration_min) * speed).toISOString();
      t.contrast_used = proc.contrast ? 'Iohexol 350, 80 mL IV' : null;
      if (proc.modality_code === 'CT') { t.dose_ctdivol = 12 + (idx % 9); t.dose_dlp = 380 + idx * 11; }
    }
    const tatMin = priority === 'STAT' ? 25 + (idx % 50) : priority === 'URGENT' ? 90 + (idx % 5) * 50 : 300 + (idx % 7) * 240;
    if (reach('PRELIMINARY')) t.prelim_at = addMin(new Date(t.exam_completed_at), tatMin * 0.6).toISOString();
    if (reach('FINAL')) t.final_at = addMin(new Date(t.exam_completed_at), tatMin).toISOString();
    if (t.final_at && new Date(t.final_at) > new Date()) t.final_at = new Date().toISOString();
    if (t.prelim_at && new Date(t.prelim_at) > new Date()) t.prelim_at = new Date().toISOString();
    if (reach('PRELIMINARY')) t.radiologist_id = radFor(proc.modality_code, proc.body_part);
    update('orders', orderId, { status, ...t });

    const o = get('SELECT * FROM orders WHERE id = ?', orderId)!;
    if (reach('ARRIVED') && ago > 0) {
      const inv = get('SELECT * FROM invoices WHERE order_id = ?', orderId)!;
      insert('payments', { invoice_id: inv.id, amount: inv.net, mode: patient.insurance === 'Self-pay' ? 'CARD' : 'INSURANCE', received_by: u('omar'), received_at: t.arrived_at });
      update('invoices', inv.id, { paid: inv.net, status: 'PAID' });
    }

    if (withImages) {
      const { files } = generateStudy({
        modality: proc.modality_code, bodyPart: proc.body_part, description: proc.name, accession: o.accession,
        patientId: patient.mrn, patientName: `${patient.last_name.toUpperCase()}^${patient.first_name.toUpperCase()}`,
        patientDob: patient.dob, patientSex: patient.sex, when: new Date(o.exam_started_at || ordered),
        stationAe: get('SELECT ae_title FROM modalities WHERE code = ?', proc.modality_code)?.ae_title,
      });
      for (const f of files) ingestDicom(f.buffer, get('SELECT ae_title FROM modalities WHERE code = ?', proc.modality_code)?.ae_title || 'MODALITY');
      update('orders', orderId, { status, ...t }); // ingest may have nudged the status
    }

    if (reach('PRELIMINARY')) {
      const tpl = templateFor(proc.modality_code, proc.body_part);
      const isStatHead = code === 'CT-HEAD' && ago === 2;
      const findings = isStatHead
        ? 'There is an acute 14 mm intraparenchymal haemorrhage in the right basal ganglia with surrounding oedema. 3 mm leftward midline shift. No intraventricular extension. Ventricles otherwise normal in size.'
        : (tpl?.findings || 'No significant abnormality.').replace(/___/g, 'Unremarkable');
      const impression = isStatHead
        ? 'Acute right basal ganglia intraparenchymal haemorrhage with mild mass effect. Critical result communicated.'
        : (tpl?.impression || 'No acute abnormality.').replace(/___/g, 'No significant abnormality');
      const final = status === 'FINAL';
      const rid = insert('reports', {
        order_id: orderId, status: final ? 'FINAL' : 'PRELIMINARY', report_type: tpl ? 'TEMPLATE' : 'FREE', template_id: tpl?.id,
        technique: tpl?.technique?.replace(/___/g, 'Standard'), comparison: 'None available.', findings, impression,
        critical: isStatHead ? 1 : 0, critical_category: isStatHead ? 'Intracranial haemorrhage' : null,
        author_id: o.radiologist_id, prelim_by: status === 'PRELIMINARY' ? u('dkim') : o.radiologist_id, prelim_at: o.prelim_at,
        signed_by: final ? o.radiologist_id : null, signed_at: final ? o.final_at : null, updated_at: o.final_at || o.prelim_at,
      });
      insert('report_versions', { report_id: rid, version: 1, status: final ? 'FINAL' : 'PRELIMINARY', technique: tpl?.technique, findings, impression, reason: final ? 'Final signed' : 'Preliminary signed', changed_by: o.radiologist_id, changed_at: o.final_at || o.prelim_at });
      if (isStatHead) {
        insert('critical_results', {
          order_id: orderId, report_id: rid, category: 'Intracranial haemorrhage', severity: 'RED', finding: impression, status: 'ACKNOWLEDGED',
          flagged_by: o.radiologist_id, flagged_at: o.final_at, communicated_to: 'Dr. Marcus Bell (ED)', method: 'PHONE', readback: 1,
          communicated_by: o.radiologist_id, communicated_at: addMin(new Date(o.final_at), 6).toISOString(), acknowledged_at: addMin(new Date(o.final_at), 9).toISOString(),
        });
      }
      if (code === 'XR-HAND' && final) {
        insert('addenda', { report_id: rid, text: 'On review of the oblique view, there is a subtle non-displaced fracture of the base of the 5th metacarpal. Referring clinician informed.', author_id: o.radiologist_id, signed_at: addMin(new Date(o.final_at), 120).toISOString() });
      }
    }
  });

  // One open critical result for today's CTPA, waiting to be communicated
  const ctpa = get("SELECT o.id FROM orders o JOIN procedures p ON p.id = o.procedure_id WHERE p.code = 'CT-CTPA' AND o.status = 'COMPLETED' LIMIT 1");
  if (ctpa) {
    insert('critical_results', { order_id: ctpa.id, category: 'Pulmonary embolism', severity: 'RED', finding: 'Filling defects in right lower lobe segmental arteries (technologist alert, pending radiologist read).', status: 'OPEN', flagged_by: u('ana'), flagged_at: new Date().toISOString() });
  }
}
