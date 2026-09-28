"use client";

import { ArrowLeft, MessageSquare, Paperclip, PenSquare, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Button, Card, Empty, ErrorNote, Field, Input, Modal, SearchInput, Select, Skeleton, Textarea, useToast } from "../ui";
import { useApi, useSchoolApi } from "../lib/api";
import { useLookups } from "../lib/lookups";
import { useSession } from "../lib/session";
import type { Thread } from "../lib/types";
import { cn, isoDay } from "../lib/utils";
import { useFormat } from "../lib/format";
import { AttachmentFiles, AttachmentList, useAttachmentDraft } from "../lib/attachments";
import { FilePicker } from "@pepbits/ops-ui";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';



export function MessagesPage() {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate, fmtTime } = useFormat();
  const when = (iso: string) => (isoDay(new Date(iso)) === isoDay(new Date()) ? fmtTime(iso) : fmtDate(iso, { day: "2-digit", month: "short" }));
  const api = useSchoolApi();
  const { role } = useSession();
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi<Thread[]>(`/threads?owner=${encodeURIComponent(role)}`);
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const files = useAttachmentDraft("message");
  const [typing, setTyping] = useState(false);
  const [composing, setComposing] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const threads = useMemo(() => [...(data ?? [])].filter((t) => !q || `${t.with} ${t.subject}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.messages.at(-1)?.at ?? "").localeCompare(a.messages.at(-1)?.at ?? "")), [data, q]);
  const t = threads.find((x) => x.id === sel) ?? null;
  useEffect(() => { if (!sel && threads[0] && window.innerWidth >= 1024) setSel(threads[0].id); }, [threads, sel]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [t?.messages.length, typing]);
  useEffect(() => { if (t && t.unread) { setData((d) => d?.map((x) => (x.id === t.id ? { ...x, unread: 0 } : x)) ?? d); api.patch(`/threads/${t.id}`, { unread: 0 }).catch(() => {}); } }, [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (id: string, fn: (t: Thread) => Thread) => setData((d) => d?.map((x) => (x.id === id ? fn(x) : x)) ?? d);
  /* The thread shown is the server's: the draft and earlier messages stay until PATCH succeeds, and any reply the
     school system adds arrives in the returned thread. The typing indicator is the pending request itself. */
  const send = async () => {
    if (!t || (!draft.trim() && !files.attachments.length) || !files.ready || typing) return;
    const msg = { id: `m-${crypto.randomUUID()}`, from: "me" as const, text: draft.trim(), at: new Date().toISOString(), ...(files.attachments.length ? { attachments: files.attachments } : {}) };
    setTyping(true);
    try {
      const { data } = await api.patch<{ data: Thread }>(`/threads/${t.id}`, { messages: [...t.messages, msg] });
      update(t.id, () => data);
      setDraft(""); files.clear();
    } catch (e) { toast(referenceT("Message not sent — {value0}", { value0: (e as Error).message }), "error"); } finally { setTyping(false); }
  };

  return (
    <Card className="grid h-full min-h-[540px] overflow-hidden lg:grid-cols-[320px_1fr]">
      <div className={cn("flex min-h-0 flex-col border-r border-line", t && "max-lg:hidden")}>
        <div className="flex gap-2 border-b border-line p-2">
          <SearchInput value={q} onChange={setQ} placeholder={referenceT("Search conversations")} aria-label={referenceT("Search conversations")} className="flex-1" />
          <Button variant="primary" icon={PenSquare} onClick={() => setComposing(true)} aria-label={referenceT("New message")} />
        </div>
        {error && <div className="p-2"><ErrorNote message={error} onRetry={reload} /></div>}
        <ul className="min-h-0 flex-1 divide-y divide-line/70 overflow-y-auto">
          {loading && !data && Array.from({ length: 5 }).map((_, i) => <li key={i} className="p-3"><Skeleton className="h-10" /></li>)}
          {threads.map((x) => { const last = x.messages.at(-1); return (
            <li key={x.id}>
              <button type="button" onClick={() => setSel(x.id)} className={cn("flex w-full gap-2.5 px-3 py-2 text-left", sel === x.id ? "bg-brand/[0.07]" : "hover:bg-subtle")}>
                <Avatar name={x.with} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1"><p className={cn("truncate text-xs", x.unread ? "font-semibold" : "font-medium")}>{x.with}</p><span className="ml-auto shrink-0 text-[10px] text-faint">{last && when(last.at)}</span></div>
                  <p className="truncate text-[11px] font-medium text-muted">{x.subject}</p>
                  <div className="flex items-center gap-1"><p className="truncate text-[11px] text-faint">{last?.from === "me" && referenceT("You: ")}{last?.text}</p>{x.unread > 0 && <span className="ml-auto rounded-full bg-brand px-1.5 text-[10px] font-semibold text-brand-fg">{x.unread}</span>}</div>
                </div>
              </button>
            </li>
          ); })}
          {data && threads.length === 0 && <Empty icon={MessageSquare} title={referenceT("No conversations")} />}
        </ul>
      </div>
      <div className={cn("flex min-h-0 flex-col", !t && "max-lg:hidden")}>
        {!t ? <Empty icon={MessageSquare} title={referenceT("Select a conversation")} text="Or start a new one with the pencil button." /> : (
          <>
            <div className="flex items-center gap-2.5 border-b border-line px-3 py-2">
              <Button size="xs" variant="ghost" icon={ArrowLeft} className="lg:hidden" onClick={() => setSel(null)} aria-label={referenceT("Back")} />
              <Avatar name={t.with} size={32} />
              <div className="min-w-0"><p className="truncate text-xs font-semibold">{t.with}</p><p className="truncate text-[11px] text-muted">{t.withRole} · {t.subject}</p></div>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-subtle/40 p-3">
              {t.messages.map((m, i) => {
                const day = isoDay(new Date(m.at));
                const newDay = i === 0 || isoDay(new Date(t.messages[i - 1]!.at)) !== day;
                return (
                  <div key={m.id}>
                    {newDay && <p className="my-2 text-center text-[10px] text-faint">{fmtDate(m.at, { weekday: "long", day: "numeric", month: "short" })}</p>}
                    <div className={cn("flex", m.from === "me" && "justify-end")}>
                      <div className={cn("max-w-[75%] rounded-2xl px-3 py-1.5 text-[12.5px] shadow-xs", m.from === "me" ? "rounded-br-sm bg-brand text-brand-fg" : "rounded-bl-sm border border-line bg-surface")}>
                        <p className="whitespace-pre-wrap">{m.text}</p>
                        <AttachmentList attachments={m.attachments} className="mt-1" />
                        <p className={cn("mt-0.5 text-right text-[9.5px]", m.from === "me" ? "opacity-70" : "text-faint")}>{fmtTime(m.at)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {typing && <div className="flex"><div className="flex gap-1 rounded-2xl border border-line bg-surface px-3 py-2.5">{[0, 1, 2].map((k) => <span key={k} className="size-1.5 animate-bounce rounded-full bg-faint" style={{ animationDelay: `${k * 120}ms` }} />)}</div></div>}
              <div ref={end} />
            </div>
            {files.items.length > 0 && <div className="border-t border-line px-2 pt-2"><AttachmentFiles draft={files} /></div>}
            <div className="flex items-end gap-2 border-t border-line p-2">
              <FilePicker label={referenceT("Attach")} variant="ghost" icon={<Paperclip className="size-4" />} onFile={(file) => void files.add(file)} />
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={referenceT("Write a message — Enter to send, Shift+Enter for a new line")} className="max-h-32 min-h-9 resize-none" rows={1} />
              <Button variant="primary" icon={Send} disabled={(!draft.trim() && !files.attachments.length) || !files.ready} loading={typing} onClick={send} aria-label={referenceT("Send")} />
            </div>
          </>
        )}
      </div>
      <Compose open={composing} onClose={() => setComposing(false)} onCreated={(th) => { setData((d) => [th, ...(d ?? [])]); setSel(th.id); }} />
    </Card>
  );
}

function Compose({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (t: Thread) => void }) {
 const referenceT = useReferenceLocalization().t;

  const api = useSchoolApi();
  const { role } = useSession();
  const { teachers } = useLookups();
  const toast = useToast();
  /* Office contacts (principal, finance, library…) come from the school directory; teachers from lookups. */
  const { data: contacts } = useApi<{ name: string; role: string }[]>(open ? "/contacts" : null);
  const people = [...(contacts ?? []), ...teachers.slice(0, 20).map((t) => ({ name: t.name, role: `${t.designation} · ${t.department}` }))]
    .filter((p, i, all) => all.findIndex((x) => x.name === p.name) === i);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const p = people.find((x) => x.name === to)!;
    setBusy(true);
    try {
      const { data } = await api.post<{ data: Thread }>("/threads", { owner: role, with: p.name, withRole: p.role, subject, unread: 0, messages: [{ id: "m1", from: "me", text: body, at: new Date().toISOString() }] });
      onCreated(data); toast(referenceT("Message sent to {value0}", { value0: p.name })); onClose(); setTo(""); setSubject(""); setBody("");
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={referenceT("New message")} footer={<><Button variant="ghost" onClick={onClose}><ReferenceText message="Cancel" /></Button><Button variant="primary" icon={Send} disabled={!to || !subject.trim() || !body.trim()} loading={busy} onClick={save}><ReferenceText message="Send" /></Button></>}>
      <div className="grid gap-3">
        <Field label={referenceT("To")}><Select value={to} onChange={(e) => setTo(e.target.value)}><option value=""><ReferenceText message="Choose a recipient" /></option>{people.map((p) => <option key={p.name} value={p.name}>{p.name} — {p.role}</option>)}</Select></Field>
        <Field label={referenceT("Subject")}><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label={referenceT("Message")}><Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-28" /></Field>
      </div>
    </Modal>
  );
}
