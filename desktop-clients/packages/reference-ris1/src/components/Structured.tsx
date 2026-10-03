'use client';
import {DiagnosticButton,DiagnosticInput,DiagnosticSelect} from '@pepbits/reference-diagnostics';
/**
 * Structured reporting assistants. Each calculator turns point-and-click observations into a
 * category and standard wording that the radiologist inserts into the report and can edit.
 * Categories follow ACR TI-RADS (2017), BI-RADS 5th ed., Lung-RADS v2022, PI-RADS v2.1 and
 * LI-RADS v2018 (CT/MRI) in simplified form; the radiologist remains responsible for the final category.
 */
import { useMemo, useState } from 'react';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export type StructuredResult = { system: string; category: string; findings: string; impression: string; data: Record<string, unknown> };

const Opt = ({ label, value, onChange, options }: { label: string; value: any; onChange: (v: any) => void; options: [any, string][] }) => (
  <label className="block">
    <span className="label">{label}</span>
    <DiagnosticSelect className="field" value={value} onChange={(e) => onChange(isNaN(Number(e.target.value)) || e.target.value === '' ? e.target.value : Number(e.target.value))}>
      {options.map(([v, l]) => <option key={String(v)} value={v}>{l}</option>)}
    </DiagnosticSelect>
  </label>
);
const Num = ({ label, value, onChange, unit = 'mm' }: { label: string; value: number; onChange: (v: number) => void; unit?: string }) => (
  <label className="block">
    <span className="label">{label} ({unit})</span>
    <DiagnosticInput type="number" min={0} step="0.1" className="field" value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </label>
);

