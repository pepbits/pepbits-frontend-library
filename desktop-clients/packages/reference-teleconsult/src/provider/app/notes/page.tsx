"use client";
import { LocalizedText } from "@pepbits/ops-ui";
import { SourceButton } from "../../../shared/controls";
import { Suspense, useEffect, useState } from "react";
import { useReferenceRouter as useRouter, useReferenceSearchParams as useSearchParams } from "@pepbits/reference-host";
import { Printer } from "lucide-react";
import type { AppointmentView, Encounter } from "../../../shared/types";
import { useApi } from "../../lib/hooks";
import { useSession } from "../../lib/session";
import { fullName, useTeleconsultFormat } from "../../lib/format";
import { providerPaths } from "../../routes";
import { Avatar, Badge, Button, Empty, Segmented, Spinner, cx } from "../../components/ui";
import { NoteView } from "../../components/NoteView";

type Row = { encounter: Encounter; appointment: AppointmentView };

function NotesInner() {
  const { fmtDate, fmtTime } = useTeleconsultFormat();
  const params = useSearchParams();
  const router = useRouter();
  const { staff } = useSession();
  const [filter, setFilter] = useState<"signed" | "draft">("signed");
  const list = useApi<Row[]>(`/api/encounters?status=${filter}`);
  const requested = params.get("appointment");
  const [selectedId, setSelectedId] = useState<string | null>(requested);
  // Opening a signed note from elsewhere changes ?appointment= while this page stays mounted.
  useEffect(() => { if (requested) setSelectedId(requested); }, [requested]);

  useEffect(() => {
    if (!selectedId && list.data?.length) setSelectedId(list.data[0].appointment.id);
  }, [list.data, selectedId]);

  const row = list.data?.find((r) => r.appointment.id === selectedId);

  return (
    <div className="mx-auto grid h-full max-w-[1400px] grid-cols-1 gap-4 p-3 sm:p-5 lg:grid-cols-[360px_1fr] [&>*]:min-w-0">
      <section className="flex min-h-[300px] flex-col rounded-lg border border-line bg-white shadow-panel">
        <header className="border-b border-line px-3 py-2.5">
          <Segmented value={filter} onChange={(v) => { setFilter(v); setSelectedId(null); }} options={[{ value: "signed", label: "Signed" }, { value: "draft", label: "Drafts" }]} />
        </header>
        <ul className="min-h-0 flex-1 overflow-y-auto scroll-thin">
          {list.loading && !list.data ? <Spinner /> : !list.data?.length ? <Empty title={filter === "signed" ? "No signed notes yet" : "No open drafts"} /> : list.data.map((r) => (
            <li key={r.encounter.id}>
              <SourceButton
                onClick={() => setSelectedId(r.appointment.id)}
                className={cx("flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left", selectedId === r.appointment.id ? "bg-pulse-50" : "hover:bg-canvas")}
              >
                <Avatar name={fullName(r.appointment.patient)} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{fullName(r.appointment.patient)}</span>
                  <span className="block truncate text-2xs text-ink-400">{r.appointment.reason}</span>
                </span>
                <span className="text-2xs text-ink-400 tabular">{fmtDate(r.appointment.start)}</span>
              </SourceButton>
            </li>
          ))}
        </ul>
      </section>
      <section className="min-h-[400px] overflow-y-auto rounded-lg border border-line bg-white p-5 shadow-panel scroll-thin">
        {!row ? (
          <Empty title="Choose a note to read" />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-start gap-3 border-b border-line pb-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">{fullName(row.appointment.patient)}</h2>
                <p className="text-sm text-ink-400">
                  {row.appointment.reason} · {fmtDate(row.appointment.start)} {fmtTime(row.appointment.start)} · {row.appointment.clinician.name}
                </p>
              </div>
              <div className="ml-auto flex gap-2">
                {row.encounter.status === "draft" ? (
                  <Button variant="primary" onClick={() => router.push(providerPaths.consult(row.appointment.id))}><LocalizedText message={"Continue note"} /></Button>
                ) : (
                  <>
                    <Badge className="bg-vital-50 text-vital-600"><LocalizedText message={"Signed"} /></Badge>
                    <Button size="sm" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}><LocalizedText message={"Print"} /></Button>
                  </>
                )}
              </div>
            </div>
            <NoteView enc={row.encounter} signer={staff.find((s) => s.id === row.encounter.signedBy)} />
          </>
        )}
      </section>
    </div>
  );
}

export default function NotesPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <NotesInner />
    </Suspense>
  );
}
