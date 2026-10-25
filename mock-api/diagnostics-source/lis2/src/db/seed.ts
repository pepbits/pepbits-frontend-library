import type { Db } from './database.service';
import { hashPassword } from '../common/crypto';

/**
 * Loads the starting catalogue: organisation, specimen, test catalogue with LOINC,
 * reference ranges, analyzers, interfaces and report template. No patients, orders or results.
 * Everything is editable from the Masters screens.
 */
export function seedMasters(db: Db) {
  const ids: Record<string, Record<string, number>> = {};
  const put = (table: string, key: string, row: Record<string, any>) => {
    const id = db.insert(table, row);
    (ids[table] ||= {})[key] = id;
    return id;
  };
  const id = (table: string, key: string | undefined | null) => (key ? ids[table]?.[key] ?? null : null);

  const settings: [string, string][] = [
    ['lab.name', 'Central Clinical Laboratory'],
    ['lab.address', 'Laboratory Block, Level 2'],
    ['lab.phone', '+1 555 0100'],
    ['lab.accreditation', 'ISO 15189 accredited laboratory'],
    ['lab.hl7_app', 'LIS'],
    ['lab.hl7_facility', 'CCL'],
  ];
  settings.forEach(([k, v]) => db.insert('settings', { key: k, value: v }));

  // Organisation
  const depts: [string, string, number][] = [
    ['HEM', 'Haematology', 1], ['BIO', 'Clinical Biochemistry', 2], ['IMM', 'Immunology & Serology', 3],
    ['MIC', 'Microbiology', 4], ['CP', 'Clinical Pathology', 5], ['MOL', 'Molecular Diagnostics', 6], ['HIS', 'Histopathology & Cytology', 7],
  ];
  depts.forEach(([c, n, s]) => put('m_departments', c, { code: c, name: n, sort_order: s, active: 1 }));
  const subs: [string, string, string][] = [
    ['HEM-RTN', 'Routine Haematology', 'HEM'], ['HEM-COAG', 'Coagulation', 'HEM'],
    ['BIO-GEN', 'General Chemistry', 'BIO'], ['BIO-IA', 'Immunoassay & Endocrinology', 'BIO'], ['BIO-SP', 'Special Chemistry', 'BIO'],
    ['IMM-SER', 'Serology', 'IMM'], ['MIC-BACT', 'Bacteriology', 'MIC'], ['CP-UR', 'Urinalysis', 'CP'],
    ['MOL-PCR', 'PCR', 'MOL'], ['HIS-SURG', 'Surgical Pathology', 'HIS'], ['HIS-CYT', 'Cytology', 'HIS'],
  ];
  subs.forEach(([c, n, d]) => put('m_sub_departments', c, { code: c, name: n, department_id: id('m_departments', d), active: 1 }));
  [['OPD-GEN', 'General OPD', 'OPD'], ['WARD-3A', 'Ward 3A – Medicine', 'WARD'], ['ER', 'Emergency', 'ER'], ['ICU', 'Intensive Care Unit', 'WARD'],
   ['CC-MAIN', 'Main Collection Centre', 'COLLECTION_CENTRE'], ['LAB', 'Main Laboratory', 'LAB']]
    .forEach(([c, n, t]) => put('m_locations', c, { code: c, name: n, type: t, active: 1 }));
  [['DR001', 'Dr. Priya Raman', 'Internal Medicine'], ['DR002', 'Dr. Omar Haddad', 'Emergency Medicine'],
   ['DR003', 'Dr. Laura Chen', 'Endocrinology'], ['DR004', 'Dr. Samuel Okafor', 'General Surgery']]
    .forEach(([c, n, s]) => put('m_doctors', c, { code: c, name: n, specialty: s, active: 1 }));

  const users: [string, string, string, string, string, string][] = [
    ['admin', 'System Administrator', 'ADMIN', 'admin123', '', ''],
    ['drsmith', 'Dr. Anita Smith', 'PATHOLOGIST', 'path123', 'MD, FRCPath', 'Dr. Anita Smith, MD, FRCPath\nConsultant Pathologist'],
    ['tech1', 'Ravi Kumar', 'TECHNOLOGIST', 'tech123', 'BSc MLT', ''],
    ['phleb1', 'Grace Mensah', 'PHLEBOTOMIST', 'phleb123', '', ''],
    ['front1', 'Nadia Farouk', 'FRONT_DESK', 'front123', '', ''],
  ];
  users.forEach(([u, n, r, p, q, s]) => put('users', u, { username: u, full_name: n, role: r, password_hash: hashPassword(p), qualification: q, signature_text: s, active: 1 }));

  // Specimen
  const containers: [string, string, string, string, number][] = [
    ['EDTA', 'EDTA tube', '#8e6bbf', 'K2 EDTA', 3], ['SST', 'Serum separator tube', '#d4a017', 'Clot activator + gel', 5],
    ['CIT', 'Sodium citrate tube', '#7fb3e0', '3.2% sodium citrate', 2.7], ['LIH', 'Lithium heparin tube', '#3a9d5d', 'Lithium heparin', 4],
    ['FLU', 'Fluoride oxalate tube', '#9aa0a6', 'NaF / K oxalate', 2], ['URC', 'Sterile urine container', '#e8c547', 'None', 60],
    ['SWB', 'Viral transport swab', '#e07b39', 'VTM', 3], ['FRM', 'Formalin container', '#cfd8dc', '10% neutral buffered formalin', 60],
  ];
  containers.forEach(([c, n, col, a, v]) => put('m_containers', c, { code: c, name: n, cap_color: col, additive: a, volume_ml: v, active: 1 }));
  const stypes: [string, string, string, string, string, number, string][] = [
    ['WB', 'Whole blood', '258580003', 'EDTA', 'ROOM', 24, 'BLD'], ['SER', 'Serum', '119364003', 'SST', 'REFRIGERATED', 72, 'SER'],
    ['PLC', 'Citrated plasma', '119361006', 'CIT', 'ROOM', 24, 'PLAS'], ['UR', 'Urine', '122575003', 'URC', 'REFRIGERATED', 24, 'UR'],
    ['NPS', 'Nasopharyngeal swab', '258500001', 'SWB', 'REFRIGERATED', 72, 'NASP'], ['TIS', 'Tissue', '119376003', 'FRM', 'ROOM', 720, 'TISS'],
  ];
  stypes.forEach(([c, n, s, cont, st, h, hl7]) => put('m_sample_types', c, { code: c, name: n, snomed_code: s, hl7_code: hl7, container_id: id('m_containers', cont), storage_temp: st, stability_hours: h, active: 1 }));
  [['NP', 'Nasopharynx', '71836000', 0], ['OP', 'Oropharynx', '31389004', 0], ['ARM-L', 'Left arm', '368208006', 0],
   ['ARM-R', 'Right arm', '368209003', 0], ['SKIN', 'Skin', '39937001', 1], ['BREAST', 'Breast', '76752008', 1]]
    .forEach(([c, n, s, l]) => put('m_body_sites', c as string, { code: c, name: n, snomed_code: s, laterality_required: l, active: 1 }));
  [['HEMO', 'Haemolysed', 1], ['CLOT', 'Clotted', 1], ['QNS', 'Quantity not sufficient', 1], ['MISLBL', 'Mislabelled / unlabelled', 1],
   ['WRONGTUBE', 'Wrong container', 1], ['LEAK', 'Leaked in transit', 1], ['DELAY', 'Exceeded stability', 1]]
    .forEach(([c, n, r]) => put('m_rejection_reasons', c as string, { code: c, name: n, requires_recollection: r, active: 1 }));

  // Catalogue basics
  [['FCM', 'Flow cytometry / impedance'], ['PHOT', 'Photometry'], ['ISE', 'Ion selective electrode (indirect)'], ['ENZ', 'Enzymatic'],
   ['CLIA', 'Chemiluminescent immunoassay'], ['HPLC', 'HPLC'], ['CLOT', 'Clotting (optical)'], ['REFL', 'Reflectance photometry (dipstick)'],
   ['MICRO', 'Microscopy'], ['CULT', 'Culture & sensitivity'], ['ITURB', 'Immunoturbidimetry'], ['CALC', 'Calculated'], ['PCR', 'Real-time RT-PCR'],
   ['LCMS', 'LC-MS/MS'], ['HISTO', 'Histology (H&E)']]
    .forEach(([c, n]) => put('m_methodologies', c, { code: c, name: n, active: 1 }));
  [['GDL', 'g/dL', 'g/dL'], ['K_UL', '10³/µL', '10*3/uL'], ['M_UL', '10⁶/µL', '10*6/uL'], ['PCT', '%', '%'], ['FL', 'fL', 'fL'], ['PG', 'pg', 'pg'],
   ['MGDL', 'mg/dL', 'mg/dL'], ['MMOL', 'mmol/L', 'mmol/L'], ['UL', 'U/L', 'U/L'], ['UIUML', 'µIU/mL', 'u[IU]/mL'], ['NGDL', 'ng/dL', 'ng/dL'],
   ['NGML', 'ng/mL', 'ng/mL'], ['SEC', 'sec', 's'], ['RATIO', 'ratio', '{ratio}'], ['MGL', 'mg/L', 'mg/L'], ['NONE', '', '1']]
    .forEach(([c, n, u]) => put('m_units', c, { code: c, name: n, ucum_code: u, active: 1 }));
  [['AFR', 'African ancestry'], ['CAU', 'Caucasian'], ['SAS', 'South Asian'], ['EAS', 'East Asian'], ['HIS', 'Hispanic / Latino'], ['ARB', 'Arab'], ['OTH', 'Other']]
    .forEach(([c, n]) => put('m_ethnicities', c, { code: c, name: n, active: 1 }));

  const loinc: [string, string, string, string, string, string][] = [
    ['58410-2', 'CBC panel', 'Bld', 'Pt', 'Automated count', 'CBC panel - Blood by Automated count'],
    ['718-7', 'Hemoglobin', 'Bld', 'Qn', '', 'Hemoglobin [Mass/volume] in Blood'],
    ['6690-2', 'Leukocytes', 'Bld', 'Qn', 'Automated count', 'Leukocytes [#/volume] in Blood by Automated count'],
    ['789-8', 'Erythrocytes', 'Bld', 'Qn', 'Automated count', 'Erythrocytes [#/volume] in Blood by Automated count'],
    ['4544-3', 'Hematocrit', 'Bld', 'Qn', 'Automated count', 'Hematocrit [Volume Fraction] of Blood by Automated count'],
    ['787-2', 'MCV', 'RBC', 'Qn', 'Automated count', 'MCV [Entitic volume] by Automated count'],
    ['785-6', 'MCH', 'RBC', 'Qn', 'Automated count', 'MCH [Entitic mass] by Automated count'],
    ['786-4', 'MCHC', 'RBC', 'Qn', 'Automated count', 'MCHC [Mass/volume] by Automated count'],
    ['777-3', 'Platelets', 'Bld', 'Qn', 'Automated count', 'Platelets [#/volume] in Blood by Automated count'],
    ['770-8', 'Neutrophils/100 leukocytes', 'Bld', 'Qn', 'Automated count', 'Neutrophils/100 leukocytes in Blood by Automated count'],
    ['736-9', 'Lymphocytes/100 leukocytes', 'Bld', 'Qn', 'Automated count', 'Lymphocytes/100 leukocytes in Blood by Automated count'],
    ['5902-2', 'Prothrombin time', 'PPP', 'Qn', 'Coag', 'Prothrombin time (PT)'],
    ['6301-6', 'INR', 'PPP', 'Qn', 'Coag', 'INR in Platelet poor plasma by Coagulation assay'],
    ['51990-0', 'Basic metabolic panel', 'Bld', 'Pt', '', 'Basic metabolic panel - Blood'],
    ['2345-7', 'Glucose', 'Ser/Plas', 'Qn', '', 'Glucose [Mass/volume] in Serum or Plasma'],
    ['2951-2', 'Sodium', 'Ser/Plas', 'Qn', '', 'Sodium [Moles/volume] in Serum or Plasma'],
    ['2823-3', 'Potassium', 'Ser/Plas', 'Qn', '', 'Potassium [Moles/volume] in Serum or Plasma'],
    ['2075-0', 'Chloride', 'Ser/Plas', 'Qn', '', 'Chloride [Moles/volume] in Serum or Plasma'],
    ['2028-9', 'Carbon dioxide', 'Ser/Plas', 'Qn', '', 'Carbon dioxide, total [Moles/volume] in Serum or Plasma'],
    ['3094-0', 'Urea nitrogen', 'Ser/Plas', 'Qn', '', 'Urea nitrogen [Mass/volume] in Serum or Plasma'],
    ['2160-0', 'Creatinine', 'Ser/Plas', 'Qn', '', 'Creatinine [Mass/volume] in Serum or Plasma'],
    ['17861-6', 'Calcium', 'Ser/Plas', 'Qn', '', 'Calcium [Mass/volume] in Serum or Plasma'],
    ['24325-3', 'Hepatic function panel', 'Ser/Plas', 'Pt', '', 'Hepatic function 2000 panel - Serum or Plasma'],
    ['1742-6', 'Alanine aminotransferase', 'Ser/Plas', 'Qn', '', 'Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma'],
    ['1920-8', 'Aspartate aminotransferase', 'Ser/Plas', 'Qn', '', 'Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma'],
    ['6768-6', 'Alkaline phosphatase', 'Ser/Plas', 'Qn', '', 'Alkaline phosphatase [Enzymatic activity/volume] in Serum or Plasma'],
    ['1975-2', 'Bilirubin.total', 'Ser/Plas', 'Qn', '', 'Bilirubin.total [Mass/volume] in Serum or Plasma'],
    ['1968-7', 'Bilirubin.direct', 'Ser/Plas', 'Qn', '', 'Bilirubin.direct [Mass/volume] in Serum or Plasma'],
    ['2885-2', 'Protein', 'Ser/Plas', 'Qn', '', 'Protein [Mass/volume] in Serum or Plasma'],
    ['1751-7', 'Albumin', 'Ser/Plas', 'Qn', '', 'Albumin [Mass/volume] in Serum or Plasma'],
    ['57698-3', 'Lipid panel', 'Ser/Plas', 'Pt', '', 'Lipid panel with direct LDL - Serum or Plasma'],
    ['2093-3', 'Cholesterol', 'Ser/Plas', 'Qn', '', 'Cholesterol [Mass/volume] in Serum or Plasma'],
    ['2571-8', 'Triglyceride', 'Ser/Plas', 'Qn', '', 'Triglyceride [Mass/volume] in Serum or Plasma'],
    ['2085-9', 'Cholesterol.in HDL', 'Ser/Plas', 'Qn', '', 'Cholesterol in HDL [Mass/volume] in Serum or Plasma'],
    ['13457-7', 'Cholesterol.in LDL', 'Ser/Plas', 'Qn', 'Calculated', 'Cholesterol in LDL [Mass/volume] in Serum or Plasma by calculation'],
    ['3016-3', 'Thyrotropin', 'Ser/Plas', 'Qn', '', 'Thyrotropin [Units/volume] in Serum or Plasma'],
    ['3024-7', 'Thyroxine.free', 'Ser/Plas', 'Qn', '', 'Thyroxine (T4) free [Mass/volume] in Serum or Plasma'],
    ['4548-4', 'Hemoglobin A1c/Hemoglobin.total', 'Bld', 'Qn', '', 'Hemoglobin A1c/Hemoglobin.total in Blood'],
    ['1988-5', 'C reactive protein', 'Ser/Plas', 'Qn', '', 'C reactive protein [Mass/volume] in Serum or Plasma'],
    ['62292-8', '25-Hydroxyvitamin D2+D3', 'Ser/Plas', 'Qn', '', '25-Hydroxyvitamin D2+25-Hydroxyvitamin D3 [Mass/volume] in Serum or Plasma'],
    ['24356-8', 'Urinalysis complete panel', 'Urine', 'Pt', '', 'Urinalysis complete panel - Urine'],
    ['5778-6', 'Color', 'Urine', 'Nom', '', 'Color of Urine'],
    ['5767-9', 'Appearance', 'Urine', 'Nom', '', 'Appearance of Urine'],
    ['5803-2', 'pH', 'Urine', 'Qn', 'Test strip', 'pH of Urine by Test strip'],
    ['5811-5', 'Specific gravity', 'Urine', 'Qn', 'Test strip', 'Specific gravity of Urine by Test strip'],
    ['5804-0', 'Protein', 'Urine', 'Ord', 'Test strip', 'Protein [Mass/volume] in Urine by Test strip'],
    ['5792-7', 'Glucose', 'Urine', 'Ord', 'Test strip', 'Glucose [Mass/volume] in Urine by Test strip'],
    ['630-4', 'Bacteria identified', 'Urine', 'Nom', 'Culture', 'Bacteria identified in Urine by Culture'],
    ['94500-6', 'SARS-CoV-2 RNA', 'Resp', 'Ord', 'NAA+probe', 'SARS-CoV-2 (COVID-19) RNA [Presence] in Respiratory system specimen by NAA with probe detection'],
    ['22634-0', 'Path report.gross observation', 'Specimen', 'Nar', '', 'Pathology report gross observation'],
    ['22635-7', 'Path report.microscopic observation', 'Specimen', 'Nar', '', 'Pathology report microscopic observation'],
    ['22637-3', 'Path report.final diagnosis', 'Specimen', 'Nar', '', 'Pathology report final diagnosis'],
  ];
  loinc.forEach(([n, c, s, sc, m, l]) => put('m_loinc', n, { loinc_num: n, component: c, system: s, scale_type: sc, method_type: m, long_common_name: l }));

  // Parameters: code, name, type, unit, decimals, loinc, method, formula
  const P: [string, string, string, string | null, number, string | null, string | null, string?][] = [
    ['HGB', 'Haemoglobin', 'NUMERIC', 'GDL', 1, '718-7', 'FCM'], ['WBC', 'Total leucocyte count', 'NUMERIC', 'K_UL', 2, '6690-2', 'FCM'],
    ['RBC', 'Red cell count', 'NUMERIC', 'M_UL', 2, '789-8', 'FCM'], ['HCT', 'Haematocrit', 'NUMERIC', 'PCT', 1, '4544-3', 'FCM'],
    ['MCV', 'MCV', 'NUMERIC', 'FL', 1, '787-2', 'CALC'], ['MCH', 'MCH', 'NUMERIC', 'PG', 1, '785-6', 'CALC'],
    ['MCHC', 'MCHC', 'NUMERIC', 'GDL', 1, '786-4', 'CALC'], ['PLT', 'Platelet count', 'NUMERIC', 'K_UL', 0, '777-3', 'FCM'],
    ['NEUT', 'Neutrophils', 'NUMERIC', 'PCT', 1, '770-8', 'FCM'], ['LYMPH', 'Lymphocytes', 'NUMERIC', 'PCT', 1, '736-9', 'FCM'],
    ['PT', 'Prothrombin time', 'NUMERIC', 'SEC', 1, '5902-2', 'CLOT'], ['INR', 'INR', 'NUMERIC', 'RATIO', 2, '6301-6', 'CALC'],
    ['GLU', 'Glucose', 'NUMERIC', 'MGDL', 0, '2345-7', 'ENZ'], ['NA', 'Sodium', 'NUMERIC', 'MMOL', 0, '2951-2', 'ISE'],
    ['K', 'Potassium', 'NUMERIC', 'MMOL', 1, '2823-3', 'ISE'], ['CL', 'Chloride', 'NUMERIC', 'MMOL', 0, '2075-0', 'ISE'],
    ['CO2', 'Bicarbonate (total CO₂)', 'NUMERIC', 'MMOL', 0, '2028-9', 'ENZ'], ['BUN', 'Urea nitrogen', 'NUMERIC', 'MGDL', 0, '3094-0', 'ENZ'],
    ['CREA', 'Creatinine', 'NUMERIC', 'MGDL', 2, '2160-0', 'ENZ'], ['CA', 'Calcium', 'NUMERIC', 'MGDL', 1, '17861-6', 'PHOT'],
    ['ALT', 'ALT (SGPT)', 'NUMERIC', 'UL', 0, '1742-6', 'ENZ'], ['AST', 'AST (SGOT)', 'NUMERIC', 'UL', 0, '1920-8', 'ENZ'],
    ['ALP', 'Alkaline phosphatase', 'NUMERIC', 'UL', 0, '6768-6', 'ENZ'], ['TBIL', 'Bilirubin, total', 'NUMERIC', 'MGDL', 2, '1975-2', 'PHOT'],
    ['DBIL', 'Bilirubin, direct', 'NUMERIC', 'MGDL', 2, '1968-7', 'PHOT'], ['TP', 'Total protein', 'NUMERIC', 'GDL', 1, '2885-2', 'PHOT'],
    ['ALB', 'Albumin', 'NUMERIC', 'GDL', 1, '1751-7', 'PHOT'],
    ['CHOL', 'Total cholesterol', 'NUMERIC', 'MGDL', 0, '2093-3', 'ENZ'], ['TG', 'Triglycerides', 'NUMERIC', 'MGDL', 0, '2571-8', 'ENZ'],
    ['HDL', 'HDL cholesterol', 'NUMERIC', 'MGDL', 0, '2085-9', 'ENZ'], ['LDL', 'LDL cholesterol (Friedewald)', 'CALCULATED', 'MGDL', 0, '13457-7', 'CALC', 'CHOL - HDL - TG/5'],
    ['TSH', 'TSH', 'NUMERIC', 'UIUML', 3, '3016-3', 'CLIA'], ['FT4', 'Free T4', 'NUMERIC', 'NGDL', 2, '3024-7', 'CLIA'],
    ['A1C', 'HbA1c', 'NUMERIC', 'PCT', 1, '4548-4', 'HPLC'], ['CRP', 'C-reactive protein', 'NUMERIC', 'MGL', 1, '1988-5', 'ITURB'],
    ['VITD', '25-OH Vitamin D', 'NUMERIC', 'NGML', 1, '62292-8', 'LCMS'],
    ['UCOL', 'Colour', 'OPTION', null, 0, '5778-6', 'MICRO'], ['UAPP', 'Appearance', 'OPTION', null, 0, '5767-9', 'MICRO'],
    ['UPH', 'pH', 'NUMERIC', 'NONE', 1, '5803-2', 'REFL'], ['USG', 'Specific gravity', 'NUMERIC', 'NONE', 3, '5811-5', 'REFL'],
    ['UPRO', 'Protein', 'OPTION', null, 0, '5804-0', 'REFL'], ['UGLU', 'Glucose', 'OPTION', null, 0, '5792-7', 'REFL'],
    ['ORG', 'Organism isolated', 'TEXT', null, 0, '630-4', 'CULT'], ['CFU', 'Colony count', 'TEXT', null, 0, null, 'CULT'],
    ['AST_PANEL', 'Antibiotic susceptibility', 'MEMO', null, 0, null, 'CULT'],
    ['SCOV2', 'SARS-CoV-2 RNA', 'OPTION', null, 0, '94500-6', 'PCR'],
    ['GROSS', 'Gross description', 'MEMO', null, 0, '22634-0', 'HISTO'], ['MICROD', 'Microscopic description', 'MEMO', null, 0, '22635-7', 'HISTO'],
    ['DIAG', 'Diagnosis', 'MEMO', null, 0, '22637-3', 'HISTO'],
  ];
  P.forEach(([c, n, t, u, d, l, m, formula]) => put('m_parameters', c, {
    code: c, name: n, result_type: t, unit_id: id('m_units', u), decimals: d, loinc_id: id('m_loinc', l), method_id: id('m_methodologies', m),
    formula: formula ?? null, delta_percent: ['HGB', 'PLT', 'K', 'NA', 'CREA', 'GLU'].includes(c) ? 25 : null, delta_hours: 720, autoverify: 1, active: 1,
  }));

  const opts: Record<string, [string, string, number][]> = {
    UCOL: [['PY', 'Pale yellow', 0], ['Y', 'Yellow', 0], ['DY', 'Dark yellow', 0], ['RED', 'Red', 1], ['BRN', 'Brown', 1]],
    UAPP: [['CLR', 'Clear', 0], ['ST', 'Slightly turbid', 1], ['TRB', 'Turbid', 1]],
    UPRO: [['NEG', 'Negative', 0], ['TR', 'Trace', 1], ['1P', '1+', 1], ['2P', '2+', 1], ['3P', '3+', 1]],
    UGLU: [['NEG', 'Negative', 0], ['TR', 'Trace', 1], ['1P', '1+', 1], ['2P', '2+', 1], ['3P', '3+', 1]],
    SCOV2: [['ND', 'Not detected', 0], ['DET', 'Detected', 1], ['INC', 'Inconclusive', 1]],
  };
  Object.entries(opts).forEach(([p, list]) => list.forEach(([c, v, a], i) =>
    db.insert('m_parameter_options', { parameter_id: id('m_parameters', p), code: c, value: v, is_abnormal: a, sort_order: i })));

  // Reference ranges: param, gender, from, to, unit, ethnicity, pregnancy, low, high, critLow, critHigh, display
  type R = [string, string, number, number, string, string | null, string, number | null, number | null, number | null, number | null, string?];
  const R: R[] = [
    ['HGB', 'M', 13, 150, 'YEARS', null, 'ANY', 13.5, 17.5, 7, 20], ['HGB', 'F', 13, 150, 'YEARS', null, 'NO', 12.0, 15.5, 7, 20],
    ['HGB', 'F', 13, 150, 'YEARS', null, 'YES', 11.0, 14.0, 7, 20], ['HGB', 'ANY', 0, 13, 'YEARS', null, 'ANY', 11.0, 14.5, 7, 20],
    ['WBC', 'ANY', 0, 150, 'YEARS', null, 'ANY', 4.0, 11.0, 2.0, 30.0], ['WBC', 'ANY', 0, 150, 'YEARS', 'AFR', 'ANY', 3.0, 10.0, 1.5, 30.0, '3.0 - 10.0 (African ancestry)'],
    ['RBC', 'M', 0, 150, 'YEARS', null, 'ANY', 4.5, 5.9, null, null], ['RBC', 'F', 0, 150, 'YEARS', null, 'ANY', 4.1, 5.1, null, null],
    ['HCT', 'M', 0, 150, 'YEARS', null, 'ANY', 41, 53, 20, 60], ['HCT', 'F', 0, 150, 'YEARS', null, 'ANY', 36, 46, 20, 60],
    ['MCV', 'ANY', 0, 150, 'YEARS', null, 'ANY', 80, 100, null, null], ['MCH', 'ANY', 0, 150, 'YEARS', null, 'ANY', 27, 33, null, null],
    ['MCHC', 'ANY', 0, 150, 'YEARS', null, 'ANY', 32, 36, null, null], ['PLT', 'ANY', 0, 150, 'YEARS', null, 'ANY', 150, 400, 20, 1000],
    ['NEUT', 'ANY', 0, 150, 'YEARS', null, 'ANY', 40, 75, null, null], ['LYMPH', 'ANY', 0, 150, 'YEARS', null, 'ANY', 20, 45, null, null],
    ['PT', 'ANY', 0, 150, 'YEARS', null, 'ANY', 11, 13.5, null, 30], ['INR', 'ANY', 0, 150, 'YEARS', null, 'ANY', 0.8, 1.2, null, 5],
    ['GLU', 'ANY', 0, 150, 'YEARS', null, 'ANY', 70, 99, 40, 450], ['NA', 'ANY', 0, 150, 'YEARS', null, 'ANY', 136, 145, 120, 160],
    ['K', 'ANY', 0, 150, 'YEARS', null, 'ANY', 3.5, 5.1, 2.8, 6.2], ['CL', 'ANY', 0, 150, 'YEARS', null, 'ANY', 98, 107, 80, 120],
    ['CO2', 'ANY', 0, 150, 'YEARS', null, 'ANY', 22, 29, 10, 40], ['BUN', 'ANY', 0, 150, 'YEARS', null, 'ANY', 7, 20, null, 100],
    ['CREA', 'M', 0, 150, 'YEARS', null, 'ANY', 0.74, 1.35, null, 7.5], ['CREA', 'F', 0, 150, 'YEARS', null, 'ANY', 0.59, 1.04, null, 7.5],
    ['CA', 'ANY', 0, 150, 'YEARS', null, 'ANY', 8.6, 10.3, 6, 13],
    ['ALT', 'ANY', 0, 150, 'YEARS', null, 'ANY', 7, 56, null, null], ['AST', 'ANY', 0, 150, 'YEARS', null, 'ANY', 10, 40, null, null],
    ['ALP', 'ANY', 18, 150, 'YEARS', null, 'ANY', 44, 147, null, null], ['ALP', 'ANY', 0, 18, 'YEARS', null, 'ANY', 100, 390, null, null],
    ['TBIL', 'ANY', 0, 30, 'DAYS', null, 'ANY', 0.1, 12, null, 15, 'Neonatal: < 12'], ['TBIL', 'ANY', 1, 150, 'YEARS', null, 'ANY', 0.1, 1.2, null, 15],
    ['DBIL', 'ANY', 0, 150, 'YEARS', null, 'ANY', 0, 0.3, null, null], ['TP', 'ANY', 0, 150, 'YEARS', null, 'ANY', 6.0, 8.3, null, null],
    ['ALB', 'ANY', 0, 150, 'YEARS', null, 'ANY', 3.5, 5.0, null, null],
    ['CHOL', 'ANY', 0, 150, 'YEARS', null, 'ANY', null, 200, null, null, 'Desirable < 200'], ['TG', 'ANY', 0, 150, 'YEARS', null, 'ANY', null, 150, null, 1000, 'Normal < 150'],
    ['HDL', 'M', 0, 150, 'YEARS', null, 'ANY', 40, null, null, null, '> 40'], ['HDL', 'F', 0, 150, 'YEARS', null, 'ANY', 50, null, null, null, '> 50'],
    ['LDL', 'ANY', 0, 150, 'YEARS', null, 'ANY', null, 100, null, null, 'Optimal < 100'],
    ['TSH', 'ANY', 0, 150, 'YEARS', null, 'ANY', 0.4, 4.0, null, null], ['TSH', 'F', 0, 150, 'YEARS', null, 'YES', 0.1, 2.5, null, null, '1st trimester 0.1 - 2.5'],
    ['FT4', 'ANY', 0, 150, 'YEARS', null, 'ANY', 0.8, 1.8, null, null],
    ['A1C', 'ANY', 0, 150, 'YEARS', null, 'ANY', 4.0, 5.6, null, null, 'Normal < 5.7; Prediabetes 5.7-6.4; Diabetes ≥ 6.5'],
    ['CRP', 'ANY', 0, 150, 'YEARS', null, 'ANY', null, 5, null, null, '< 5'], ['VITD', 'ANY', 0, 150, 'YEARS', null, 'ANY', 30, 100, null, null, 'Sufficient 30 - 100'],
    ['UPH', 'ANY', 0, 150, 'YEARS', null, 'ANY', 4.5, 8.0, null, null], ['USG', 'ANY', 0, 150, 'YEARS', null, 'ANY', 1.005, 1.030, null, null],
  ];
  R.forEach(([p, g, a1, a2, au, eth, preg, lo, hi, cl, ch, disp]) => db.insert('m_reference_ranges', {
    parameter_id: id('m_parameters', p), gender: g, age_from: a1, age_to: a2, age_unit: au, ethnicity_id: id('m_ethnicities', eth), pregnancy: preg,
    low: lo, high: hi, critical_low: cl, critical_high: ch, display_text: disp ?? null,
  }));
  [['UPRO', 'Negative'], ['UGLU', 'Negative'], ['SCOV2', 'Not detected']].forEach(([p, t]) =>
    db.insert('m_reference_ranges', { parameter_id: id('m_parameters', p), gender: 'ANY', age_from: 0, age_to: 150, age_unit: 'YEARS', pregnancy: 'ANY', normal_text: t, display_text: t }));

  // Integration
  const ifaces: [string, string, string, string, string, string, string, string, string][] = [
    ['IF-DIIM', 'Data Innovations Instrument Manager', 'MIDDLEWARE', 'HL7V2', 'TCP_MLLP', 'BIDIRECTIONAL', 'PULL', 'IM', 'diim-7c1e2a'],
    ['IF-ARCH', 'ARCHITECT i1000SR direct', 'ANALYZER', 'HL7V2', 'TCP_MLLP', 'BIDIRECTIONAL', 'PULL', 'ARCHITECT', 'arch-44d1b0'],
    ['IF-D10', 'D-10 HbA1c direct', 'ANALYZER', 'ASTM', 'TCP_ASTM', 'BIDIRECTIONAL', 'PULL', 'D10', 'd10-9b3f62'],
    ['IF-CLTK', 'CLINITEK Novus direct', 'ANALYZER', 'ASTM', 'TCP_ASTM', 'BIDIRECTIONAL', 'PULL', 'CLINITEK', 'cltk-5e8a17'],
    ['IF-CGH', 'City General Hospital HIS', 'EXTERNAL_FACILITY', 'HL7V2', 'HTTPS', 'BIDIRECTIONAL', 'PULL', 'CGH_HIS', ''],
    ['IF-SMC', "St. Mary's Clinic EMR (FHIR)", 'EXTERNAL_FACILITY', 'FHIR_R4', 'HTTPS', 'BIDIRECTIONAL', 'PULL', 'SMC_EMR', ''],
    ['IF-REF', 'National Reference Laboratory', 'REFERENCE_LAB', 'HL7V2', 'HTTPS', 'BIDIRECTIONAL', 'PULL', 'NRL', 'nrl-0a6c93'],
    ['IF-HIE', 'Regional Health Information Exchange', 'HIE', 'FHIR_R4', 'HTTPS', 'OUTBOUND', 'PUSH', 'HIE', ''],
  ];
  ifaces.forEach(([c, n, cat, p, t, dir, mode, app, secret]) => put('m_interfaces', c, {
    code: c, name: n, category: cat, protocol: p, transport: t, direction: dir, delivery_mode: mode, sending_app: app,
    sending_facility: c === 'IF-CGH' ? 'CGH' : c === 'IF-SMC' ? 'SMC' : app, auth_type: secret ? 'API_KEY' : 'NONE', auth_secret: secret || null,
    hl7_version: '2.5.1', retry_max: 8, active: c === 'IF-HIE' ? 0 : 1,
  }));
  put('m_middleware', 'DIIM', { code: 'DIIM', name: 'Instrument Manager', vendor: 'Data Innovations', version: '9.x', interface_id: id('m_interfaces', 'IF-DIIM'), active: 1 });
  const an: [string, string, string, string, string, string | null, string | null, string, string][] = [
    ['XN1000', 'Sysmex XN-1000', 'Sysmex', 'HEM', 'HEM-RTN', 'DIIM', null, 'ASTM', 'XN-1000'],
    ['STA', 'Stago STA Compact Max', 'Stago', 'HEM', 'HEM-COAG', 'DIIM', null, 'ASTM', 'STA-CMAX'],
    ['C311', 'Roche cobas c 311', 'Roche', 'BIO', 'BIO-GEN', 'DIIM', null, 'ASTM', 'c311'],
    ['ARCH', 'Abbott ARCHITECT i1000SR', 'Abbott', 'BIO', 'BIO-IA', null, 'IF-ARCH', 'HL7V2', 'ARCHITECT'],
    ['D10', 'Bio-Rad D-10', 'Bio-Rad', 'BIO', 'BIO-SP', null, 'IF-D10', 'ASTM', 'D10'],
    ['CLTK', 'Siemens CLINITEK Novus', 'Siemens', 'CP', 'CP-UR', null, 'IF-CLTK', 'ASTM', 'CLINITEK'],
  ];
  an.forEach(([c, n, m, d, sd, mw, iface, p, inst]) => put('m_analyzers', c, {
    code: c, name: n, manufacturer: m, model: n.replace(m + ' ', ''), department_id: id('m_departments', d), sub_department_id: id('m_sub_departments', sd),
    middleware_id: id('m_middleware', mw), interface_id: id('m_interfaces', iface), protocol: p, bidirectional: 1, query_mode: 'BROADCAST', instrument_id: inst, active: 1,
  }));
  put('m_outsource_labs', 'NRL', { code: 'NRL', name: 'National Reference Laboratory', contact: 'Client services', phone: '+1 555 0199', interface_id: id('m_interfaces', 'IF-REF'), default_tat_hours: 72, active: 1 });

  // Report template
  const tplId = put('m_report_templates', 'STD', {
    code: 'STD', name: 'Standard laboratory report', paper_size: 'A4', font_family: 'IBM Plex Sans, Arial, sans-serif', font_size: 10, accent_color: '#2f3a8f',
    header_html: '<div style="display:flex;justify-content:space-between;align-items:flex-end"><div><div style="font-size:18pt;font-weight:600">{{lab.name}}</div><div>{{lab.address}} · {{lab.phone}}</div></div><div style="text-align:right;font-size:8pt">{{lab.accreditation}}</div></div>',
    footer_html: '<div style="display:flex;justify-content:space-between"><span>Printed {{printed_at}}</span><span>Report {{order.order_no}}</span></div>',
    show_method: 1, show_loinc: 0, show_ref_range: 1, show_flags: 1, highlight_abnormal: 1, show_previous: 1, group_by_department: 0,
    disclaimer: 'Results relate only to the specimen received. Interpret in the clinical context.', is_default: 1, active: 1,
  });
  put('m_report_templates', 'HISTO', {
    code: 'HISTO', name: 'Histopathology narrative report', paper_size: 'A4', font_family: 'Georgia, serif', font_size: 11, accent_color: '#6b2140',
    header_html: '<div style="font-size:16pt;font-weight:600">{{lab.name}} – Department of Histopathology</div><div>{{lab.address}}</div>',
    footer_html: '<div>Report {{order.order_no}} · Printed {{printed_at}}</div>', show_method: 0, show_loinc: 0, show_ref_range: 0, show_flags: 0,
    highlight_abnormal: 0, show_previous: 0, group_by_department: 1, disclaimer: '', is_default: 0, active: 1,
  });

  // Tests: code, name, type, dept, subdept, sample, method, loinc, price, tat, outsourced, params, autoverify, bodySite
  type T = [string, string, string, string, string, string, string, string | null, number, number, boolean, string[], boolean, boolean?];
  const T: T[] = [
    ['CBC', 'Complete blood count', 'PANEL', 'HEM', 'HEM-RTN', 'WB', 'FCM', '58410-2', 25, 120, false, ['HGB', 'WBC', 'RBC', 'HCT', 'MCV', 'MCH', 'MCHC', 'PLT', 'NEUT', 'LYMPH'], true],
    ['PTINR', 'Prothrombin time with INR', 'PANEL', 'HEM', 'HEM-COAG', 'PLC', 'CLOT', '5902-2', 18, 90, false, ['PT', 'INR'], false],
    ['BMP', 'Basic metabolic panel', 'PANEL', 'BIO', 'BIO-GEN', 'SER', 'ENZ', '51990-0', 30, 180, false, ['GLU', 'NA', 'K', 'CL', 'CO2', 'BUN', 'CREA', 'CA'], true],
    ['LFT', 'Liver function test', 'PANEL', 'BIO', 'BIO-GEN', 'SER', 'ENZ', '24325-3', 32, 180, false, ['ALT', 'AST', 'ALP', 'TBIL', 'DBIL', 'TP', 'ALB'], true],
    ['LIPID', 'Lipid profile', 'PANEL', 'BIO', 'BIO-GEN', 'SER', 'ENZ', '57698-3', 28, 240, false, ['CHOL', 'TG', 'HDL', 'LDL'], true],
    ['TSH', 'Thyroid stimulating hormone', 'SINGLE', 'BIO', 'BIO-IA', 'SER', 'CLIA', '3016-3', 22, 240, false, ['TSH'], false],
    ['FT4', 'Free thyroxine', 'SINGLE', 'BIO', 'BIO-IA', 'SER', 'CLIA', '3024-7', 22, 240, false, ['FT4'], false],
    ['HBA1C', 'Glycated haemoglobin', 'SINGLE', 'BIO', 'BIO-SP', 'WB', 'HPLC', '4548-4', 35, 240, false, ['A1C'], true],
    ['CRP', 'C-reactive protein', 'SINGLE', 'BIO', 'BIO-GEN', 'SER', 'ITURB', '1988-5', 20, 120, false, ['CRP'], true],
    ['VITD', '25-OH Vitamin D', 'SINGLE', 'BIO', 'BIO-SP', 'SER', 'LCMS', '62292-8', 60, 4320, true, ['VITD'], false],
    ['URINE', 'Urine routine examination', 'PANEL', 'CP', 'CP-UR', 'UR', 'REFL', '24356-8', 12, 120, false, ['UCOL', 'UAPP', 'UPH', 'USG', 'UPRO', 'UGLU'], true],
    ['UCS', 'Urine culture & sensitivity', 'CULTURE', 'MIC', 'MIC-BACT', 'UR', 'CULT', '630-4', 45, 4320, false, ['ORG', 'CFU', 'AST_PANEL'], false],
    ['COVPCR', 'SARS-CoV-2 RT-PCR', 'SINGLE', 'MOL', 'MOL-PCR', 'NPS', 'PCR', '94500-6', 55, 720, false, ['SCOV2'], false, true],
    ['BIOPSY', 'Biopsy – histopathology', 'HISTOPATHOLOGY', 'HIS', 'HIS-SURG', 'TIS', 'HISTO', null, 120, 7200, false, ['GROSS', 'MICROD', 'DIAG'], false, true],
  ];
  T.forEach(([c, n, t, d, sd, st, m, l, price, tat, out, params, av, bs], i) => {
    const tid = put('m_tests', c, {
      code: c, name: n, test_type: t, department_id: id('m_departments', d), sub_department_id: id('m_sub_departments', sd),
      sample_type_id: id('m_sample_types', st), container_id: db.get('SELECT container_id c FROM m_sample_types WHERE id=?', id('m_sample_types', st))?.c,
      method_id: id('m_methodologies', m), loinc_id: id('m_loinc', l), price, tat_routine_min: tat, tat_urgent_min: Math.round(tat / 2), tat_stat_min: Math.max(45, Math.round(tat / 4)),
      is_outsourced: out ? 1 : 0, outsource_lab_id: out ? id('m_outsource_labs', 'NRL') : null,
      report_template_id: t === 'HISTOPATHOLOGY' ? id('m_report_templates', 'HISTO') : tplId, autoverify: av ? 1 : 0, body_site_required: bs ? 1 : 0, sort_order: i, active: 1,
      patient_preparation: c === 'LIPID' ? '10–12 hours fasting required' : null,
    });
    params.forEach((p, j) => db.insert('m_test_parameters', { test_id: tid, parameter_id: id('m_parameters', p), sort_order: j, mandatory: p === 'AST_PANEL' ? 0 : 1, printable: 1 }));
  });

  // Analyzer ↔ test mapping
  const map = (an: string, test: string, params: string[], orderCode?: string) => params.forEach((p) => db.insert('m_analyzer_mappings', {
    analyzer_id: id('m_analyzers', an), test_id: id('m_tests', test), parameter_id: id('m_parameters', p),
    order_code: orderCode ?? p, result_code: p, conversion_factor: 1, priority: 1, active: 1,
  }));
  map('XN1000', 'CBC', ['HGB', 'WBC', 'RBC', 'HCT', 'MCV', 'MCH', 'MCHC', 'PLT', 'NEUT', 'LYMPH'], 'CBC');
  map('STA', 'PTINR', ['PT', 'INR'], 'PT');
  map('C311', 'BMP', ['GLU', 'NA', 'K', 'CL', 'CO2', 'BUN', 'CREA', 'CA']);
  map('C311', 'LFT', ['ALT', 'AST', 'ALP', 'TBIL', 'DBIL', 'TP', 'ALB']);
  map('C311', 'LIPID', ['CHOL', 'TG', 'HDL']);
  map('C311', 'CRP', ['CRP']);
  map('ARCH', 'TSH', ['TSH']);
  map('ARCH', 'FT4', ['FT4']);
  map('D10', 'HBA1C', ['A1C']);
  map('CLTK', 'URINE', ['UCOL', 'UAPP', 'UPH', 'USG', 'UPRO', 'UGLU'], 'UA');

  // External facilities & code mapping
  put('m_facilities', 'CGH', { code: 'CGH', name: 'City General Hospital', type: 'HOSPITAL', interface_id: id('m_interfaces', 'IF-CGH'), api_key: 'cgh-3f9a1c7e5b', result_delivery: 'PULL', result_format: 'HL7V2', discount_percent: 15, active: 1 });
  put('m_facilities', 'SMC', { code: 'SMC', name: "St. Mary's Clinic", type: 'CLINIC', interface_id: id('m_interfaces', 'IF-SMC'), api_key: 'smc-8d2e6b4a91', result_delivery: 'PULL', result_format: 'FHIR_R4', discount_percent: 10, active: 1 });
  [['CBC01', 'Full blood count', 'CBC'], ['BMP01', 'Renal & electrolytes', 'BMP'], ['LIP01', 'Lipids', 'LIPID'], ['TFT01', 'TSH', 'TSH'], ['A1C01', 'HbA1c', 'HBA1C']]
    .forEach(([e, n, t]) => db.insert('m_test_code_mappings', { facility_id: id('m_facilities', 'CGH'), external_code: e, external_name: n, test_id: id('m_tests', t) }));

  // Reagents
  const rg: [string, string, string, string, number, number, [string, number][]][] = [
    ['R-XNCELL', 'CELLPACK DCL', 'ITM-100231', 'XN1000', 20000, 2000, [['CBC', 1]]],
    ['R-GLU3', 'GLUC3 Glucose HK Gen.3', 'ITM-200114', 'C311', 800, 100, [['BMP', 1]]],
    ['R-CREJ2', 'CREJ2 Creatinine Jaffé Gen.2', 'ITM-200117', 'C311', 700, 100, [['BMP', 1]]],
    ['R-ALTL', 'ALTL ALT acc. to IFCC', 'ITM-200121', 'C311', 500, 80, [['LFT', 1]]],
    ['R-CHOL2', 'CHOL2 Cholesterol Gen.2', 'ITM-200130', 'C311', 400, 80, [['LIPID', 1]]],
    ['R-TSH', 'ARCHITECT TSH Reagent Kit', 'ITM-300045', 'ARCH', 200, 40, [['TSH', 1]]],
    ['R-A1C', 'D-10 Hemoglobin A1c Program', 'ITM-400012', 'D10', 400, 50, [['HBA1C', 1]]],
    ['R-STRIP', 'Multistix urinalysis strips', 'ITM-500020', 'CLTK', 1000, 100, [['URINE', 1]]],
  ];
  rg.forEach(([c, n, item, a, stock, reorder, tests]) => {
    const rid = put('m_reagents', c, { code: c, name: n, item_code: item, analyzer_id: id('m_analyzers', a), uom: 'tests', stock_qty: stock, reorder_level: reorder, storage: 'REFRIGERATED', active: 1 });
    tests.forEach(([t, q]) => db.insert('m_reagent_test_mappings', { reagent_id: rid, test_id: id('m_tests', t), qty_per_test: q }));
  });

  [['HEM-SMEAR', 'HEM', 'Peripheral smear examination advised.'], ['BIO-CORR', 'BIO', 'Kindly correlate clinically.'],
   ['BIO-HEMO', 'BIO', 'Sample haemolysed; potassium and LDH may be falsely elevated.'], ['MIC-NG', 'MIC', 'No growth after 48 hours of aerobic incubation.'],
   ['MIC-CONT', 'MIC', 'Mixed growth of more than 3 organisms; likely contamination. Please repeat with a clean-catch specimen.']]
    .forEach(([c, d, t]) => db.insert('m_comment_templates', { code: c, department_id: id('m_departments', d), text: t }));
}