// ---------------------------------------------------------------- TI-RADS
function TiRads({ onResult }: { onResult: (r: StructuredResult) => void }) {
 const referenceT = useReferenceLocalization().t;

  const [s, set] = useState({ side: 'right', pole: 'mid', size: 15, comp: 2, echo: 2, shape: 0, margin: 0, foci: [] as number[] });
  const points = s.comp + s.echo + s.shape + s.margin + s.foci.reduce((a, b) => a + b, 0);
  const tr = points <= 1 ? 1 : points === 2 ? 2 : points === 3 ? 3 : points <= 6 ? 4 : 5;
  const rule: Record<number, [number | null, number | null]> = { 1: [null, null], 2: [null, null], 3: [25, 15], 4: [15, 10], 5: [10, 5] };
  const [fna, fu] = rule[tr];
  const schedule: Record<number, string> = { 3: 'at 1, 3 and 5 years', 4: 'at 1, 2, 3 and 5 years', 5: 'annually for up to 5 years' };
  const rec = fna && s.size >= fna ? 'Fine needle aspiration is recommended.' : fu && s.size >= fu ? `Follow-up ultrasound is recommended ${schedule[tr]}.` : 'No FNA or follow-up is required for this nodule.';
  const label = ['', 'TR1 Benign', 'TR2 Not suspicious', 'TR3 Mildly suspicious', 'TR4 Moderately suspicious', 'TR5 Highly suspicious'][tr];
  const toggle = (v: number) => set({ ...s, foci: s.foci.includes(v) ? s.foci.filter((x) => x !== v) : [...s.foci.filter((x) => x !== 0), v] });
  const compL = { 0: 'cystic or spongiform', 1: 'mixed cystic and solid', 2: 'solid or almost completely solid' } as any;
  const echoL = { 0: 'anechoic', 1: 'hyperechoic or isoechoic', 2: 'hypoechoic', 3: 'very hypoechoic' } as any;
  const marginL = { 0: 'smooth or ill-defined', 2: 'lobulated or irregular', 3: 'showing extrathyroidal extension' } as any;
  const fociL = { 1: 'macrocalcifications', 2: 'peripheral rim calcification', 3: 'punctate echogenic foci' } as any;
  const findings = `${s.size} mm ${compL[s.comp]}, ${echoL[s.echo]} nodule in the ${s.pole} ${s.side} thyroid lobe, ${s.shape ? 'taller-than-wide' : 'wider-than-tall'}, margins ${marginL[s.margin]}${s.foci.length ? `, with ${s.foci.map((f) => fociL[f]).join(' and ')}` : ', with no echogenic foci'}. ACR TI-RADS points: ${points}.`;
  return (
    <Shell category={label} tone={tr >= 4 ? 'stat' : tr === 3 ? 'urgent' : 'ok'} detail={`${points} points · ${rec}`}
      onInsert={() => onResult({ system: 'ACR TI-RADS', category: `TR${tr}`, findings, impression: `${s.side[0].toUpperCase() + s.side.slice(1)} thyroid nodule, ACR TI-RADS ${label} (${points} points). ${rec}`, data: { ...s, points } })}>
      <Opt label={referenceT("Side")} value={s.side} onChange={(v) => set({ ...s, side: v })} options={[['right', 'Right lobe'], ['left', 'Left lobe'], ['isthmus', 'Isthmus']]} />
      <Opt label={referenceT("Level")} value={s.pole} onChange={(v) => set({ ...s, pole: v })} options={[['upper', 'Upper pole'], ['mid', 'Mid'], ['lower', 'Lower pole']]} />
      <Num label={referenceT("Maximum diameter")} value={s.size} onChange={(v) => set({ ...s, size: v })} />
      <Opt label={referenceT("Composition")} value={s.comp} onChange={(v) => set({ ...s, comp: v })} options={[[0, 'Cystic / spongiform (0)'], [1, 'Mixed cystic and solid (1)'], [2, 'Solid (2)']]} />
      <Opt label={referenceT("Echogenicity")} value={s.echo} onChange={(v) => set({ ...s, echo: v })} options={[[0, 'Anechoic (0)'], [1, 'Hyper / isoechoic (1)'], [2, 'Hypoechoic (2)'], [3, 'Very hypoechoic (3)']]} />
      <Opt label={referenceT("Shape")} value={s.shape} onChange={(v) => set({ ...s, shape: v })} options={[[0, 'Wider-than-tall (0)'], [3, 'Taller-than-wide (3)']]} />
      <Opt label={referenceT("Margin")} value={s.margin} onChange={(v) => set({ ...s, margin: v })} options={[[0, 'Smooth / ill-defined (0)'], [2, 'Lobulated / irregular (2)'], [3, 'Extrathyroidal extension (3)']]} />
      <div className="col-span-2">
        <span className="label"><ReferenceText message="Echogenic foci" /></span>
        <div className="flex flex-wrap gap-3 text-sm">
          {[[1, 'Macrocalcifications (1)'], [2, 'Peripheral rim (2)'], [3, 'Punctate (3)']].map(([v, l]) => (
            <label key={v} className="flex items-center gap-1.5"><DiagnosticInput type="checkbox" className="accent-petrol" checked={s.foci.includes(v as number)} onChange={() => toggle(v as number)} />{l}</label>
          ))}
        </div>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------- BI-RADS
const BIRADS: Record<string, [string, string]> = {
  '0': ['Incomplete', 'Additional imaging evaluation and/or prior mammograms for comparison are needed.'],
  '1': ['Negative', 'Routine screening mammography is recommended.'],
  '2': ['Benign', 'Routine screening mammography is recommended.'],
  '3': ['Probably benign', 'Short-interval (6-month) follow-up is recommended.'],
  '4A': ['Low suspicion for malignancy', 'Tissue diagnosis is recommended.'],
  '4B': ['Moderate suspicion for malignancy', 'Tissue diagnosis is recommended.'],
  '4C': ['High suspicion for malignancy', 'Tissue diagnosis is recommended.'],
  '5': ['Highly suggestive of malignancy', 'Tissue diagnosis and appropriate action are recommended.'],
  '6': ['Known biopsy-proven malignancy', 'Surgical excision when clinically appropriate.'],
};
function BiRads({ onResult }: { onResult: (r: StructuredResult) => void }) {
 const referenceT = useReferenceLocalization().t;

  const [s, set] = useState({ density: 'b', finding: 'none', side: 'right', clock: 10, depth: 'middle', size: 8, cat: '1' });
  const densL = { a: 'almost entirely fatty', b: 'scattered areas of fibroglandular density', c: 'heterogeneously dense, which may obscure small masses', d: 'extremely dense, which lowers the sensitivity of mammography' } as any;
  const findL = { mass: 'mass', calc: 'group of calcifications', asym: 'focal asymmetry', distortion: 'area of architectural distortion' } as any;
  const [label, rec] = BIRADS[s.cat];
  const findingText = s.finding === 'none' ? 'There is no suspicious mass, calcification group or architectural distortion.' : `There is a ${s.size} mm ${findL[s.finding]} in the ${s.side} breast at ${s.clock} o'clock, ${s.depth} depth.`;
  const findings = `The breasts are ${densL[s.density]} (ACR density ${s.density.toUpperCase()}). ${findingText}`;
  return (
    <Shell category={`BI-RADS ${s.cat}: ${label}`} tone={['4A', '4B', '4C', '5', '6'].includes(s.cat) ? 'stat' : s.cat === '3' || s.cat === '0' ? 'urgent' : 'ok'} detail={rec}
      onInsert={() => onResult({ system: 'BI-RADS', category: s.cat, findings, impression: `BI-RADS ${s.cat}: ${label}. ${rec}`, data: s })}>
      <Opt label={referenceT("Breast density")} value={s.density} onChange={(v) => set({ ...s, density: v })} options={[['a', 'A · Almost entirely fatty'], ['b', 'B · Scattered fibroglandular'], ['c', 'C · Heterogeneously dense'], ['d', 'D · Extremely dense']]} />
      <Opt label={referenceT("Principal finding")} value={s.finding} onChange={(v) => set({ ...s, finding: v })} options={[['none', 'None'], ['mass', 'Mass'], ['calc', 'Calcifications'], ['asym', 'Asymmetry'], ['distortion', 'Architectural distortion']]} />
      {s.finding !== 'none' && <>
        <Opt label={referenceT("Side")} value={s.side} onChange={(v) => set({ ...s, side: v })} options={[['right', 'Right'], ['left', 'Left']]} />
        <Opt label={referenceT("Clock position")} value={s.clock} onChange={(v) => set({ ...s, clock: v })} options={Array.from({ length: 12 }, (_, i) => [i + 1, `${i + 1} o'clock`]) as any} />
        <Opt label={referenceT("Depth")} value={s.depth} onChange={(v) => set({ ...s, depth: v })} options={[['anterior', 'Anterior'], ['middle', 'Middle'], ['posterior', 'Posterior']]} />
        <Num label={referenceT("Size")} value={s.size} onChange={(v) => set({ ...s, size: v })} />
      </>}
      <Opt label={referenceT("Assessment category")} value={s.cat} onChange={(v) => set({ ...s, cat: String(v) })} options={Object.entries(BIRADS).map(([k, [l]]) => [k, `${k} · ${l}`])} />
    </Shell>
  );
}

// ---------------------------------------------------------------- Lung-RADS
function LungRads({ onResult }: { onResult: (r: StructuredResult) => void }) {
 const referenceT = useReferenceLocalization().t;

  const [s, set] = useState({ type: 'solid', size: 7, solid: 0, lobe: 'right upper lobe', suspicious: false, none: false });
  const cat = useMemo(() => {
    if (s.none) return '1';
    let c = '2';
    if (s.type === 'solid') c = s.size < 6 ? '2' : s.size < 8 ? '3' : s.size < 15 ? '4A' : '4B';
    if (s.type === 'part') c = s.size < 6 ? '2' : s.solid < 6 ? '3' : s.solid < 8 ? '4A' : '4B';
    if (s.type === 'ggn') c = s.size < 30 ? '2' : '3';
    if (s.suspicious && ['3', '4A', '4B'].includes(c)) c = '4X';
    return c;
  }, [s]);
  const MG: Record<string, [string, string]> = {
    '1': ['Negative', 'Continue annual screening with low-dose CT in 12 months.'],
    '2': ['Benign appearance or behaviour', 'Continue annual screening with low-dose CT in 12 months.'],
    '3': ['Probably benign', 'Low-dose CT in 6 months.'],
    '4A': ['Suspicious', 'Low-dose CT in 3 months; PET/CT may be considered if there is a solid component of 8 mm or more.'],
    '4B': ['Very suspicious', 'Diagnostic chest CT with or without contrast, PET/CT and/or tissue sampling depending on the probability of malignancy.'],
    '4X': ['Very suspicious, with additional features', 'Diagnostic chest CT, PET/CT and/or tissue sampling; multidisciplinary discussion recommended.'],
  };
  const [label, rec] = MG[cat];
  const typeL = { solid: 'solid', part: 'part-solid', ggn: 'ground-glass' } as any;
  const findings = s.none ? 'No pulmonary nodules.' : `${s.size} mm ${typeL[s.type]} nodule in the ${s.lobe}${s.type === 'part' ? ` with a ${s.solid} mm solid component` : ''}${s.suspicious ? ', with additional suspicious features' : ''}.`;
  return (
    <Shell category={`Lung-RADS ${cat}: ${label}`} tone={cat.startsWith('4') ? 'stat' : cat === '3' ? 'urgent' : 'ok'} detail={rec}
      onInsert={() => onResult({ system: 'Lung-RADS v2022', category: cat, findings, impression: `Lung-RADS ${cat}: ${label}. ${rec}`, data: { ...s, category: cat } })}>
      <label className="col-span-2 flex items-center gap-2 text-sm"><DiagnosticInput type="checkbox" className="accent-petrol" checked={s.none} onChange={(e) => set({ ...s, none: e.target.checked })} /><ReferenceText message="No nodules" /></label>
      {!s.none && <>
        <Opt label={referenceT("Nodule type")} value={s.type} onChange={(v) => set({ ...s, type: v })} options={[['solid', 'Solid'], ['part', 'Part-solid'], ['ggn', 'Ground-glass']]} />
        <Opt label={referenceT("Location")} value={s.lobe} onChange={(v) => set({ ...s, lobe: v })} options={['right upper lobe', 'right middle lobe', 'right lower lobe', 'left upper lobe', 'lingula', 'left lower lobe'].map((l) => [l, l[0].toUpperCase() + l.slice(1)])} />
        <Num label={referenceT("Mean diameter")} value={s.size} onChange={(v) => set({ ...s, size: v })} />
        {s.type === 'part' && <Num label={referenceT("Solid component")} value={s.solid} onChange={(v) => set({ ...s, solid: v })} />}
        <label className="col-span-2 flex items-center gap-2 text-sm"><DiagnosticInput type="checkbox" className="accent-petrol" checked={s.suspicious} onChange={(e) => set({ ...s, suspicious: e.target.checked })} /><ReferenceText message="Additional suspicious features (spiculation, lymphadenopathy, growth)" /></label>
      </>}
    </Shell>
  );
}

// ---------------------------------------------------------------- PI-RADS
function PiRads({ onResult }: { onResult: (r: StructuredResult) => void }) {
 const referenceT = useReferenceLocalization().t;

  const [s, set] = useState({ zone: 'PZ', t2: 3, dwi: 4, dce: 'neg', size: 9, location: 'left mid-gland posterolateral' });
  const score = useMemo(() => {
    if (s.zone === 'PZ') return s.dwi === 3 && s.dce === 'pos' ? 4 : s.dwi;
    if (s.t2 === 3 && s.dwi === 5) return 4;
    if (s.t2 === 2 && s.dwi >= 4) return 3;
    return s.t2;
  }, [s]);
  const L = ['', 'Very low (clinically significant cancer highly unlikely)', 'Low (clinically significant cancer unlikely)', 'Intermediate (equivocal)', 'High (clinically significant cancer likely)', 'Very high (clinically significant cancer highly likely)'];
  const findings = `${s.size} mm lesion in the ${s.zone === 'PZ' ? 'peripheral zone' : 'transition zone'}, ${s.location}. T2W score ${s.t2}, DWI score ${s.dwi}, DCE ${s.dce === 'pos' ? 'positive' : 'negative'}.`;
  return (
    <Shell category={`PI-RADS ${score}`} tone={score >= 4 ? 'stat' : score === 3 ? 'urgent' : 'ok'} detail={L[score]}
      onInsert={() => onResult({ system: 'PI-RADS v2.1', category: String(score), findings, impression: `PI-RADS ${score}: ${L[score]}.${score >= 4 ? ' Targeted biopsy is recommended.' : score === 3 ? ' Consider PSA density and multidisciplinary discussion regarding biopsy.' : ''}`, data: { ...s, score } })}>
      <Opt label={referenceT("Zone")} value={s.zone} onChange={(v) => set({ ...s, zone: v })} options={[['PZ', 'Peripheral zone'], ['TZ', 'Transition zone']]} />
      <label className="block"><span className="label"><ReferenceText message="Location" /></span><DiagnosticInput className="field" value={s.location} onChange={(e) => set({ ...s, location: e.target.value })} /></label>
      <Opt label={referenceT("T2W score")} value={s.t2} onChange={(v) => set({ ...s, t2: v })} options={[1, 2, 3, 4, 5].map((n) => [n, String(n)])} />
      <Opt label={referenceT("DWI / ADC score")} value={s.dwi} onChange={(v) => set({ ...s, dwi: v })} options={[1, 2, 3, 4, 5].map((n) => [n, String(n)])} />
      <Opt label={referenceT("DCE")} value={s.dce} onChange={(v) => set({ ...s, dce: v })} options={[['neg', 'Negative'], ['pos', 'Positive']]} />
      <Num label={referenceT("Size")} value={s.size} onChange={(v) => set({ ...s, size: v })} />
    </Shell>
  );
}

// ---------------------------------------------------------------- LI-RADS
function LiRads({ onResult }: { onResult: (r: StructuredResult) => void }) {
 const referenceT = useReferenceLocalization().t;

  const [s, set] = useState({ size: 22, segment: 'VII', aphe: true, washout: true, capsule: false, growth: false, override: '' });
  const cat = useMemo(() => {
    if (s.override) return s.override;
    const n = [s.washout, s.capsule, s.growth].filter(Boolean).length;
    if (!s.aphe) return n === 0 ? 'LR-3' : 'LR-4';
    if (s.size < 10) return n === 0 ? 'LR-3' : 'LR-4';
    if (s.size < 20) {
      if (n === 0) return 'LR-3';
      if (n >= 2) return 'LR-5';
      return s.capsule ? 'LR-4' : 'LR-5';
    }
    return n === 0 ? 'LR-4' : 'LR-5';
  }, [s]);
  const L: Record<string, string> = {
    'LR-1': 'Definitely benign', 'LR-2': 'Probably benign', 'LR-3': 'Intermediate probability of malignancy', 'LR-4': 'Probably HCC',
    'LR-5': 'Definitely HCC', 'LR-M': 'Probably or definitely malignant, not HCC specific', 'LR-TIV': 'Tumour in vein',
  };
  const feats = [s.aphe && 'non-rim arterial phase hyperenhancement', s.washout && 'non-peripheral washout', s.capsule && 'enhancing capsule', s.growth && 'threshold growth'].filter(Boolean);
  const findings = `${s.size} mm observation in segment ${s.segment}${feats.length ? ` demonstrating ${feats.join(', ')}` : ' without major features'}.`;
  const rec: Record<string, string> = { 'LR-3': 'Repeat or alternative diagnostic imaging in 3 to 6 months.', 'LR-4': 'Multidisciplinary discussion; repeat or alternative imaging in 3 months or biopsy.', 'LR-5': 'Multidisciplinary discussion for consensus management.', 'LR-M': 'Multidisciplinary discussion; biopsy often required.', 'LR-TIV': 'Multidisciplinary discussion.' };
  return (
    <Shell category={`${cat}: ${L[cat]}`} tone={['LR-4', 'LR-5', 'LR-M', 'LR-TIV'].includes(cat) ? 'stat' : cat === 'LR-3' ? 'urgent' : 'ok'} detail={rec[cat] || 'Return to routine surveillance in 6 months.'}
      onInsert={() => onResult({ system: 'LI-RADS v2018', category: cat, findings, impression: `${cat} (${L[cat]}) observation in segment ${s.segment}. ${rec[cat] || 'Return to routine surveillance in 6 months.'}`, data: { ...s, category: cat } })}>
      <Num label={referenceT("Size")} value={s.size} onChange={(v) => set({ ...s, size: v })} />
      <Opt label={referenceT("Segment")} value={s.segment} onChange={(v) => set({ ...s, segment: v })} options={['I', 'II', 'III', 'IVa', 'IVb', 'V', 'VI', 'VII', 'VIII'].map((x) => [x, x])} />
      <div className="col-span-2 grid grid-cols-2 gap-2 text-sm">
        {([['aphe', 'Non-rim APHE'], ['washout', 'Non-peripheral washout'], ['capsule', 'Enhancing capsule'], ['growth', 'Threshold growth']] as const).map(([k, l]) => (
          <label key={k} className="flex items-center gap-2"><DiagnosticInput type="checkbox" className="accent-petrol" checked={s[k]} onChange={(e) => set({ ...s, [k]: e.target.checked })} />{l}</label>
        ))}
      </div>
      <Opt label={referenceT("Override category")} value={s.override} onChange={(v) => set({ ...s, override: v })} options={[['', 'Use major features'], ['LR-1', 'LR-1 Definitely benign'], ['LR-2', 'LR-2 Probably benign'], ['LR-M', 'LR-M'], ['LR-TIV', 'LR-TIV']]} />
    </Shell>
  );
}

function Shell({ children, category, detail, tone, onInsert }: { children: React.ReactNode; category: string; detail: string; tone: 'ok' | 'urgent' | 'stat'; onInsert: () => void }) {
  const cls = tone === 'stat' ? 'border-stat/40 bg-stat-bg text-stat' : tone === 'urgent' ? 'border-urgent/40 bg-urgent-bg text-urgent' : 'border-ok/30 bg-ok-bg text-ok';
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
      <div className={`mt-4 rounded-md border px-3 py-2.5 ${cls}`} aria-live="polite">
        <div className="text-lg font-bold">{category}</div>
        <div className="text-sm text-ink-3">{detail}</div>
      </div>
      <DiagnosticButton className="btn-primary mt-3 w-full" onClick={onInsert}><ReferenceText message="Insert into report" /></DiagnosticButton>
    </div>
  );
}

export const SYSTEMS = [
  { key: 'TIRADS', label: 'TI-RADS', hint: 'Thyroid ultrasound', modalities: ['US'], C: TiRads },
  { key: 'BIRADS', label: 'BI-RADS', hint: 'Breast imaging', modalities: ['MG', 'US', 'MR'], C: BiRads },
  { key: 'LUNGRADS', label: 'Lung-RADS', hint: 'Lung cancer screening CT', modalities: ['CT'], C: LungRads },
  { key: 'PIRADS', label: 'PI-RADS', hint: 'Prostate MRI', modalities: ['MR'], C: PiRads },
  { key: 'LIRADS', label: 'LI-RADS', hint: 'Liver CT/MRI', modalities: ['CT', 'MR'], C: LiRads },
] as const;

export default function StructuredPanel({ modality, onResult }: { modality: string; onResult: (r: StructuredResult) => void }) {
  const sorted = [...SYSTEMS].sort((a, b) => Number((b.modalities as readonly string[]).includes(modality)) - Number((a.modalities as readonly string[]).includes(modality)));
  const [key, setKey] = useState<string>(sorted[0].key);
  const Sys = SYSTEMS.find((s) => s.key === key)!;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {sorted.map((s) => (
          <DiagnosticButton key={s.key} onClick={() => setKey(s.key)} title={s.hint}
            className={`rounded-full border px-3 py-1 text-xs font-bold ${key === s.key ? 'border-petrol bg-petrol text-white' : 'border-line bg-white text-ink-3 hover:border-ink-soft'}`}>
            <ReferenceText message={s.label} />
          </DiagnosticButton>
        ))}
      </div>
      <p className="mb-3 text-xs text-ink-soft">{Sys.hint}<ReferenceText message=". The calculated category is a suggestion; edit the inserted text as needed." /></p>
      <Sys.C key={key} onResult={onResult} />
    </div>
  );
}
