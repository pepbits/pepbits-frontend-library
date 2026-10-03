'use client';
import {DiagnosticButton,DiagnosticInput,DiagnosticTextarea,DiagnosticSelect} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import {useReferenceRouter as useRouter} from '@pepbits/reference-host';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Mic, MicOff, Save, FileSignature, BadgeCheck, Printer, SkipForward, Siren, FilePlus2, PencilLine, Ruler, X, CornerDownRight, AlertTriangle, History,
} from 'lucide-react';
import DicomViewer from '../../../../components/DicomViewer';
import StructuredPanel, { StructuredResult } from '../../../../components/Structured';
import {useFmt,useApi} from '../../../../lib/client';
import { useDictation, speechToText } from '../../../../components/useDictation';
import { Modal, PriorityBadge, StatusBadge, TatClock, ModalityChip, Tabs, useSession, useToast, Field } from '../../../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


type FieldKey = 'technique' | 'comparison' | 'findings' | 'impression';
const FIELDS: { key: FieldKey; label: string; rows: number }[] = [
  { key: 'technique', label: 'Technique', rows: 2 },
  { key: 'comparison', label: 'Comparison', rows: 1 },
  { key: 'findings', label: 'Findings', rows: 12 },
  { key: 'impression', label: 'Impression', rows: 4 },
];
const CRITICAL_CATEGORIES = [
  'Intracranial haemorrhage', 'Acute stroke / large vessel occlusion', 'Pulmonary embolism', 'Tension pneumothorax', 'Aortic dissection or rupture',
  'Pneumoperitoneum (free air)', 'Bowel obstruction or ischaemia', 'Cord compression', 'Misplaced tube or line', 'Testicular or ovarian torsion',
  'Ectopic pregnancy', 'Unexpected malignancy', 'Other critical finding',
];
const EMPTY = { technique: '', comparison: '', findings: '', impression: '', report_type: 'FREE', template_id: null as number | null, structured_json: null as string | null, critical: 0, critical_category: '', critical_severity: 'RED', critical_finding: '' };

