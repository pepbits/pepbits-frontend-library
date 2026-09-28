"use client";

import { BookMarked, BookOpen, BookPlus, BookUp, Clock, Coins, Library, RefreshCw, Star, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, Badge, Button, Card, CardGrid, DataTable, Empty, ErrorNote, Field, Input, Kpi, Modal, SearchInput, Segmented, Select, Skeleton, statusTone, Tabs, type Column, useToast } from "../ui";
import { useApi, useSchoolApi } from "../lib/api";
import { useSession } from "../lib/session";
import type { Book, BookIssue, Student, Teacher } from "../lib/types";
import { addDays, cn, isoDay, toDate } from "../lib/utils";
import { useFormat } from "../lib/format";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const FINE_PER_DAY = 0.5;
const lateDays = (i: BookIssue) => i.returnedOn ? 0 : Math.max(0, Math.floor((Date.now() - new Date(i.dueOn + "T23:59:59").getTime()) / 864e5) + 1);
const fineOf = (i: BookIssue) => i.fine || lateDays(i) * FINE_PER_DAY;

type Tab = "catalogue" | "circulation" | "mine" | "overdue";

export function LibraryPage() {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate, fmtShort, fmtMoney } = useFormat();
  const api = useSchoolApi();
  const { role, user } = useSession();
  const staff = role === "librarian" || role === "admin";
  const toast = useToast();
  const { data: books, error, reload, setData: setBooks } = useApi<Book[]>("/books");
  const { data: issues, setData: setIssues } = useApi<BookIssue[]>(staff ? "/issues?sort=issuedOn&order=desc" : `/issues?memberId=${encodeURIComponent(user.id)}`);
  const [tab, setTab] = useState<Tab>("catalogue");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [avail, setAvail] = useState(false);
  const [issuing, setIssuing] = useState<Book | null>(null);
  const [adding, setAdding] = useState(false);

  const cats = [...new Set((books ?? []).map((b) => b.category))].sort();
  const shown = useMemo(() => (books ?? []).filter((b) => (!cat || b.category === cat) && (!avail || b.available > 0) && (!q || `${b.title} ${b.author} ${b.isbn}`.toLowerCase().includes(q.toLowerCase()))), [books, cat, avail, q]);
  const out = (issues ?? []).filter((i) => i.status !== "Returned");
  const overdue = out.filter((i) => lateDays(i) > 0);
  const mine = (issues ?? []).filter((i) => i.memberId === user.id);

  /* The returned issue is the record: its fine is the server's (fineOf is only the live overdue estimate shown
     before return). Stock is re-read from the server, never adjusted here, so a repeated or idempotent return
     cannot inflate the available count. */
  const returnBook = async (i: BookIssue) => {
    try {
      const { data } = await api.patch<{ data: BookIssue }>(`/issues/${i.id}`, { action: "return" });
      setIssues((x) => x?.map((y) => (y.id === i.id ? data : y)) ?? x);
      reload();
      toast(data.fine ? referenceT("“{value0}” returned · fine {value1} added to {value2}'s account", { value0: data.bookTitle, value1: fmtMoney(data.fine), value2: data.memberName }) : referenceT("“{value0}” returned on time", { value0: data.bookTitle }));
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const renew = async (i: BookIssue) => {
    if (lateDays(i) > 0) return toast("Overdue books can't be renewed online. Please visit the library desk.", "error");
    const dueOn = isoDay(addDays(toDate(i.dueOn), 7));
    try {
      const { data } = await api.patch<{ data: BookIssue }>(`/issues/${i.id}`, { dueOn });
      setIssues((x) => x?.map((y) => (y.id === i.id ? data : y)) ?? x);
      toast(referenceT("Renewed until {value0}", { value0: fmtDate(dueOn) }));
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const reserve = async (b: Book) => {
    try {
      await api.post("/reservations", { bookId: b.id, memberId: user.id });
      toast(b.available ? referenceT("“{value0}” reserved — collect from shelf {value1} within 48 hours", { value0: b.title, value1: b.shelf }) : referenceT("You're on the waitlist for “{value0}”. We'll notify you when a copy is returned.", { value0: b.title }));
    } catch (e) { toast((e as Error).message, "error"); }
  };

  const tabs = [
    { value: "catalogue" as Tab, label: "Catalogue", count: books?.length },
    ...(staff ? [{ value: "circulation" as Tab, label: "Circulation", count: out.length }, { value: "overdue" as Tab, label: "Overdue & fines", count: overdue.length }] : [{ value: "mine" as Tab, label: "My books", count: mine.filter((i) => i.status !== "Returned").length }]),
  ];

  const issueCols: Column<BookIssue>[] = [
    { key: "bookTitle", header: "Book", cell: (i) => <span className="block max-w-64 truncate font-medium">{i.bookTitle}</span> },
    { key: "memberName", header: "Member", cell: (i) => <span className="flex items-center gap-1.5"><Avatar name={i.memberName} size={20} />{i.memberName}<span className="text-[10px] text-muted">{i.memberType}</span></span> },
    { key: "issuedOn", header: "Issued", cell: (i) => fmtShort(i.issuedOn) },
    { key: "dueOn", header: "Due", cell: (i) => <span className={cn(lateDays(i) > 0 && "font-semibold text-bad")}>{fmtShort(i.dueOn)}</span> },
    { key: "late", header: "Days late", value: (i) => lateDays(i), cell: (i) => (lateDays(i) ? <span className="text-bad tabular">{lateDays(i)}</span> : <span className="text-faint">—</span>) },
    { key: "fine", header: "Fine", value: (i) => fineOf(i), cell: (i) => (fineOf(i) ? fmtMoney(fineOf(i)) : "—") },
    { key: "status", header: "Status", value: (i) => (lateDays(i) > 0 ? "Overdue" : i.status), cell: (i) => <Badge tone={statusTone(lateDays(i) > 0 ? "Overdue" : i.status)}>{lateDays(i) > 0 ? referenceT("Overdue") : i.status}</Badge> },
    { key: "act", header: "", sortable: false, cell: (i) => i.status !== "Returned" && <Button size="xs" icon={Undo2} onClick={(e) => { e.stopPropagation(); returnBook(i); }}><ReferenceText message="Return" /></Button> },
  ];

  return (
    <div className="flex h-full min-h-[560px] flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi icon={Library} label={referenceT("Titles")} value={books?.length ?? "…"} sub={referenceT("{value0} copies", {value0: books?.reduce((a, b) => a + b.copies, 0) ?? "…"})} />
        <Kpi icon={BookOpen} label={referenceT("Available now")} tone="ok" value={books?.reduce((a, b) => a + b.available, 0) ?? "…"} sub={referenceT("copies on shelf")} />
        {staff ? <>
          <Kpi icon={BookUp} label={referenceT("Out on loan")} tone="info" value={out.length} sub={referenceT("14-day loans")} />
          <Kpi icon={Coins} label={referenceT("Fines accruing")} tone="bad" value={fmtMoney(overdue.reduce((a, i) => a + fineOf(i), 0))} sub={referenceT("{value0} overdue · {value1}/day", {value0: overdue.length, value1: fmtMoney(FINE_PER_DAY)})} />
        </> : <>
          <Kpi icon={BookMarked} label={referenceT("Books with you")} tone="info" value={mine.filter((i) => i.status !== "Returned").length} sub={referenceT("limit 3")} />
          <Kpi icon={Clock} label={referenceT("Next due")} tone="warn" value={mine.filter((i) => i.status !== "Returned").sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0] ? fmtShort(mine.filter((i) => i.status !== "Returned").sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0]!.dueOn) : "—"} />
        </>}
      </div>
      <Card className="flex flex-wrap items-center gap-2 p-2">
        <Tabs value={tab} onChange={setTab} items={tabs} />
        {tab === "catalogue" && <>
          <SearchInput value={q} onChange={setQ} placeholder={referenceT("Title, author or ISBN")} aria-label={referenceT("Title, author or ISBN")} className="w-60" />
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-36" aria-label={referenceT("Category")}><option value=""><ReferenceText message="All categories" /></option>{cats.map((c) => <option key={c}>{c}</option>)}</Select>
          <Button variant={avail ? "subtle" : "secondary"} onClick={() => setAvail((a) => !a)}><ReferenceText message="Available only" /></Button>
          {staff && <Button variant="primary" icon={BookPlus} className="ml-auto" onClick={() => setAdding(true)}><ReferenceText message="Add book" /></Button>}
        </>}
      </Card>
      {error && <ErrorNote message={error} onRetry={reload} />}

      {tab === "catalogue" && (!books ? <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
        : shown.length === 0 ? <Card><Empty icon={Library} title={referenceT("No books match")} /></Card> : (
          <CardGrid className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {shown.map((b) => (
              <Card key={b.id} className="flex flex-col overflow-hidden">
                <div className="relative flex h-24 flex-col justify-end p-2 text-white" style={{ background: `linear-gradient(135deg, ${b.cover}, ${b.cover}cc)` }}>
                  <span className="absolute inset-y-0 left-2 w-px bg-white/25" />
                  <p className="line-clamp-2 pl-2 text-[13px] leading-tight font-semibold">{b.title}</p>
                  <p className="truncate pl-2 text-[10.5px] opacity-80">{b.author}</p>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-2 text-[11px]">
                  <div className="flex items-center gap-1 text-muted"><span>{b.category}</span><span>· {b.year}</span><span className="ml-auto flex items-center gap-0.5"><Star className="size-3 fill-warn text-warn" />{b.rating}</span></div>
                  <div className="flex items-center gap-1"><span className={cn("font-medium", b.available ? "text-ok" : "text-bad")}>{b.available ? referenceT("{value0} of {value1} available", { value0: b.available, value1: b.copies }) : referenceT("All copies out")}</span><span className="ml-auto text-faint"><ReferenceText message="Shelf" /> {b.shelf}</span></div>
                  <div className="mt-auto pt-1">
                    {staff ? <Button size="xs" variant="subtle" className="w-full" disabled={!b.available} onClick={() => setIssuing(b)}><ReferenceText message="Issue" /></Button>
                      : <Button size="xs" variant={b.available ? "subtle" : "secondary"} className="w-full" onClick={() => reserve(b)}>{b.available ? referenceT("Reserve") : referenceT("Join waitlist")}</Button>}
                  </div>
                </div>
              </Card>
            ))}
          </CardGrid>
        ))}

      {(tab === "circulation" || tab === "overdue") && (
        <DataTable className="min-h-0 flex-1" rows={issues ? (tab === "overdue" ? overdue : issues) : null} loading={!issues} columns={issueCols} exportName={tab} searchPlaceholder="Search book or member" />
      )}

      {tab === "mine" && (
        <Card>
          {mine.length === 0 ? <Empty icon={BookMarked} title={referenceT("You haven't borrowed any books yet")} text="Reserve a book from the catalogue and collect it at the library desk." /> : (
            <ul className="divide-y divide-line/70">
              {mine.map((i) => {
                const b = books?.find((x) => x.id === i.bookId);
                const late = lateDays(i);
                return (
                  <li key={i.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="h-10 w-7 shrink-0 rounded-sm" style={{ background: b?.cover ?? "#888" }} />
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{i.bookTitle}</p><p className="text-[11px] text-muted">{b?.author} <ReferenceText message="· issued" /> {fmtDate(i.issuedOn)}</p></div>
                    {i.status === "Returned" ? <Badge tone="ok"><ReferenceText message="Returned" /> {fmtShort(i.returnedOn!)}</Badge> : <>
                      <span className={cn("text-[11px]", late ? "font-semibold text-bad" : "text-muted")}>{late ? referenceT("{value0} days overdue · fine {value1}", { value0: late, value1: fmtMoney(late * FINE_PER_DAY) }) : referenceT("Due {value0}", { value0: fmtDate(i.dueOn) })}</span>
                      <Button size="xs" icon={RefreshCw} onClick={() => renew(i)}><ReferenceText message="Renew" /></Button>
                    </>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {issuing && <IssueModal book={issuing} onClose={() => setIssuing(null)} onIssued={(i) => { setIssues((x) => [i, ...(x ?? [])]); reload(); /* stock comes from the server */ }} />}
      <AddBook open={adding} onClose={() => setAdding(false)} onAdded={(b) => setBooks((x) => [b, ...(x ?? [])])} />
    </div>
  );
}

function IssueModal({ book, onClose, onIssued }: { book: Book; onClose: () => void; onIssued: (i: BookIssue) => void }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate } = useFormat();
  const api = useSchoolApi();
  const toast = useToast();
  const [type, setType] = useState<"Student" | "Teacher">("Student");
  const { data: students } = useApi<Student[]>(type === "Student" ? "/students?status=Active" : null);
  const { data: teachers } = useApi<Teacher[]>(type === "Teacher" ? "/teachers" : null);
  const [q, setQ] = useState("");
  const [member, setMember] = useState<{ id: string; name: string; sub: string } | null>(null);
  const [days, setDays] = useState("14");
  const [busy, setBusy] = useState(false);
  const pool = (type === "Student" ? (students ?? []).map((s) => ({ id: s.id, name: s.name, sub: s.admissionNo })) : (teachers ?? []).map((t) => ({ id: t.id, name: t.name, sub: t.empId })));
  const matches = q.length < 2 ? [] : pool.filter((m) => `${m.name} ${m.sub}`.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  const due = isoDay(addDays(new Date(), Number(days)));
  const issue = async () => {
    if (!member) return;
    setBusy(true);
    try {
      const { data } = await api.post<{ data: BookIssue }>("/issues", { bookId: book.id, memberId: member.id, memberName: member.name, memberType: type, issuedOn: isoDay(new Date()), dueOn: due });
      onIssued(data); toast(referenceT("“{value0}” issued to {value1} until {value2}", { value0: book.title, value1: member.name, value2: fmtDate(due) })); onClose();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={referenceT("Issue “{value0}”", {value0: book.title})} sub={referenceT("{value0} of {value1} copies available · shelf {value2}", {value0: book.available, value1: book.copies, value2: book.shelf})}
      footer={<><Button variant="ghost" onClick={onClose}><ReferenceText message="Cancel" /></Button><Button variant="primary" disabled={!member} loading={busy} onClick={issue}><ReferenceText message="Issue book" /></Button></>}>
      <div className="grid gap-3">
        <Segmented label={referenceT("Borrower type")} value={type} onChange={(v) => { setType(v as "Student" | "Teacher"); setMember(null); setQ(""); }} options={[{ value: "Student", label: "Student" }, { value: "Teacher", label: "Teacher" }]} />
        {member ? (
          <div className="flex items-center gap-2 rounded-md border border-brand/40 bg-brand/5 p-2 text-xs"><Avatar name={member.name} size={28} /><div className="flex-1"><p className="font-medium">{member.name}</p><p className="text-muted">{member.sub}</p></div><Button size="xs" variant="ghost" onClick={() => setMember(null)}><ReferenceText message="Change" /></Button></div>
        ) : (
          <div>
            <Field label={referenceT("Find {value0}", {value0: type.toLowerCase()})}><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={referenceT("Type a name or ID (2+ characters)")} autoFocus /></Field>
            <ul className="mt-1 divide-y divide-line/60 rounded-md border border-line empty:hidden">
              {matches.map((m) => <li key={m.id}><button type="button" className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-subtle" onClick={() => setMember(m)}><Avatar name={m.name} size={22} />{m.name}<span className="ml-auto text-muted">{m.sub}</span></button></li>)}
            </ul>
          </div>
        )}
        <Field label={referenceT("Loan period")} hint={referenceT("Due back {value0}", {value0: fmtDate(due)})}><Select value={days} onChange={(e) => setDays(e.target.value)}>{[7, 14, 21, 30].map((d) => <option key={d} value={d}>{d} <ReferenceText message="days" /></option>)}</Select></Field>
      </div>
    </Modal>
  );
}

function AddBook({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (b: Book) => void }) {
 const referenceT = useReferenceLocalization().t;

  const api = useSchoolApi();
  const toast = useToast();
  const [f, setF] = useState({ title: "", author: "", isbn: "", category: "Fiction", publisher: "", year: String(new Date().getFullYear()), copies: "3", shelf: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const isbnOk = /^[\d-]{10,17}$/.test(f.isbn);
  const valid = f.title.trim() && f.author.trim() && isbnOk && Number(f.copies) > 0;
  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.post<{ data: Book }>("/books", { ...f, year: Number(f.year), copies: Number(f.copies), shelf: f.shelf || "New" }); // available/rating/cover are server-initialized
      onAdded(data); toast(referenceT("“{value0}” added to the catalogue", { value0: f.title })); onClose();
      setF((x) => ({ ...x, title: "", author: "", isbn: "" }));
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={referenceT("Add book to catalogue")} footer={<><Button variant="ghost" onClick={onClose}><ReferenceText message="Cancel" /></Button><Button variant="primary" disabled={!valid} loading={busy} onClick={save}><ReferenceText message="Add book" /></Button></>}>
      <div className="grid grid-cols-4 gap-3">
        <Field label={referenceT("Title")} required className="col-span-3"><Input value={f.title} onChange={set("title")} autoFocus /></Field>
        <Field label={referenceT("Copies")} required><Input type="number" min={1} value={f.copies} onChange={set("copies")} /></Field>
        <Field label={referenceT("Author")} required className="col-span-2"><Input value={f.author} onChange={set("author")} /></Field>
        <Field label={referenceT("ISBN")} required error={f.isbn && !isbnOk ? "10–13 digits" : undefined} className="col-span-2"><Input value={f.isbn} onChange={set("isbn")} placeholder="978-0-00-000000-0" /></Field>
        <Field label={referenceT("Category")}><Select value={f.category} onChange={set("category")}>{["Fiction", "Classics", "Science", "History", "Biography", "Textbooks", "Computing", "Young adult", "Reference", "Arts", "Economics", "Psychology"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label={referenceT("Publisher")}><Input value={f.publisher} onChange={set("publisher")} /></Field>
        <Field label={referenceT("Year")}><Input type="number" value={f.year} onChange={set("year")} /></Field>
        <Field label={referenceT("Shelf")}><Input value={f.shelf} onChange={set("shelf")} placeholder={referenceT("C-4")} /></Field>
      </div>
    </Modal>
  );
}
