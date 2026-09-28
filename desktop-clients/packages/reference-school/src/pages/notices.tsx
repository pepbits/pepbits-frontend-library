"use client";

import { Megaphone, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, Badge, Button, Card, CardGrid, Checkbox, ConfirmDialog, Empty, ErrorNote, Field, Input, Modal, SearchInput, Select, Skeleton, statusTone, Tabs, Textarea, useToast } from "../ui";
import { useApi, useSchoolApi } from "../lib/api";
import { useSession } from "../lib/session";
import type { Notice, Role } from "../lib/types";
import { cn, isoDay } from "../lib/utils";
import { useFormat } from "../lib/format";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const AUDIENCE: Record<Role, Notice["audience"][]> = {
  admin: ["All", "Students", "Teachers", "Parents", "Staff"], teacher: ["All", "Teachers", "Staff", "Students"], student: ["All", "Students"],
  parent: ["All", "Parents"], librarian: ["All", "Staff"], accountant: ["All", "Staff"],
};

export function NoticesPage() {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate } = useFormat();
  const api = useSchoolApi();
  const { role, user } = useSession();
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi<Notice[]>("/notices?sort=date&order=desc");
  const [q, setQ] = useState("");
  const [aud, setAud] = useState<string>("all");
  const [sel, setSel] = useState<string | null>(null);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const canPost = role === "admin" || role === "teacher";

  const visible = useMemo(() => (data ?? [])
    .filter((n) => AUDIENCE[role].includes(n.audience) && (aud === "all" || n.audience === aud) && (!q || `${n.title} ${n.body}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date)), [data, role, aud, q]);
  const current = visible.find((n) => n.id === sel) ?? visible[0];
  const open = (n: Notice) => { setSel(n.id); setRead((r) => new Set(r).add(n.id)); };

  const [deleting, setDeleting] = useState<Notice | null>(null);
  const togglePin = async (n: Notice) => {
    try {
      const { data: s } = await api.patch<{ data: Notice }>(`/notices/${n.id}`, { pinned: !n.pinned });
      setData((d) => d?.map((x) => (x.id === n.id ? s : x)) ?? d);
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const remove = async (n: Notice) => {
    setDeleting(null);
    try {
      await api.del(`/notices/${n.id}`);
      setData((d) => d?.filter((x) => x.id !== n.id) ?? d); setSel(null); toast("Notice deleted");
    } catch (e) { toast((e as Error).message, "error"); }
  };

  return (
    <CardGrid className="grid h-full min-h-[540px] gap-2.5 lg:grid-cols-12">
      <Card className="flex min-h-0 flex-col lg:col-span-5">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-2">
          <SearchInput value={q} onChange={setQ} placeholder={referenceT("Search notices")} aria-label={referenceT("Search notices")} className="min-w-40 flex-1" />
          {canPost && <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}><ReferenceText message="Post" /></Button>}
          <Tabs size="xs" value={aud} onChange={setAud} items={[{ value: "all", label: "All" }, ...AUDIENCE[role].filter((a) => a !== "All").map((a) => ({ value: a, label: a }))]} />
        </div>
        {error && <div className="p-2"><ErrorNote message={error} onRetry={reload} /></div>}
        <ul className="min-h-0 flex-1 divide-y divide-line/70 overflow-y-auto">
          {loading && !data && Array.from({ length: 6 }).map((_, i) => <li key={i} className="p-3"><Skeleton className="h-10" /></li>)}
          {visible.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => open(n)} className={cn("flex w-full gap-2 px-3 py-2 text-left transition", current?.id === n.id ? "bg-brand/[0.07]" : "hover:bg-subtle")}>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", read.has(n.id) ? "bg-transparent" : "bg-brand")} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {n.pinned && <Pin className="size-3 shrink-0 text-brand" />}
                    <p className={cn("truncate text-xs", read.has(n.id) ? "font-medium" : "font-semibold")}>{n.title}</p>
                  </div>
                  <p className="line-clamp-1 text-[11px] text-muted">{n.body}</p>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-faint">
                    <span>{fmtDate(n.date, { day: "2-digit", month: "short" })}</span><span>· {n.postedBy}</span>
                    <span className="ml-auto flex gap-1">{n.priority !== "Normal" && <Badge tone={statusTone(n.priority)}>{n.priority}</Badge>}<Badge>{n.audience}</Badge></span>
                  </div>
                </div>
              </button>
            </li>
          ))}
          {data && visible.length === 0 && <Empty icon={Megaphone} title={referenceT("No notices")} />}
        </ul>
      </Card>
      <Card className="flex min-h-0 flex-col lg:col-span-7">
        {!current ? <Empty icon={Megaphone} title={referenceT("Select a notice")} /> : (
          <>
            <div className="flex items-start gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex gap-1.5">{current.pinned && <Badge tone="brand"><Pin className="size-3" /><ReferenceText message="Pinned" /></Badge>}<Badge tone={statusTone(current.priority)}>{current.priority}</Badge><Badge><ReferenceText message="For" /> {current.audience.toLowerCase()}</Badge></div>
                <h2 className="text-base font-semibold">{current.title}</h2>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted"><Avatar name={current.postedBy} size={18} />{current.postedBy} · {fmtDate(current.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
              {role === "admin" && <div className="flex gap-1">
                <Button size="xs" variant="ghost" icon={current.pinned ? PinOff : Pin} onClick={() => togglePin(current)} aria-label={referenceT("Pin")} />
                <Button size="xs" variant="ghost" icon={Trash2} onClick={() => setDeleting(current)} aria-label={referenceT("Delete")} />
              </div>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-[13px] leading-relaxed whitespace-pre-line">{current.body}</div>
            <div className="border-t border-line px-4 py-2 text-[11px] text-muted"><ReferenceText message="Posted by" /> {user.name === current.postedBy ? referenceT("you") : current.postedBy} <ReferenceText message="· questions go to the school office." /></div>
          </>
        )}
      </Card>
      <ConfirmDialog open={!!deleting} title={referenceT("Delete notice?")} message={deleting ? referenceT("Delete “{value0}”? Recipients will no longer see it.", { value0: deleting.title }) : ""} confirmLabel={referenceT("Delete")} tone="danger"
        onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting) remove(deleting); }} />
      <CreateNotice open={creating} onClose={() => setCreating(false)} onCreated={(n) => { setData((d) => [n, ...(d ?? [])]); setSel(n.id); toast(referenceT("Notice posted to {value0}", { value0: referenceT(n.audience) })); }} />
    </CardGrid>
  );
}

function CreateNotice({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (n: Notice) => void }) {
 const referenceT = useReferenceLocalization().t;

  const api = useSchoolApi();
  const toast = useToast();
  const { role, user } = useSession();
  // Teachers may only address students or parents, so their default audience must be one of those.
  const defaultAudience = role === "admin" ? "All" : "Students";
  const [f, setF] = useState({ title: "", body: "", audience: defaultAudience, priority: "Normal" });
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const valid = f.title.trim().length >= 4 && f.body.trim().length >= 10;
  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.post<{ data: Notice }>("/notices", { ...f, pinned, postedBy: user.name, date: isoDay(new Date()) });
      onCreated(data); onClose(); setF({ title: "", body: "", audience: defaultAudience, priority: "Normal" }); setPinned(false);
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={referenceT("Post a notice")} sub={referenceT("Recipients get an in-app notification and an email digest")}
      footer={<><Button variant="ghost" onClick={onClose}><ReferenceText message="Cancel" /></Button><Button variant="primary" disabled={!valid} loading={busy} onClick={save}><ReferenceText message="Post notice" /></Button></>}>
      <div className="grid grid-cols-3 gap-3">
        <Field label={referenceT("Title")} required className="col-span-3"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus /></Field>
        <Field label={referenceT("Audience")}><Select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>{(role === "admin" ? ["All", "Students", "Teachers", "Parents", "Staff"] : ["Students", "Parents"]).map((a) => <option key={a}>{a}</option>)}</Select></Field>
        <Field label={referenceT("Priority")}><Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{["Normal", "Important", "Urgent"].map((a) => <option key={a}>{a}</option>)}</Select></Field>
        {role === "admin" ? <Checkbox checked={pinned} onChange={(e) => setPinned(e.target.checked)} label={referenceT("Pin to top")} className="items-end self-end pb-2 text-xs" /> : <span />}
        <Field label={referenceT("Message")} required hint={referenceT("At least 10 characters")} className="col-span-3"><Textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className="min-h-32" /></Field>
      </div>
    </Modal>
  );
}