export default function ReadingWorkstation({ params }: { params: { orderId: string } }) {
 const referenceT = useReferenceLocalization().t;

 const fmt=useFmt();

 const {api,open}=useDiagnosticClient();

  const id = Number(params.orderId);
  const router = useRouter();
  const toast = useToast();
  const { user } = useSession();
  const { data: o, reload } = useApi<any>(`/api/orders/${id}`);
  const { data: lk } = useApi<any>('/api/lookups');
  const [f, setF] = useState(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'report' | 'structured' | 'clinical' | 'history'>('report');
  const [active, setActive] = useState<FieldKey>('findings');
  const [measures, setMeasures] = useState<string[]>([]);
  const [studyId, setStudyId] = useState<number | null>(null);
  const [confirmFinal, setConfirmFinal] = useState(false);
  const [amending, setAmending] = useState(false);
  const [amendReason, setAmendReason] = useState('');
  const [addendum, setAddendum] = useState<string | null>(null);
  const refs = useRef<Record<FieldKey, HTMLTextAreaElement | null>>({ technique: null, comparison: null, findings: null, impression: null });
  const loadedFor = useRef<number | null>(null);

  const role = user?.role || '';
  const canPrelim = ['RADIOLOGIST', 'RESIDENT', 'ADMIN'].includes(role);
  const canSign = ['RADIOLOGIST', 'ADMIN'].includes(role);
  const r = o?.report;
  const signed = r && ['FINAL', 'CORRECTED'].includes(r.status);
  const editable = canPrelim && o && o.status !== 'CANCELLED' && (!signed || amending);
  const examDone = o && ['COMPLETED', 'PRELIMINARY', 'FINAL'].includes(o.status);

  // Load report into the form once per order (and after signing/amending).
  useEffect(() => {
    if (!o || loadedFor.current === o.id) return;
    loadedFor.current = o.id;
    setStudyId(o.study_id || null);
    setF(r ? {
      technique: r.technique || '', comparison: r.comparison || '', findings: r.findings || '', impression: r.impression || '',
      report_type: r.report_type || 'FREE', template_id: r.template_id, structured_json: r.structured_json, critical: r.critical ? 1 : 0,
      critical_category: r.critical_category || '', critical_severity: 'RED', critical_finding: '',
    } : { ...EMPTY, comparison: o.priors.find((p: any) => p.modality_code === o.modality_code && p.status === 'FINAL') ? '' : 'None available.' });
    setDirty(false); setAmending(false); setMeasures([]);
  }, [o, r]);

  const set = (k: keyof typeof EMPTY, v: any) => { setF((x) => ({ ...x, [k]: v })); setDirty(true); };

  // ----- text insertion at the cursor of the active field
  const insertText = useCallback((text: string, field: FieldKey = active, smart = true) => {
    const el = refs.current[field];
    setF((x) => {
      const cur = x[field] || '';
      const start = el && document.activeElement === el ? el.selectionStart : el?.dataset.caret ? Number(el.dataset.caret) : cur.length;
      const end = el && document.activeElement === el ? el.selectionEnd : start;
      const before = cur.slice(0, start), after = cur.slice(end);
      let t = text;
      if (smart) {
        const needSpace = before && !/[\s(]$/.test(before) && !/^[.,;:?)\n]/.test(t);
        if (needSpace) t = ' ' + t;
      }
      const next = before + t + after;
      requestAnimationFrame(() => {
        if (!el) return;
        const pos = before.length + t.length;
        el.focus(); el.setSelectionRange(pos, pos); el.dataset.caret = String(pos);
      });
      return { ...x, [field]: next };
    });
    setDirty(true);
  }, [active]);

  // ----- dictation
  const dict = useDictation({
    onText: (raw) => {
      const el = refs.current[active];
      const before = (el?.value || '').slice(0, el?.selectionStart ?? 0);
      insertText(speechToText(raw.trim(), !before.trim() || /[.?\n]\s*$/.test(before)));
    },
    onCommand: (cmd) => {
      if (cmd === 'next') {
        const i = FIELDS.findIndex((x) => x.key === active);
        const nxt = FIELDS[(i + 1) % FIELDS.length].key;
        setActive(nxt); refs.current[nxt]?.focus();
      }
    },
  });

  // ----- "___" placeholder navigation
  const nextBlank = useCallback(() => {
    const order = [...FIELDS.slice(FIELDS.findIndex((x) => x.key === active)), ...FIELDS.slice(0, FIELDS.findIndex((x) => x.key === active))];
    for (let n = 0; n < order.length; n++) {
      const k = order[n].key;
      const el = refs.current[k];
      if (!el) continue;
      const from = n === 0 ? el.selectionEnd : 0;
      const idx = el.value.indexOf('___', from);
      if (idx >= 0) { setActive(k); el.focus(); el.setSelectionRange(idx, idx + 3); return; }
    }
    toast('ok', 'No blanks left to fill');
  }, [active, toast]);

  // ----- persistence
  const body = () => ({ ...f, critical: f.critical ? 1 : 0, critical_category: f.critical ? f.critical_category || 'Other critical finding' : null });
  const saveDraft = useCallback(async (silent = false) => {
    if (!editable || signed) return;
    try {
      await api(`/api/reports/${id}`, { method: 'POST', json: { action: 'draft', ...body() } });
      setDirty(false); setSavedAt(new Date().toISOString());
      if (!silent) toast('ok', 'Draft saved');
    } catch (e: any) { if (!silent) toast('error', e.message); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, editable, signed, id]);

  useEffect(() => {
    if (!dirty || !editable || signed) return;
    const t = setTimeout(() => saveDraft(true), 20000);
    return () => clearTimeout(t);
  }, [dirty, editable, signed, saveDraft]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveDraft(); }
      if (e.key === 'F2') { e.preventDefault(); nextBlank(); }
      if (e.key === 'F4') { e.preventDefault(); dict.toggle(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [saveDraft, nextBlank, dict]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const sign = async (action: 'preliminary' | 'final' | 'amend') => {
    if (f.findings.includes('___') || f.impression.includes('___')) {
      toast('error', 'The report still has unfilled blanks (___). Press F2 to jump to them.');
      return;
    }
    setBusy(true);
    try {
      await api(`/api/reports/${id}`, { method: 'POST', json: { action, ...body(), reason: amendReason } });
      dict.stop();
      toast('ok', action === 'final' ? 'Final report signed and sent to the EMR' : action === 'amend' ? 'Amended report signed and sent' : 'Preliminary report signed');
      if (f.critical) toast('error', 'Critical result recorded. Communicate it to the referrer and log the read-back.');
      setConfirmFinal(false); setDirty(false); loadedFor.current = null; setAmendReason('');
      await reload();
    } catch (e: any) { toast('error', e.message); } finally { setBusy(false); }
  };

  const saveAddendum = async () => {
    setBusy(true);
    try {
      await api(`/api/reports/${id}`, { method: 'POST', json: { action: 'addendum', text: addendum } });
      toast('ok', 'Addendum signed and sent');
      setAddendum(null); reload();
    } catch (e: any) { toast('error', e.message); } finally { setBusy(false); }
  };

  const nextCase = async () => {
    if (dirty) await saveDraft(true);
    const list = await api<any[]>('/api/orders?view=reading');
    const next = list.find((x) => x.status === 'COMPLETED' && x.id !== id);
    if (next) router.push(`/reading/${next.id}`); else { toast('ok', 'No more unread cases'); router.push('/reading'); }
  };

  const applyTemplate = (tid: number) => {
    const t = lk?.templates.find((x: any) => x.id === tid);
    if (!t) return;
    const hasText = f.findings.trim() || f.impression.trim();
    if (hasText && !confirm(`Replace the current report text with “${t.name}”?`)) return;
    setF((x) => ({ ...x, technique: t.technique || x.technique, findings: t.findings || '', impression: t.impression || '', template_id: t.id, report_type: 'TEMPLATE' }));
    setDirty(true);
    requestAnimationFrame(() => { const el = refs.current.findings; if (el) { const i = el.value.indexOf('___'); if (i >= 0) { el.focus(); el.setSelectionRange(i, i + 3); setActive('findings'); } } });
  };

  const onStructured = (res: StructuredResult) => {
    setF((x) => ({
      ...x,
      findings: x.findings.trim() ? `${x.findings.trim()}\n\n${res.findings}` : res.findings,
      impression: x.impression.trim() ? `${x.impression.trim()}\n${res.impression}` : res.impression,
      report_type: 'STRUCTURED',
      structured_json: JSON.stringify([...(x.structured_json ? (() => { try { return JSON.parse(x.structured_json!); } catch { return []; } })() : []), res]),
    }));
    setDirty(true); setTab('report');
    toast('ok', `${res.system} ${res.category} inserted`);
  };

  const templates = useMemo(() => {
    const t = (lk?.templates || []).filter((x: any) => x.kind !== 'MACRO');
    return [...t.filter((x: any) => x.modality_code === o?.modality_code && (!x.body_part || x.body_part === o?.body_part)),
      ...t.filter((x: any) => x.modality_code === o?.modality_code && x.body_part && x.body_part !== o?.body_part),
      ...t.filter((x: any) => x.modality_code !== o?.modality_code)];
  }, [lk, o]);
  const macros = (lk?.templates || []).filter((x: any) => x.kind === 'MACRO' && (!x.modality_code || x.modality_code === o?.modality_code));

  if (!o) return null;
  const allergy = o.allergies && !/^none/i.test(o.allergies);
  const priorsWithImages = o.priors.filter((p: any) => p.study_id);
  const words = f.findings.split(/\s+/).filter(Boolean).length + f.impression.split(/\s+/).filter(Boolean).length;

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-4rem)] flex-col lg:-mx-8">
      {/* patient banner */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-white px-4 py-2">
        <Link href="/reading" className="btn-ghost btn-sm" aria-label={referenceT("Back to worklist")}><ArrowLeft size={16} /></Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/patients/${o.patient_id}`} className="text-lg font-bold hover:underline">{fmt.name(o)}</Link>
            <span className="text-sm text-ink-soft">{fmt.age(o.dob)} {o.sex} · <span className="id">{o.mrn}</span></span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <ModalityChip code={o.modality_code} /><b>{o.procedure_name}</b><span className="id text-ink-soft">{o.accession}</span>
          </div>
        </div>
        <PriorityBadge priority={o.priority} />
        {r ? <StatusBadge status={r.status} label={r.status === 'CORRECTED' ? `Amended v${r.version}` : r.status === 'DRAFT' ? 'Draft' : undefined} /> : <StatusBadge status={o.status} />}
        {allergy && <span className="flex items-center gap-1 rounded bg-stat-bg px-2 py-0.5 text-xs font-bold text-stat"><AlertTriangle size={12} />{o.allergies}</span>}
        <div className="ml-auto flex items-center gap-3">
          <TatClock tat={o.tat} />
          <DiagnosticButton className="btn-secondary btn-sm" onClick={nextCase}><SkipForward size={14} /><ReferenceText message="Next case" /></DiagnosticButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        {/* images */}
        <div className="flex min-h-[420px] min-w-0 flex-1 flex-col bg-black">
          {(priorsWithImages.length > 0) && (
            <div className="flex gap-1 overflow-x-auto border-b border-white/10 bg-film-3 px-2 py-1 scroll-thin">
              {o.study_id && <DiagnosticButton onClick={() => setStudyId(o.study_id)} className={`rounded px-2 py-1 text-xs font-bold ${studyId === o.study_id ? 'bg-film-measure text-black' : 'text-white/75 hover:bg-white/10'}`}><ReferenceText message="Current ·" /> {fmt.date(o.exam_completed_at || o.ordered_at)}</DiagnosticButton>}
              {priorsWithImages.map((p: any) => (
                <DiagnosticButton key={p.id} onClick={() => setStudyId(p.study_id)} className={`whitespace-nowrap rounded px-2 py-1 text-xs ${studyId === p.study_id ? 'bg-film-measure font-bold text-black' : 'text-white/60 hover:bg-white/10'}`}><ReferenceText message="Prior ·" />{p.modality_code} {p.procedure_name.replace(/^(XR|CT|MRI|US|MG)\s/, '')} · {fmt.date(p.ordered_at)}
                </DiagnosticButton>
              ))}
            </div>
          )}
          {studyId ? (
            <DicomViewer key={studyId} studyId={studyId} className="min-h-0 flex-1"
              onMeasure={(t) => setMeasures((m) => [t, ...m].slice(0, 12))}
              onExpand={() => open(`/viewer/${studyId}`)} />
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-white/60"><ReferenceText message="No images have been received for this accession." /></div>
          )}
        </div>

        {/* report */}
        <div className="flex min-h-0 w-full shrink-0 flex-col border-l border-line bg-white xl:w-[600px] 2xl:w-[680px]">
          <div className="px-3 pt-1">
            <Tabs value={tab} onChange={setTab} items={[
              { value: 'report', label: 'Report' },
              { value: 'structured', label: 'Structured scoring' },
              { value: 'clinical', label: 'Clinical & priors' },
              { value: 'history', label: <span className="flex items-center gap-1"><History size={14} /><ReferenceText message="History" /></span> },
            ]} />
          </div>

          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {tab === 'report' && (
              <>
                {!examDone && <p className="mb-3 rounded-md bg-urgent-bg px-3 py-2 text-sm text-urgent"><ReferenceText message="The exam is not marked complete yet. You can prepare a draft, but signing is available once the technologist completes it." /></p>}
                {!canPrelim && <p className="mb-3 rounded-md bg-paper px-3 py-2 text-sm text-ink-3"><ReferenceText message="You are signed in as" /> {user?.name}<ReferenceText message=". Switch to a radiologist or resident to edit reports." /></p>}

                {editable && (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <DiagnosticSelect className="field h-8 w-auto max-w-[260px] text-sm" value="" onChange={(e) => e.target.value && applyTemplate(Number(e.target.value))} aria-label={referenceT("Apply template")}>
                      <option value=""><ReferenceText message="Apply template…" /></option>
                      {templates.map((t: any) => <option key={t.id} value={t.id}>{t.kind === 'NORMAL' ? '✓ ' : ''}{t.name}{t.modality_code !== o.modality_code ? ` (${t.modality_code})` : ''}</option>)}
                    </DiagnosticSelect>
                    <DiagnosticButton className="btn-secondary btn-sm" onClick={nextBlank} title={referenceT("Jump to the next ___ blank (F2)")}><CornerDownRight size={14} /><ReferenceText message="Next blank" /></DiagnosticButton>
                    {dict.supported ? (
                      <DiagnosticButton onClick={dict.toggle} title={referenceT("Dictate into the active field (F4)")}
                        className={`btn btn-sm ${dict.listening ? 'bg-stat text-white hover:bg-stat/90' : 'btn-secondary'}`}>
                        {dict.listening ? <><MicOff size={14} /><ReferenceText message="Stop dictation" /></> : <><Mic size={14} /><ReferenceText message="Dictate" /></>}
                      </DiagnosticButton>
                    ) : <span className="text-xs text-ink-soft"><ReferenceText message="Dictation needs Chrome, Edge or Safari" /></span>}
                    {dict.listening && <span className="flex items-center gap-1.5 text-xs text-stat"><span className="h-2 w-2 animate-pulse rounded-full bg-stat" /><ReferenceText message="into" /> {active}</span>}
                  </div>
                )}
                {dict.error && <p className="mb-2 text-sm text-stat">{dict.error}</p>}

                {macros.length > 0 && editable && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {macros.map((m: any) => (
                      <DiagnosticButton key={m.id} className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs text-ink-3 hover:border-petrol hover:text-petrol"
                        onClick={() => insertText(m.findings || m.impression, m.findings ? active : active === 'impression' ? 'impression' : active)} title={m.findings || m.impression}>
                        + {m.name.replace(/^Macro:\s*/, '')}
                      </DiagnosticButton>
                    ))}
                  </div>
                )}

                {measures.length > 0 && editable && (
                  <div className="mb-3 rounded-md border border-film-measure/50 bg-[#FFF7E6] p-2">
                    <div className="mb-1 flex items-center justify-between text-xs font-bold text-urgent"><span className="flex items-center gap-1"><Ruler size={13} /><ReferenceText message="Measurements from the viewer, click to insert" /></span><DiagnosticButton onClick={() => setMeasures([])} aria-label={referenceT("Clear measurements")}><X size={13} /></DiagnosticButton></div>
                    <div className="flex flex-wrap gap-1.5">
                      {measures.map((m, i) => <DiagnosticButton key={i} className="rounded bg-white px-2 py-0.5 text-xs ring-1 ring-urgent/30 hover:ring-urgent" onClick={() => insertText(m)}>{m}</DiagnosticButton>)}
                    </div>
                  </div>
                )}

                {signed && !amending ? (
                  <div className="space-y-4 text-[15px]">
                    {FIELDS.map((fd) => f[fd.key] ? (
                      <div key={fd.key}><h3 className="mb-1 text-sm font-bold text-ink-soft"><ReferenceText message={fd.label} /></h3><p className={`whitespace-pre-wrap ${fd.key === 'impression' ? 'font-bold' : ''}`}>{f[fd.key]}</p></div>
                    ) : null)}
                    {r.addenda.map((a: any) => (
                      <div key={a.id} className="rounded-md border-l-4 border-urgent bg-urgent-bg/60 px-3 py-2">
                        <div className="text-xs font-bold text-urgent"><ReferenceText message="Addendum ·" /> {a.author_name} · {fmt.dateTime(a.signed_at)}</div>
                        <p className="whitespace-pre-wrap">{a.text}</p>
                      </div>
                    ))}
                    <p className="border-t border-line pt-2 text-sm text-ink-soft"><ReferenceText message="Electronically signed by" /> <b className="text-ink">{r.signed_name}</b>{r.signed_title ? `, ${r.signed_title}` : ''} <ReferenceText message="on" /> {fmt.dateTime(r.signed_at)}{r.version > 1 ? ` · version ${r.version}` : ''}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {amending && (
                      <Field label={referenceT("Reason for amendment")} hint={referenceT("Recorded in the version history and sent to the EMR with the corrected report.")}>
                        <DiagnosticInput className="field border-urgent" value={amendReason} onChange={(e) => setAmendReason(e.target.value)} placeholder={referenceT("e.g. Laterality corrected: left, not right")} autoFocus />
                      </Field>
                    )}
                    {FIELDS.map((fd) => (
                      <label key={fd.key} className="block">
                        <span className={`label flex items-center justify-between ${active === fd.key ? 'text-petrol' : ''}`}>
                          <ReferenceText message={fd.label} />
                          {active === fd.key && dict.listening && dict.interim && <span className="ml-2 truncate text-xs font-normal italic text-ink-soft">{dict.interim}</span>}
                        </span>
                        <DiagnosticTextarea
                          ref={(el) => { refs.current[fd.key] = el; }}
                          className={`field font-sans leading-relaxed ${fd.key === 'impression' ? 'font-bold' : ''} ${active === fd.key ? 'border-petrol/60' : ''}`}
                          rows={fd.rows}
                          value={f[fd.key]}
                          readOnly={!editable}
                          onFocus={() => setActive(fd.key)}
                          onSelect={(e) => { (e.target as HTMLTextAreaElement).dataset.caret = String((e.target as HTMLTextAreaElement).selectionStart); }}
                          onChange={(e) => set(fd.key, e.target.value)}
                          spellCheck
                        />
                      </label>
                    ))}

                    <div className={`rounded-md border p-3 ${f.critical ? 'border-crit/40 bg-crit-bg' : 'border-line'}`}>
                      <label className="flex items-center gap-2 font-bold">
                        <DiagnosticInput type="checkbox" className="h-4 w-4 accent-[#9F1239]" checked={!!f.critical} disabled={!editable} onChange={(e) => set('critical', e.target.checked ? 1 : 0)} />
                        <Siren size={16} className={f.critical ? 'text-crit' : 'text-ink-soft'} /><ReferenceText message="Critical or unexpected significant finding" /></label>
                      {!!f.critical && (
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <DiagnosticSelect className="field sm:col-span-2" value={f.critical_category} onChange={(e) => set('critical_category', e.target.value)} disabled={!editable} aria-label={referenceT("Critical category")}>
                            <option value=""><ReferenceText message="Choose category" /></option>
                            {CRITICAL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                          </DiagnosticSelect>
                          <DiagnosticSelect className="field" value={f.critical_severity} onChange={(e) => set('critical_severity', e.target.value)} disabled={!editable} aria-label={referenceT("Urgency")}>
                            <option value="RED"><ReferenceText message="Red: within 1 hour" /></option><option value="ORANGE"><ReferenceText message="Orange: within 6 hours" /></option><option value="YELLOW"><ReferenceText message="Yellow: within days" /></option>
                          </DiagnosticSelect>
                          <DiagnosticInput className="field sm:col-span-3" placeholder={referenceT("Finding to communicate (defaults to the impression)")} value={f.critical_finding} onChange={(e) => set('critical_finding', e.target.value)} disabled={!editable} />
                          <p className="text-xs text-crit sm:col-span-3"><ReferenceText message="Signing opens a critical result that must be communicated to the referrer" />{o.referrer_name ? ` (${o.referrer_name}${o.referrer_phone ? `, ${o.referrer_phone}` : ''})` : ''} <ReferenceText message="and acknowledged." /></p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {tab === 'structured' && (editable ? <StructuredPanel modality={o.modality_code} onResult={onStructured} /> : <p className="text-sm text-ink-soft"><ReferenceText message="Structured scoring is available while the report is being edited." /></p>)}

            {tab === 'clinical' && (
              <div className="space-y-4 text-sm">
                <div><h3 className="mb-1 font-bold"><ReferenceText message="Clinical history" /></h3><p className="whitespace-pre-wrap">{o.clinical_history || '—'}</p></div>
                <div><h3 className="mb-1 font-bold"><ReferenceText message="Reason for exam" /></h3><p>{o.reason || '—'}</p></div>
                <dl className="grid grid-cols-[130px_1fr] gap-y-1.5">
                  <dt className="text-ink-soft"><ReferenceText message="Referrer" /></dt><dd>{o.referrer_name || '—'}{o.referrer_phone ? ` · ${o.referrer_phone}` : ''}</dd>
                  <dt className="text-ink-soft"><ReferenceText message="Patient class" /></dt><dd>{({ OP: 'Outpatient', IP: 'Inpatient', ER: 'Emergency' } as any)[o.patient_class]}</dd>
                  <dt className="text-ink-soft"><ReferenceText message="Technologist" /></dt><dd>{o.technologist_name || '—'}</dd>
                  <dt className="text-ink-soft"><ReferenceText message="Contrast" /></dt><dd>{o.contrast_used || 'None recorded'}</dd>
                  {(o.dose_ctdivol || o.dose_dlp) && <><dt className="text-ink-soft"><ReferenceText message="Dose" /></dt><dd><ReferenceText message="CTDIvol" /> {o.dose_ctdivol ?? '—'} <ReferenceText message="mGy · DLP" /> {o.dose_dlp ?? '—'} <ReferenceText message="mGy·cm" /></dd></>}
                  <dt className="text-ink-soft"><ReferenceText message="Tech notes" /></dt><dd>{o.tech_notes || '—'}</dd>
                </dl>
                <div>
                  <h3 className="mb-2 font-bold"><ReferenceText message="Prior exams" /></h3>
                  {!o.priors.length && <p className="text-ink-soft"><ReferenceText message="No prior imaging in this RIS." /></p>}
                  {o.priors.map((p: any) => (
                    <div key={p.id} className="mb-2 rounded-md border border-line p-2.5">
                      <div className="flex items-center gap-2"><ModalityChip code={p.modality_code} /><b className="flex-1">{p.procedure_name}</b><span className="text-xs text-ink-soft">{fmt.date(p.ordered_at)}</span></div>
                      {p.impression && <p className="mt-1 text-ink-3">{p.impression}</p>}
                      <div className="mt-1.5 flex gap-2">
                        {p.study_id && <DiagnosticButton className="btn-secondary btn-sm" onClick={() => setStudyId(p.study_id)}><ReferenceText message="Show images" /></DiagnosticButton>}
                        {editable && p.status === 'FINAL' && <DiagnosticButton className="btn-ghost btn-sm" onClick={() => { set('comparison', `${p.procedure_name}, ${fmt.date(p.ordered_at)}.`); setTab('report'); }}><ReferenceText message="Use as comparison" /></DiagnosticButton>}
                        {['PRELIMINARY', 'FINAL'].includes(p.status) && <Link href={`/print/report/${p.id}`} target="_blank" className="btn-ghost btn-sm"><ReferenceText message="Full report" /></Link>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'history' && (
              <div className="space-y-3 text-sm">
                {!r?.versions?.length && <p className="text-ink-soft"><ReferenceText message="No signed versions yet." /></p>}
                {r?.versions?.map((v: any) => (
                  <details key={v.id} className="rounded-md border border-line">
                    <summary className="cursor-pointer px-3 py-2"><b><ReferenceText message="Version" /> {v.version}</b> · {v.reason} · {v.changed_by_name} · {fmt.dateTime(v.changed_at)}</summary>
                    <div className="space-y-2 border-t border-line px-3 py-2">
                      <div><div className="text-xs font-bold text-ink-soft"><ReferenceText message="Findings" /></div><p className="whitespace-pre-wrap">{v.findings}</p></div>
                      <div><div className="text-xs font-bold text-ink-soft"><ReferenceText message="Impression" /></div><p className="whitespace-pre-wrap">{v.impression}</p></div>
                    </div>
                  </details>
                ))}
                {o.critical.map((c: any) => (
                  <div key={c.id} className="rounded-md border border-crit/30 bg-crit-bg px-3 py-2">
                    <b className="text-crit">{c.category}</b> <StatusBadge status={c.status} />
                    <div className="text-ink-3"><ReferenceText message="Flagged" /> {fmt.dateTime(c.flagged_at)}{c.communicated_to ? ` · told ${c.communicated_to} (${c.method}) ${fmt.dateTime(c.communicated_at)}` : ''}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* action bar */}
          <div className="flex flex-wrap items-center gap-2 border-t border-line bg-paper/60 px-4 py-2.5">
            <span className="mr-auto text-xs text-ink-soft">
              {editable && !signed ? (dirty ? 'Unsaved changes' : savedAt ? `Draft saved ${fmt.time(savedAt)}` : r ? `Last saved ${fmt.dateTime(r.updated_at)}` : 'New report') : ''}
              {editable && ` · ${words} words`}
            </span>
            {signed && !amending && <>
              <Link href={`/print/report/${id}`} target="_blank" className="btn-secondary btn-sm"><Printer size={14} /><ReferenceText message="Print" /></Link>
              {canSign && <DiagnosticButton className="btn-secondary btn-sm" onClick={() => setAddendum('')}><FilePlus2 size={14} /><ReferenceText message="Addendum" /></DiagnosticButton>}
              {canSign && <DiagnosticButton className="btn-secondary btn-sm" onClick={() => { setAmending(true); setTab('report'); }}><PencilLine size={14} /><ReferenceText message="Amend" /></DiagnosticButton>}
            </>}
            {amending && <>
              <DiagnosticButton className="btn-ghost btn-sm" onClick={() => { setAmending(false); loadedFor.current = null; reload(); }}><ReferenceText message="Discard changes" /></DiagnosticButton>
              <DiagnosticButton className="btn-primary btn-sm" disabled={busy || !amendReason.trim()} onClick={() => sign('amend')}><BadgeCheck size={14} /><ReferenceText message="Sign amended report" /></DiagnosticButton>
            </>}
            {editable && !signed && <>
              <DiagnosticButton className="btn-secondary btn-sm" disabled={busy} onClick={() => saveDraft()} title={referenceT("Ctrl+S")}><Save size={14} /><ReferenceText message="Save draft" /></DiagnosticButton>
              {o.status !== 'PRELIMINARY' || role === 'RESIDENT' ? (
                <DiagnosticButton className="btn-secondary btn-sm" disabled={busy || !examDone} onClick={() => sign('preliminary')}><FileSignature size={14} /><ReferenceText message="Sign preliminary" /></DiagnosticButton>
              ) : null}
              {canSign && <DiagnosticButton className="btn-primary btn-sm" disabled={busy || !examDone} onClick={() => setConfirmFinal(true)}><BadgeCheck size={14} />{o.status === 'PRELIMINARY' ? 'Verify and sign final' : 'Sign final'}</DiagnosticButton>}
            </>}
          </div>
        </div>
      </div>

      <Modal open={confirmFinal} onClose={() => setConfirmFinal(false)} title={referenceT("Sign final report")}
        footer={<><DiagnosticButton className="btn-secondary" onClick={() => setConfirmFinal(false)}><ReferenceText message="Keep editing" /></DiagnosticButton><DiagnosticButton className="btn-primary" disabled={busy} onClick={() => sign('final')}><ReferenceText message="Sign as" /> {user?.name}</DiagnosticButton></>}>
        <p className="mb-2 text-sm"><ReferenceText message="The report becomes the legal record and is sent to connected systems. Later changes need an addendum or an amendment." /></p>
        <div className="rounded-md bg-paper p-3 text-sm"><div className="text-xs font-bold text-ink-soft"><ReferenceText message="Impression" /></div><p className="whitespace-pre-wrap font-bold">{f.impression || <span className="text-stat"><ReferenceText message="Empty" /></span>}</p></div>
        {!!f.critical && <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-crit"><Siren size={15} /><ReferenceText message="Critical result:" /> {f.critical_category || 'Other critical finding'}</p>}
        {!f.critical && /\b(haemorrhage|hemorrhage|embol|pneumothorax|dissection|free air|pneumoperitoneum|torsion|cord compression)\b/i.test(f.impression) && !/\bno\b/i.test(f.impression.slice(0, 40)) && (
          <p className="mt-2 text-sm text-urgent"><ReferenceText message="The impression mentions a finding that is often critical, but the report is not flagged. Check before signing." /></p>
        )}
      </Modal>

      <Modal open={addendum !== null} onClose={() => setAddendum(null)} title={referenceT("Add addendum")} width="max-w-xl"
        footer={<><DiagnosticButton className="btn-secondary" onClick={() => setAddendum(null)}><ReferenceText message="Cancel" /></DiagnosticButton><DiagnosticButton className="btn-primary" disabled={busy || !addendum?.trim()} onClick={saveAddendum}><ReferenceText message="Sign addendum" /></DiagnosticButton></>}>
        <p className="mb-2 text-sm text-ink-soft"><ReferenceText message="An addendum adds information without changing the signed text. Use Amend to correct an error." /></p>
        <DiagnosticTextarea className="field" rows={6} value={addendum || ''} onChange={(e) => setAddendum(e.target.value)} autoFocus placeholder={referenceT("e.g. Comparison with the outside CT of 12 March now available: the nodule is unchanged.")} />
      </Modal>
    </div>
  );
}
