
import 'reflect-metadata';
import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { dbOptions } from './database';
import { hashPassword } from './common/auth';
import * as E from './entities';

/**
 * Starter configuration so the lab can operate on day one.
 * Reference ranges are typical adult textbook values and MUST be reviewed and
 * validated by the laboratory director against the lab's own methods before clinical use.
 * Run: npm run seed   (safe to re-run; existing codes are left untouched)
 */
export async function seed(ds: DataSource) {
  const key = () => randomBytes(16).toString('hex');

  async function upsert<T>(entity: new () => T, field: string, rows: Partial<T>[]): Promise<Map<string, any>> {
    const repo = ds.getRepository(entity as any);
    const map = new Map<string, any>();
    for (const r of rows) {
      let row: any = await repo.findOne({ where: { [field]: (r as any)[field] } as any });
      if (!row) row = await repo.save(repo.create(r as any));
      map.set((r as any)[field], row);
    }
    return map;
  }

  await upsert(E.Setting, 'key', [
    { key: 'lab.name', value: 'Clinical Laboratory', description: 'Printed on reports and invoices' },
    { key: 'lab.address', value: 'Street, City, Postcode', description: 'Laboratory address' },
    { key: 'lab.phone', value: '', description: 'Laboratory phone' },
    { key: 'lab.email', value: '', description: 'Laboratory email' },
    { key: 'lab.accreditation', value: '', description: 'Accreditation statement, e.g. ISO 15189' },
    { key: 'billing.currency', value: 'USD', description: 'ISO currency code' },
    { key: 'billing.taxPercent', value: '0', description: 'Tax applied on net of discount' },
    { key: 'billing.requiredBeforeCollection', value: 'false', description: 'true = samples can be drawn only for billed tests' },
  ]);

  const dep = await upsert(E.Department, 'code', [
    { code: 'HEM', name: 'Hematology', sequence: 1 },
    { code: 'BIO', name: 'Clinical Biochemistry', sequence: 2 },
    { code: 'IMM', name: 'Immunology & Endocrinology', sequence: 3 },
    { code: 'CP', name: 'Clinical Pathology', sequence: 4 },
    { code: 'MIC', name: 'Microbiology', sequence: 5 },
  ]);
  const sub = await upsert(E.SubDepartment, 'code', [
    { code: 'HEM-RT', name: 'Routine Hematology', departmentId: dep.get('HEM').id },
    { code: 'HEM-COAG', name: 'Coagulation', departmentId: dep.get('HEM').id },
    { code: 'BIO-RT', name: 'Routine Chemistry', departmentId: dep.get('BIO').id },
    { code: 'IMM-END', name: 'Endocrinology', departmentId: dep.get('IMM').id },
    { code: 'CP-UR', name: 'Urinalysis', departmentId: dep.get('CP').id },
    { code: 'MIC-CUL', name: 'Culture & Sensitivity', departmentId: dep.get('MIC').id },
  ]);
  const st = await upsert(E.SampleType, 'code', [
    { code: 'WB', name: 'Whole blood', snomedCode: '258580003', storageTemperature: '2-8 °C', stabilityHours: 24 },
    { code: 'SER', name: 'Serum', snomedCode: '119364003', storageTemperature: '2-8 °C', stabilityHours: 48 },
    { code: 'PLA', name: 'Plasma', snomedCode: '119361006', storageTemperature: '2-8 °C', stabilityHours: 24 },
    { code: 'URN', name: 'Urine', snomedCode: '122575003', storageTemperature: '2-8 °C', stabilityHours: 4 },
    { code: 'CSF', name: 'Cerebrospinal fluid', snomedCode: '258450006', storageTemperature: 'Room temp', stabilityHours: 1 },
    { code: 'SWAB', name: 'Swab', snomedCode: '257261003', storageTemperature: 'Room temp', stabilityHours: 24 },
  ]);
  const ct = await upsert(E.Container, 'code', [
    { code: 'EDTA', name: 'K2 EDTA tube', capColor: '#7b5ea7', additive: 'K2 EDTA', volumeMl: 3 },
    { code: 'SST', name: 'Serum separator tube', capColor: '#d4a017', additive: 'Clot activator + gel', volumeMl: 5 },
    { code: 'CIT', name: 'Sodium citrate tube', capColor: '#6fa8dc', additive: '3.2% sodium citrate', volumeMl: 2.7 },
    { code: 'FLU', name: 'Fluoride oxalate tube', capColor: '#8e8e93', additive: 'NaF / K oxalate', volumeMl: 2 },
    { code: 'URC', name: 'Sterile urine container', capColor: '#e8c547', additive: 'None', volumeMl: 30 },
    { code: 'SWC', name: 'Swab with transport medium', capColor: '#e06666', additive: 'Amies', volumeMl: null },
  ]);
  await upsert(E.BodySite, 'code', [
    { code: 'LACF', name: 'Left antecubital fossa', laterality: 'Left' },
    { code: 'RACF', name: 'Right antecubital fossa', laterality: 'Right' },
    { code: 'THR', name: 'Throat' },
    { code: 'NPH', name: 'Nasopharynx' },
    { code: 'WND', name: 'Wound' },
  ]);
  const me = await upsert(E.Methodology, 'code', [
    { code: 'IMP', name: 'Impedance / flow cytometry' },
    { code: 'PHO', name: 'Photometry' },
    { code: 'ENZ', name: 'Enzymatic' },
    { code: 'ISE', name: 'Ion selective electrode' },
    { code: 'ECLIA', name: 'Electrochemiluminescence immunoassay' },
    { code: 'HPLC', name: 'HPLC' },
    { code: 'CALC', name: 'Calculated' },
    { code: 'CLOT', name: 'Clotting (optical)' },
    { code: 'STRIP', name: 'Reagent strip / visual' },
  ]);
  const un = await upsert(E.Unit, 'code', [
    { code: 'GDL', symbol: 'g/dL', ucumCode: 'g/dL' },
    { code: 'K_UL', symbol: '10³/µL', ucumCode: '10*3/uL' },
    { code: 'M_UL', symbol: '10⁶/µL', ucumCode: '10*6/uL' },
    { code: 'PCT', symbol: '%', ucumCode: '%' },
    { code: 'FL', symbol: 'fL', ucumCode: 'fL' },
    { code: 'PG', symbol: 'pg', ucumCode: 'pg' },
    { code: 'MGDL', symbol: 'mg/dL', ucumCode: 'mg/dL' },
    { code: 'MMOLL', symbol: 'mmol/L', ucumCode: 'mmol/L' },
    { code: 'UL', symbol: 'U/L', ucumCode: 'U/L' },
    { code: 'MIUL', symbol: 'µIU/mL', ucumCode: 'u[IU]/mL' },
    { code: 'NGML', symbol: 'ng/mL', ucumCode: 'ng/mL' },
    { code: 'SEC', symbol: 'sec', ucumCode: 's' },
    { code: 'RATIO', symbol: '', ucumCode: '{ratio}' },
  ]);
  await upsert(E.Ethnicity, 'code', [
    { code: 'ASIAN', name: 'Asian' }, { code: 'AFRICAN', name: 'Black / African descent' },
    { code: 'WHITE', name: 'White / European descent' }, { code: 'HISPANIC', name: 'Hispanic / Latino' },
    { code: 'MIDEAST', name: 'Middle Eastern / North African' }, { code: 'OTHER', name: 'Other / not stated' },
  ]);

  // code, name, loinc, unit, method, type, decimals, extra
  const P: [string, string, string, string, string, string, number, Partial<E.Parameter>?][] = [
    ['WBC', 'Total leucocyte count', '6690-2', 'K_UL', 'IMP', 'NUMERIC', 2],
    ['RBC', 'Red blood cell count', '789-8', 'M_UL', 'IMP', 'NUMERIC', 2],
    ['HGB', 'Hemoglobin', '718-7', 'GDL', 'IMP', 'NUMERIC', 1],
    ['HCT', 'Hematocrit', '4544-3', 'PCT', 'IMP', 'NUMERIC', 1],
    ['MCV', 'MCV', '787-2', 'FL', 'IMP', 'NUMERIC', 1],
    ['MCH', 'MCH', '785-6', 'PG', 'CALC', 'NUMERIC', 1],
    ['MCHC', 'MCHC', '786-4', 'GDL', 'CALC', 'NUMERIC', 1],
    ['PLT', 'Platelet count', '777-3', 'K_UL', 'IMP', 'NUMERIC', 0],
    ['GLUF', 'Glucose, fasting', '1558-6', 'MGDL', 'ENZ', 'NUMERIC', 0],
    ['CREA', 'Creatinine', '2160-0', 'MGDL', 'ENZ', 'NUMERIC', 2],
    ['BUN', 'Urea nitrogen', '3094-0', 'MGDL', 'ENZ', 'NUMERIC', 1],
    ['NA', 'Sodium', '2951-2', 'MMOLL', 'ISE', 'NUMERIC', 0],
    ['K', 'Potassium', '2823-3', 'MMOLL', 'ISE', 'NUMERIC', 1],
    ['CL', 'Chloride', '2075-0', 'MMOLL', 'ISE', 'NUMERIC', 0],
    ['ALT', 'ALT (SGPT)', '1742-6', 'UL', 'ENZ', 'NUMERIC', 0],
    ['AST', 'AST (SGOT)', '1920-8', 'UL', 'ENZ', 'NUMERIC', 0],
    ['TBIL', 'Bilirubin, total', '1975-2', 'MGDL', 'PHO', 'NUMERIC', 2],
    ['ALB', 'Albumin', '1751-7', 'GDL', 'PHO', 'NUMERIC', 1],
    ['ALP', 'Alkaline phosphatase', '6768-6', 'UL', 'ENZ', 'NUMERIC', 0],
    ['CHOL', 'Cholesterol, total', '2093-3', 'MGDL', 'ENZ', 'NUMERIC', 0],
    ['TG', 'Triglycerides', '2571-8', 'MGDL', 'ENZ', 'NUMERIC', 0],
    ['HDL', 'HDL cholesterol', '2085-9', 'MGDL', 'ENZ', 'NUMERIC', 0],
    ['LDLC', 'LDL cholesterol (calculated)', '13457-7', 'MGDL', 'CALC', 'CALCULATED', 0, { formula: '{CHOL}-{HDL}-({TG}/5)' }],
    ['TSH', 'TSH', '3016-3', 'MIUL', 'ECLIA', 'NUMERIC', 2],
    ['HBA1C', 'HbA1c', '4548-4', 'PCT', 'HPLC', 'NUMERIC', 1],
    ['PT', 'Prothrombin time', '5902-2', 'SEC', 'CLOT', 'NUMERIC', 1],
    ['INR', 'INR', '6301-6', 'RATIO', 'CALC', 'NUMERIC', 2],
    ['VITD', '25-OH Vitamin D (D2+D3)', '62292-8', 'NGML', 'ECLIA', 'NUMERIC', 1],
    ['U-COL', 'Colour', '5778-6', null, 'STRIP', 'OPTION', 0, { options: 'Pale yellow,Yellow,Dark yellow,Amber,Red,Brown', abnormalValues: 'Amber,Red,Brown', defaultValue: 'Pale yellow' }],
    ['U-APP', 'Appearance', '5767-9', null, 'STRIP', 'OPTION', 0, { options: 'Clear,Slightly turbid,Turbid', abnormalValues: 'Turbid', defaultValue: 'Clear' }],
    ['U-PH', 'pH', '5803-2', null, 'STRIP', 'NUMERIC', 1],
    ['U-PRO', 'Protein', '20454-5', null, 'STRIP', 'OPTION', 0, { options: 'Negative,Trace,1+,2+,3+,4+', abnormalValues: 'Trace,1+,2+,3+', criticalValues: '4+', defaultValue: 'Negative' }],
    ['U-GLU', 'Glucose', '25428-4', null, 'STRIP', 'OPTION', 0, { options: 'Negative,Trace,1+,2+,3+,4+', abnormalValues: 'Trace,1+,2+,3+,4+', defaultValue: 'Negative' }],
    ['U-MIC', 'Microscopy remarks', null, null, 'STRIP', 'MEMO', 0],
  ];
  await upsert(E.LoincCode, 'code', P.filter((p) => p[2]).map((p) => ({ code: p[2], component: p[1], longName: p[1] })));
  const par = await upsert(E.Parameter, 'code', P.map(([code, name, loinc, unit, meth, type, dec, extra]) => ({
    code, name, loincCode: loinc, unitId: unit ? un.get(unit).id : null, methodologyId: me.get(meth).id, resultType: type, decimals: dec, ...(extra || {}),
  })));

  const rrRepo = ds.getRepository(E.ReferenceRange);
  if ((await rrRepo.count()) === 0) {
    // parameter, gender, ageMin, ageMax, ageUnit, low, high, critLow, critHigh, extra
    const R: [string, string, number, number, string, number, number, number?, number?, Partial<E.ReferenceRange>?][] = [
      ['HGB', 'ANY', 0, 30, 'DAYS', 14, 24, 10, 25],
      ['HGB', 'ANY', 1, 12, 'YEARS', 11.5, 15.5, 7, 20],
      ['HGB', 'M', 12, 150, 'YEARS', 13, 17, 7, 20],
      ['HGB', 'F', 12, 150, 'YEARS', 12, 15, 7, 20],
      ['HGB', 'F', 12, 60, 'YEARS', 11, 14, 7, 20, { condition: 'PREGNANCY' }],
      ['WBC', 'ANY', 0, 150, 'YEARS', 4, 11, 2, 30],
      ['RBC', 'M', 12, 150, 'YEARS', 4.5, 5.5],
      ['RBC', 'F', 12, 150, 'YEARS', 3.8, 4.8],
      ['HCT', 'M', 12, 150, 'YEARS', 40, 50, 20, 60],
      ['HCT', 'F', 12, 150, 'YEARS', 36, 46, 20, 60],
      ['MCV', 'ANY', 0, 150, 'YEARS', 83, 101],
      ['MCH', 'ANY', 0, 150, 'YEARS', 27, 32],
      ['MCHC', 'ANY', 0, 150, 'YEARS', 31.5, 34.5],
      ['PLT', 'ANY', 0, 150, 'YEARS', 150, 410, 50, 1000],
      ['GLUF', 'ANY', 0, 150, 'YEARS', 70, 99, 40, 450],
      ['CREA', 'M', 18, 150, 'YEARS', 0.7, 1.3, null, 7],
      ['CREA', 'F', 18, 150, 'YEARS', 0.6, 1.1, null, 7],
      ['BUN', 'ANY', 0, 150, 'YEARS', 7, 20, null, 100],
      ['NA', 'ANY', 0, 150, 'YEARS', 136, 145, 120, 160],
      ['K', 'ANY', 0, 150, 'YEARS', 3.5, 5.1, 2.8, 6.2],
      ['CL', 'ANY', 0, 150, 'YEARS', 98, 107, 80, 120],
      ['ALT', 'M', 0, 150, 'YEARS', 0, 41],
      ['ALT', 'F', 0, 150, 'YEARS', 0, 33],
      ['AST', 'ANY', 0, 150, 'YEARS', 0, 40],
      ['TBIL', 'ANY', 0, 150, 'YEARS', 0.3, 1.2, null, 15],
      ['ALB', 'ANY', 0, 150, 'YEARS', 3.5, 5.2],
      ['ALP', 'ANY', 18, 150, 'YEARS', 40, 129],
      ['CHOL', 'ANY', 0, 150, 'YEARS', null, 200, null, null, { displayText: 'Desirable < 200' }],
      ['TG', 'ANY', 0, 150, 'YEARS', null, 150, null, 1000, { displayText: 'Normal < 150' }],
      ['HDL', 'ANY', 0, 150, 'YEARS', 40, null, null, null, { displayText: '> 40' }],
      ['LDLC', 'ANY', 0, 150, 'YEARS', null, 100, null, null, { displayText: 'Optimal < 100' }],
      ['TSH', 'ANY', 18, 150, 'YEARS', 0.27, 4.2, 0.01, 50],
      ['HBA1C', 'ANY', 0, 150, 'YEARS', null, 5.6, null, null, { displayText: 'Normal < 5.7 · Prediabetes 5.7–6.4 · Diabetes ≥ 6.5' }],
      ['PT', 'ANY', 0, 150, 'YEARS', 11, 13.5],
      ['INR', 'ANY', 0, 150, 'YEARS', 0.8, 1.1, null, 5],
      ['VITD', 'ANY', 0, 150, 'YEARS', 30, 100, null, 150, { displayText: 'Deficient < 20 · Insufficient 20–29 · Sufficient 30–100' }],
      ['U-PH', 'ANY', 0, 150, 'YEARS', 5, 8],
    ];
    for (const [code, gender, ageMin, ageMax, ageUnit, lowNormal, highNormal, criticalLow, criticalHigh, extra] of R) {
      await rrRepo.save({ parameterId: par.get(code).id, gender, ageMin, ageMax, ageUnit, lowNormal, highNormal, criticalLow: criticalLow ?? null, criticalHigh: criticalHigh ?? null, ...(extra || {}) });
    }
    for (const code of ['U-COL', 'U-APP', 'U-PRO', 'U-GLU']) {
      await rrRepo.save({ parameterId: par.get(code).id, gender: 'ANY', ageMin: 0, ageMax: 150, ageUnit: 'YEARS', normalText: ({ 'U-COL': 'Pale yellow', 'U-APP': 'Clear' } as any)[code] || 'Negative' });
    }
  }

  const tpl = await upsert(E.ReportTemplate, 'code', [{
    code: 'STD', name: 'Standard A4 report', isDefault: true, accentColor: '#0e5e6f', fontFamily: "'Source Serif 4', Georgia, serif",
    signatureLabel: 'Electronically signed', disclaimer: 'Results relate only to the sample tested. Interpret in the clinical context. This report is electronically verified.',
  }]);

  const ext = await upsert(E.ExternalLab, 'code', [{ code: 'REFLAB', name: 'Reference Laboratory (configure)', inboundApiKey: key(), defaultTatHours: 72 }]);

  // code, name, dept, sub, sampleType, container, method, loinc, price, tatR, tatS, params, extra
  const T: [string, string, string, string, string, string, string, string | null, number, number, number, string[], Partial<E.LabTest>?][] = [
    ['CBC', 'Complete blood count', 'HEM', 'HEM-RT', 'WB', 'EDTA', 'IMP', '58410-2', 25, 120, 30, ['WBC', 'RBC', 'HGB', 'HCT', 'MCV', 'MCH', 'MCHC', 'PLT']],
    ['PTINR', 'Prothrombin time with INR', 'HEM', 'HEM-COAG', 'PLA', 'CIT', 'CLOT', null, 18, 120, 45, ['PT', 'INR']],
    ['GLUF', 'Glucose, fasting', 'BIO', 'BIO-RT', 'PLA', 'FLU', 'ENZ', '1558-6', 8, 120, 30, ['GLUF'], { patientPreparation: 'Fast 8–12 hours; water allowed.' }],
    ['RFT', 'Renal function panel', 'BIO', 'BIO-RT', 'SER', 'SST', 'ENZ', '24362-6', 30, 180, 60, ['CREA', 'BUN', 'NA', 'K', 'CL']],
    ['LFT', 'Liver function panel', 'BIO', 'BIO-RT', 'SER', 'SST', 'ENZ', '24325-3', 32, 180, 60, ['TBIL', 'ALT', 'AST', 'ALP', 'ALB']],
    ['LIPID', 'Lipid profile', 'BIO', 'BIO-RT', 'SER', 'SST', 'ENZ', '24331-1', 28, 240, 90, ['CHOL', 'TG', 'HDL', 'LDLC'], { patientPreparation: 'Fast 10–12 hours.' }],
    ['TSH', 'Thyroid stimulating hormone', 'IMM', 'IMM-END', 'SER', 'SST', 'ECLIA', '3016-3', 20, 360, 120, ['TSH']],
    ['HBA1C', 'Glycated hemoglobin (HbA1c)', 'BIO', 'BIO-RT', 'WB', 'EDTA', 'HPLC', '4548-4', 22, 360, 120, ['HBA1C']],
    ['URINE', 'Urine routine examination', 'CP', 'CP-UR', 'URN', 'URC', 'STRIP', '24356-8', 10, 120, 45, ['U-COL', 'U-APP', 'U-PH', 'U-PRO', 'U-GLU', 'U-MIC']],
    ['VITD', '25-OH Vitamin D', 'IMM', 'IMM-END', 'SER', 'SST', 'ECLIA', '62292-8', 45, 4320, 2880, ['VITD'], { isOutsourced: true, externalLabId: ext.get('REFLAB').id, outsourceCost: 20 }],
  ];
  const tests = await upsert(E.LabTest, 'code', T.map(([code, name, d, s, stc, cc, m, loinc, price, tatRoutineMinutes, tatStatMinutes, , extra], i) => ({
    code, name, departmentId: dep.get(d).id, subDepartmentId: sub.get(s).id, sampleTypeId: st.get(stc).id, containerId: ct.get(cc).id,
    methodologyId: me.get(m).id, loincCode: loinc, price, tatRoutineMinutes, tatStatMinutes, reportTemplateId: tpl.get('STD').id, sequence: i + 1, ...(extra || {}),
  })));
  const tpRepo = ds.getRepository(E.TestParameter);
  for (const [code, , , , , , , , , , , params] of T) {
    const testId = tests.get(code).id;
    if (await tpRepo.countBy({ testId })) continue;
    for (const [i, pc] of params.entries()) {
      await tpRepo.save({ testId, parameterId: par.get(pc).id, sequence: i + 1, isMandatory: pc !== 'U-MIC' });
    }
  }
  await upsert(E.Profile, 'code', [
    { code: 'HEALTH', name: 'Basic health check', price: 99, testIds: ['CBC', 'GLUF', 'RFT', 'LFT', 'LIPID'].map((c) => tests.get(c).id) },
    { code: 'DIAB', name: 'Diabetes monitoring', price: 26, testIds: ['GLUF', 'HBA1C'].map((c) => tests.get(c).id) },
  ]);
  await upsert(E.Doctor, 'code', [{ code: 'SELF', name: 'Self / walk-in' }]);
  await upsert(E.RejectionReason, 'code', [
    { code: 'HEMO', name: 'Hemolyzed' }, { code: 'CLOT', name: 'Clotted' }, { code: 'QNS', name: 'Insufficient volume (QNS)' },
    { code: 'WRONGTUBE', name: 'Wrong container' }, { code: 'LABEL', name: 'Unlabelled or mislabelled' },
    { code: 'LIPE', name: 'Lipemic' }, { code: 'DELAY', name: 'Delayed transport / stability exceeded' },
  ]);

  const mw = await upsert(E.Middleware, 'code', [{
    code: 'MW1', name: 'Instrument middleware', orderMode: 'PULL', messageFormat: 'JSON', inboundApiKey: key(), autoSendOnAccession: true,
  }]);
  const an = await upsert(E.Analyzer, 'code', [
    { code: 'HEM01', name: 'Hematology analyzer 1', departmentId: dep.get('HEM').id, middlewareId: mw.get('MW1').id, protocol: 'ASTM', connectionType: 'TCP' },
    { code: 'CHEM01', name: 'Chemistry analyzer 1', departmentId: dep.get('BIO').id, middlewareId: mw.get('MW1').id, protocol: 'HL7', connectionType: 'TCP' },
    { code: 'IMM01', name: 'Immunoassay analyzer 1', departmentId: dep.get('IMM').id, middlewareId: mw.get('MW1').id, protocol: 'ASTM', connectionType: 'TCP' },
  ]);
  const atm = ds.getRepository(E.AnalyzerTestMapping);
  const apm = ds.getRepository(E.AnalyzerParameterMapping);
  if ((await atm.count()) === 0) {
    const routes: [string, string[]][] = [['HEM01', ['CBC']], ['CHEM01', ['GLUF', 'RFT', 'LFT', 'LIPID']], ['IMM01', ['TSH']]];
    for (const [a, codes] of routes) for (const c of codes) await atm.save({ analyzerId: an.get(a).id, testId: tests.get(c).id, analyzerTestCode: c, priority: 1 });
    const pmap: [string, string[]][] = [
      ['HEM01', ['WBC', 'RBC', 'HGB', 'HCT', 'MCV', 'MCH', 'MCHC', 'PLT']],
      ['CHEM01', ['GLUF', 'CREA', 'BUN', 'NA', 'K', 'CL', 'ALT', 'AST', 'TBIL', 'ALB', 'ALP', 'CHOL', 'TG', 'HDL']],
      ['IMM01', ['TSH']],
    ];
    for (const [a, codes] of pmap) for (const c of codes) await apm.save({ analyzerId: an.get(a).id, parameterId: par.get(c).id, analyzerCode: c, conversionFactor: 1 });
  }
  const sys = await upsert(E.ExternalSystem, 'code', [{ code: 'HIS1', name: 'Hospital information system', systemType: 'HIS', apiKey: key(), resultFormat: 'FHIR', autoPublish: true }]);

}
