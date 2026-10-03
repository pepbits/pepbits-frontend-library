'use client';
import {DiagnosticSelect,DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line, Cell } from 'recharts';
import { useApi, useFmt } from '../../../lib/client';
import { PageHeader, Empty } from '../../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const tip = { borderRadius: 6, border: '1px solid #D8DEE3', fontSize: 13 };
const axis = { fontSize: 12, fill: '#5B6B7A' };

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return <div className="panel px-4 py-3"><div className="text-[13px] text-ink-soft">{label}</div><div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>{note && <div className="text-xs text-ink-soft">{note}</div>}</div>;
}

function TatTable({ rows, keyLabel }: { rows: any[]; keyLabel: string }) {
 const fmt=useFmt();

  return (
    <DiagnosticTable className="table-base">
      <TableHeader><TableRow><TableHead>{keyLabel}</TableHead><TableHead className="text-right"><ReferenceText message="Reports" /></TableHead><TableHead className="text-right"><ReferenceText message="Median report TAT" /></TableHead><TableHead className="text-right"><ReferenceText message="Mean report TAT" /></TableHead><TableHead className="text-right"><ReferenceText message="Order to final" /></TableHead><TableHead className="text-right"><ReferenceText message="Waiting room" /></TableHead><TableHead><ReferenceText message="Within target" /></TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.key}>
            <TableCell className="font-bold">{r.key}</TableCell>
            <TableCell className="text-right tabular-nums">{r.count}</TableCell>
            <TableCell className="text-right tabular-nums">{fmt.minutes(r.medianReportTat)}</TableCell>
            <TableCell className="text-right tabular-nums">{fmt.minutes(r.avgReportTat)}</TableCell>
            <TableCell className="text-right tabular-nums">{fmt.minutes(r.avgTotalTat)}</TableCell>
            <TableCell className="text-right tabular-nums">{fmt.minutes(r.avgWait)}</TableCell>
            <TableCell className="w-48">
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 rounded bg-line"><div className={`h-2 rounded ${r.compliance >= 90 ? 'bg-ok' : r.compliance >= 75 ? 'bg-urgent' : 'bg-stat'}`} style={{ width: `${r.compliance}%` }} /></div>
                <span className="w-10 text-right text-sm font-bold tabular-nums">{r.compliance}%</span>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </DiagnosticTable>
  );
}

export default function Analytics() {
 const referenceT = useReferenceLocalization().t;

 const fmt=useFmt();

  const [days, setDays] = useState(14);
  const { data } = useApi<any>(`/api/analytics?days=${days}`);
  const ov = data?.overall;
  const color = (c: number) => (c >= 90 ? '#1F7A4D' : c >= 75 ? '#A8630F' : '#B42318');

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title={referenceT("Turnaround and analytics")} subtitle={referenceT("Report turnaround runs from exam completion to final signature, measured against the TAT master for each priority and modality.")}
        actions={<DiagnosticSelect className="field w-40" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label={referenceT("Period")}>
          <option value={7}><ReferenceText message="Last 7 days" /></option><option value={14}><ReferenceText message="Last 14 days" /></option><option value={30}><ReferenceText message="Last 30 days" /></option><option value={90}><ReferenceText message="Last 90 days" /></option>
        </DiagnosticSelect>} />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label={referenceT("Final reports")} value={ov?.count ?? 0} />
        <Stat label={referenceT("Within TAT target")} value={ov ? `${ov.compliance}%` : '—'} />
        <Stat label={referenceT("Median report TAT")} value={fmt.minutes(ov?.medianReportTat)} />
        <Stat label={referenceT("Mean report TAT")} value={fmt.minutes(ov?.avgReportTat)} />
        <Stat label={referenceT("Mean order to final")} value={fmt.minutes(ov?.avgTotalTat)} />
        <Stat label={referenceT("Mean wait, arrival to scan")} value={fmt.minutes(ov?.avgWait)} />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="mb-3 font-bold"><ReferenceText message="Share of reports within target, by modality" /></h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data?.tatByModality || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8DEE3" />
                <XAxis dataKey="key" tick={axis} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} unit="%" tick={axis} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={tip} formatter={(v: any) => [`${v}%`, 'Within target']} cursor={{ fill: '#E3EEF4' }} />
                <Bar dataKey="compliance" radius={[3, 3, 0, 0]}>{(data?.tatByModality || []).map((r: any) => <Cell key={r.key} fill={color(r.compliance)} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel p-4">
          <h2 className="mb-3 font-bold"><ReferenceText message="Median report TAT by priority (minutes)" /></h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data?.tatByPriority || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#D8DEE3" />
                <XAxis type="number" tick={axis} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="key" tick={axis} axisLine={false} tickLine={false} width={70} />
                <Tooltip contentStyle={tip} formatter={(v: any) => [fmt.minutes(v), 'Median']} cursor={{ fill: '#E3EEF4' }} />
                <Bar dataKey="medianReportTat" fill="#1D4E6B" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="panel mb-5">
        <div className="border-b border-line px-4 py-3"><h2 className="font-bold"><ReferenceText message="By radiologist" /></h2></div>
        <div className="overflow-x-auto">{data?.tatByRadiologist?.length ? <TatTable rows={data.tatByRadiologist} keyLabel="Radiologist" /> : <Empty title={referenceT("No final reports in this period")} />}</div>
      </section>
      <section className="panel mb-5">
        <div className="border-b border-line px-4 py-3"><h2 className="font-bold"><ReferenceText message="By modality" /></h2></div>
        <div className="overflow-x-auto">{data?.tatByModality?.length ? <TatTable rows={data.tatByModality} keyLabel="Modality" /> : <Empty title={referenceT("No final reports in this period")} />}</div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="mb-3 font-bold"><ReferenceText message="Daily volume" /></h2>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={data?.volume || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8DEE3" />
                <XAxis dataKey="day" tick={axis} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={tip} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Line dataKey="ordered" name="Ordered" stroke="#1D4E6B" strokeWidth={2} dot={false} />
                <Line dataKey="finalized" name="Final reports" stroke="#1F7A4D" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel p-4">
          <h2 className="mb-3 font-bold"><ReferenceText message="Billed and collected by modality" /></h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data?.revenue || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8DEE3" />
                <XAxis dataKey="modality" tick={axis} axisLine={false} tickLine={false} />
                <YAxis tick={axis} axisLine={false} tickLine={false} width={56} tickFormatter={(v:number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip contentStyle={tip} formatter={(v: any) => fmt.money(v)} cursor={{ fill: '#E3EEF4' }} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="billed" name="Billed" fill="#8FB7CF" radius={[3, 3, 0, 0]} />
                <Bar dataKey="collected" name="Collected" fill="#1D4E6B" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
