'use client';
import {DiagnosticInput,DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { useApi, useFmt } from '../../../lib/client';
import { PageHeader, Empty } from '../../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const tone = (a: string) => /CANCEL|DELETE|REJECT|DEACTIVATE/.test(a) ? 'text-stat' : /CRITICAL/.test(a) ? 'text-crit' : /FINAL|AMEND|ADDENDUM|PRELIM/.test(a) ? 'text-petrol' : 'text-ink';

export default function Audit() {
 const referenceT = useReferenceLocalization().t;

 const fmt=useFmt();

  const [q, setQ] = useState('');
  const { data } = useApi<any[]>(`/api/audit${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title={referenceT("Audit trail")} subtitle={referenceT("Every clinical, financial and configuration action with who did it and when. Entries cannot be edited.")} />
      <div className="panel">
        <div className="border-b border-line p-3">
          <div className="relative max-w-md"><Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-ink-soft" /><DiagnosticInput className="field pl-9" placeholder={referenceT("Action, user, accession or detail")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={referenceT("Search audit trail")} /></div>
        </div>
        <div className="overflow-x-auto">
          <DiagnosticTable className="table-base">
            <TableHeader><TableRow><TableHead><ReferenceText message="Time" /></TableHead><TableHead><ReferenceText message="User" /></TableHead><TableHead><ReferenceText message="Action" /></TableHead><TableHead><ReferenceText message="Record" /></TableHead><TableHead><ReferenceText message="Detail" /></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data || []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap text-ink-3">{fmt.dateTime(a.at)}</TableCell>
                  <TableCell>{a.user_name || 'System'}</TableCell>
                  <TableCell className={`font-bold ${tone(a.action)}`}>{fmt.status(a.action)}</TableCell>
                  <TableCell>{a.entity === 'order' && a.accession ? <Link href={`/orders/${a.entity_id}`} className="id text-petrol hover:underline">{a.accession}</Link> : <span className="text-ink-soft">{a.entity} {a.entity_id}</span>}</TableCell>
                  <TableCell className="max-w-md"><span className="id line-clamp-2 break-all text-[11.5px] text-ink-soft">{a.details}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DiagnosticTable>
          {data && !data.length && <Empty title={referenceT("No audit entries match")} />}
        </div>
      </div>
    </div>
  );
}
