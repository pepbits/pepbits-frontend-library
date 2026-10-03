'use client';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { useEffect, useState } from 'react';
import DicomViewer from '../../../components/DicomViewer';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';


export default function ViewerPage({ params }: { params: { id: string } }) {
 const {fetch}=useDiagnosticClient();

  const [s, setS] = useState<any>(null);
  useEffect(() => { fetch(`/api/dicom/studies/${params.id}`).then((r) => r.json()).then(setS).catch(() => {}); }, [params.id]);
  useEffect(() => { if (s) document.title = `${(s.patient_name || '').replace(/\^/g, ' ')} · ${s.description || 'Study'}`; }, [s]);
  return (
    <div className="film flex h-screen flex-col bg-black">
      <div className="flex items-center gap-3 border-b border-white/10 bg-film-3 px-3 py-1.5 text-sm text-white/80">
        <span className="font-bold text-white"><ReferenceText message="Radiant PACS" /></span>
        {s && <span className="truncate">{(s.patient_name || '').replace(/\^/g, ', ')} · <span className="font-mono">{s.patient_id_dicom}</span> · {s.description} · <span className="font-mono">{s.accession}</span></span>}
        {s?.order_id && <Link href={`/reading/${s.order_id}`} className="ml-auto rounded px-2 py-1 text-xs font-bold text-film-text hover:bg-white/10"><ReferenceText message="Open report" /></Link>}
      </div>
      <DicomViewer studyId={Number(params.id)} className="min-h-0 flex-1" />
      <div className="bg-film-3 px-3 py-1 text-center text-[11px] text-white/40"><ReferenceText message="Synthetic images for demonstration. Not for diagnostic use." /></div>
    </div>
  );
}
