"use client";
import {TableHeader,TableRow,TableBody,LocalizedText,useLocalization} from "@pepbits/ops-ui";

import {ReferenceLink as Link} from "@pepbits/reference-host";
import { useParams } from "../../../../navigation";
import { useState } from "react";
import { CalendarPlus, Pencil, Phone, Mail, MapPin, ShieldAlert, UserRound } from "lucide-react";
import { useApi } from "../../../../lib/hooks";
import {STATUS,age,useMedslotFormat} from "../../../../lib/format";
import type { Patient, Status } from "../../../../lib/types";
import { useAuth } from "../../../../components/shell/auth";
import { Badge, Button, Drawer, Empty, ErrorNote, Panel, Segmented, Skeleton, StatusBadge, Table, Td, Th, cx } from "../../../../components/ui";
import { AppointmentDrawer } from "../../../../components/AppointmentDrawer";
import { PatientForm } from "../../../../components/PatientForm";

type Row = { id: number; ref_code: string; start_at: string; end_at: string; status: Status; reason: string; service_name: string; department_name: string; resources: string };

export default function PatientPage() {
  const { fmtDate, fmtDateTime } = useMedslotFormat();
  const { t: tr } = useLocalization();
  const { id } = useParams<{ id: string }>();
  const { can, settings } = useAuth();
  const { data: p, error, loading, reload } = useApi<Patient & { appointments: Row[] }>(`/patients/${id}`);
  const [edit, setEdit] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [tab, setTab] = useState<"upcoming" | "past" | "all">("upcoming");
  const now = settings.facility_now;

  if (loading && !p) return <div className="flex flex-col gap-4"><Skeleton className="h-28" /><Skeleton className="h-80" /></div>;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!p) return null;
  const upcoming = p.appointments.filter((a) => a.start_at >= now && ["requested", "scheduled", "confirmed"].includes(a.status)).reverse();
  const past = p.appointments.filter((a) => !upcoming.includes(a));
  const list = tab === "upcoming" ? upcoming : tab === "past" ? past : p.appointments;
  const stats = { visits: p.appointments.filter((a) => a.status === "completed").length, noShow: p.appointments.filter((a) => a.status === "no_show").length, cancelled: p.appointments.filter((a) => a.status === "cancelled").length };

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-start gap-5 rounded-xl border border-line bg-panel p-5">
        <span className="flex size-14 items-center justify-center rounded-full bg-scrub-soft text-lg font-semibold text-scrub">{p.first_name[0]}{p.last_name[0]}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{p.first_name} {p.last_name}</h1>
            {p.is_provisional ? <Badge tone="amber"><LocalizedText message="Unregistered: complete at the desk" /></Badge> : <Badge tone="green"><LocalizedText message="Registered" /></Badge>}
          </div>
          <p className="tabular mt-0.5 text-sm text-mute">{p.mrn}{p.dob ? tr(", born {value0} ({value1} y)", { value0: (fmtDate(p.dob)) ?? "", value1: (age(p.dob)) ?? "" }) : ""}{p.sex && p.sex !== "unknown" ? `, ${p.sex}` : ""}</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-2">
            <span className="inline-flex items-center gap-1.5"><Phone className="size-4 text-mute" /><span className="tabular">{p.phone}</span></span>
            {p.email && <span className="inline-flex items-center gap-1.5"><Mail className="size-4 text-mute" />{p.email}</span>}
            {p.address && <span className="inline-flex items-center gap-1.5"><MapPin className="size-4 text-mute" />{[p.address, p.city, p.postal_code].filter(Boolean).join(", ")}</span>}
            {p.emergency_contact_name && <span className="inline-flex items-center gap-1.5"><ShieldAlert className="size-4 text-mute" />{p.emergency_contact_name}, <span className="tabular">{p.emergency_contact_phone}</span></span>}
            {p.insurance_provider && <span className="inline-flex items-center gap-1.5"><UserRound className="size-4 text-mute" />{p.insurance_provider} {p.insurance_member_id}</span>}
          </div>
          <p className="mt-2 text-xs text-mute"><LocalizedText message="Messages:" />{" "}{[p.sms_opt_in && "SMS", p.email_opt_in && "Email", p.whatsapp_opt_in && "WhatsApp"].filter(Boolean).join(", ") || tr("none")}{p.consent_at ? tr(". Consent recorded {value0}.", { value0: (fmtDateTime(p.consent_at)) ?? "" }) : ""}</p>
        </div>
        <div className="flex gap-2">
          {can("admin", "scheduler") && <Button icon={<Pencil className="size-4" />} onClick={() => setEdit(true)}>{p.is_provisional ? tr("Complete registration") : tr("Edit")}</Button>}
          {can("admin", "scheduler") && <Link href={`/book?patient_id=${p.id}`}><Button variant="primary" icon={<CalendarPlus className="size-4" />}><LocalizedText message="Book" /></Button></Link>}
        </div>
      </section>

      <div className="grid grid-cols-3 gap-3 sm:max-w-lg">
        {([["Completed visits", stats.visits, ""], ["No-shows", stats.noShow, stats.noShow > 1 ? "text-triage" : ""], ["Cancelled", stats.cancelled, ""]] as const).map(([l, v, c]) => (
          <div key={l} className="rounded-xl border border-line bg-panel px-4 py-3"><p className="text-xs text-mute">{l}</p><p className={cx("tabular text-xl font-semibold", c)}>{v}</p></div>
        ))}
      </div>

      <Panel title="Appointments" flush actions={<Segmented size="sm" value={tab} onChange={setTab} options={[["upcoming", `Upcoming (${upcoming.length})`], ["past", `Past (${past.length})`], ["all", "All"]]} />}>
        {list.length === 0 ? <Empty title={tab === "upcoming" ? tr("Nothing booked") : tr("No appointments")}>{tab === "upcoming" && tr("Use Book to schedule the next visit.")}</Empty> : (
          <Table>
            <TableHeader><TableRow><Th><LocalizedText message="When" /></Th><Th><LocalizedText message="Service" /></Th><Th><LocalizedText message="With" /></Th><Th><LocalizedText message="Reason" /></Th><Th><LocalizedText message="Status" /></Th><Th className="text-right"><LocalizedText message="Ref" /></Th></TableRow></TableHeader>
            <TableBody>
              {list.map((a) => (
                <TableRow key={a.id} onClick={() => setOpenId(a.id)} className="cursor-pointer hover:bg-scrub-soft/30">
                  <Td className="tabular whitespace-nowrap">{fmtDateTime(a.start_at)}</Td>
                  <Td>{a.service_name}<span className="block text-xs text-mute">{a.department_name}</span></Td>
                  <Td className="text-ink-2">{a.resources}</Td>
                  <Td className="max-w-xs truncate text-ink-2">{a.reason}</Td>
                  <Td><StatusBadge status={a.status} /></Td>
                  <Td className={cx("tabular text-right text-xs", STATUS[a.status] ? "text-mute" : "")}>{a.ref_code}</Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Drawer open={edit} onClose={() => setEdit(false)} title={p.is_provisional ? tr("Complete registration") : tr("Edit patient")}
        subtitle={p.is_provisional ? tr("Add date of birth, address and an emergency contact to turn this temporary record into a full registration.") : undefined}>
        <PatientForm patient={p} onSaved={() => { setEdit(false); reload(); }} />
      </Drawer>
      <AppointmentDrawer id={openId} onClose={() => setOpenId(null)} onChanged={(nid) => { reload(); if (nid) setOpenId(nid); }} />
    </div>
  );
}
