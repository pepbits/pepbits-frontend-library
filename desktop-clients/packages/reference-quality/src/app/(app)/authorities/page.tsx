"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";

import { useEffect, useState } from "react";
import { Building2, Pencil, Plus } from "lucide-react";
import { useQualityApi } from "../../../lib/api";
import { useApi } from "../../../lib/hooks";
import { useAuth } from "../../../lib/auth";
import { Badge, Button, ErrorState, Field, Input, Loading, Modal, PageHeader, Panel, Select, Toggle } from "../../../components/ui";
import { useToast } from "../../../components/toast";
import { cls } from "../../../lib/format";
import { useQualityFormat } from "../../../lib/format";

interface Authority {
  id: number;
  code: string;
  name: string;
  jurisdiction: string;
  channel: string;
  endpoint: string | null;
  contact_email: string | null;
  programs: string[];
  active: number;
  active_schedules: number;
  submissions: number;
  last_submission: string | null;
}
const CHANNEL: Record<string, string> = { portal_upload: "Portal upload", sftp: "SFTP", api: "API", email: "Email" };

export default function AuthoritiesPage() {
  const { fmtRelative } = useQualityFormat();
  const { can, refreshMeta } = useAuth();
  const { data, error, loading, reload } = useApi<Authority[]>("/authorities");
  const [editing, setEditing] = useState<Authority | "new" | null>(null);

  return (
    <>
      <PageHeader
        title="Authorities"
        description="Regulators and other recipients that reports are submitted to, and how each one receives them. Delivery adapters are simulated in this demonstration; each transmission is logged with its channel and checksum."
        actions={
          can("authorities.manage") && (
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}><LocalizedText message="Add authority" /></Button>
          )
        }
      />
      {error && <ErrorState message={error} onRetry={reload} />}
      {!data && loading && <Loading rows={6} />}
      {data && (
        <Panel bodyClassName="p-0">
          <ul className="divide-y divide-line">
            {data.map((a) => (
              <li key={a.id} className={cls("flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center", !a.active && "opacity-60")}>
                <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                  <Building2 className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.name}</span>
                    <Badge>{a.code}</Badge>
                    {!a.active && <Badge tone="warn"><LocalizedText message="Inactive" /></Badge>}
                  </div>
                  <div className="mt-0.5 text-sm text-ink-2">
                    {a.jurisdiction}. {CHANNEL[a.channel] ? <LocalizedText message={CHANNEL[a.channel]} /> : a.channel}
                    {a.endpoint ? ` to ${a.endpoint}` : ""}.
                  </div>
                  <div className="mt-0.5 text-xs text-ink-3">
                    {a.programs.length ? <><LocalizedText message="Programmes: {value0}." values={{ value0: a.programs.join(", ") }} />{" "}</> : ""}
                    {a.contact_email ? <LocalizedText message="Contact {value0}." values={{ value0: a.contact_email }} /> : ""}
                  </div>
                </div>
                <div className="flex shrink-0 gap-8 text-sm">
                  <div>
                    <div className="text-xs text-ink-3"><LocalizedText message="Active schedules" /></div>
                    <div className="num font-medium">{a.active_schedules}</div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-3"><LocalizedText message="Submissions" /></div>
                    <div className="num font-medium">{a.submissions}</div>
                  </div>
                  <div className="w-28">
                    <div className="text-xs text-ink-3"><LocalizedText message="Last activity" /></div>
                    <div className="text-ink-2">{a.last_submission ? fmtRelative(a.last_submission) : <LocalizedText message="None" />}</div>
                  </div>
                </div>
                {can("authorities.manage") && (
                  <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(a)}><LocalizedText message="Edit" /></Button>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <AuthorityModal
        authority={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void reload();
          void refreshMeta();
        }}
      />
    </>
  );
}

function AuthorityModal({ authority, onClose, onSaved }: { authority: Authority | "new" | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useLocalization();
  const { api } = useQualityApi();
  const toast = useToast();
  const [f, setF] = useState({ code: "", name: "", jurisdiction: "", channel: "portal_upload", endpoint: "", contact_email: "", programs: "", active: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isNew = authority === "new";

  useEffect(() => {
    setErr(null);
    if (authority === "new") setF({ code: "", name: "", jurisdiction: "", channel: "portal_upload", endpoint: "", contact_email: "", programs: "", active: true });
    else if (authority)
      setF({ code: authority.code, name: authority.name, jurisdiction: authority.jurisdiction, channel: authority.channel, endpoint: authority.endpoint ?? "", contact_email: authority.contact_email ?? "", programs: authority.programs.join(", "), active: !!authority.active });
  }, [authority]);

  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setBusy(true);
    setErr(null);
    const body = { ...f, programs: f.programs.split(",").map((p) => p.trim()).filter(Boolean), endpoint: f.endpoint || null, contact_email: f.contact_email || null };
    try {
      if (isNew) await api("/authorities", { body });
      else await api(`/authorities/${(authority as Authority).id}`, { method: "PUT", body });
      toast("Saved {value0}.", "success", { value0: f.name });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!authority}
      onClose={onClose}
      title={isNew ? t("Add authority") : t("Edit {value0}", { value0: f.name })}
      footer={
        <>
          {err && <p className="mr-auto self-center text-sm text-bad">{err}</p>}
          <Button variant="ghost" onClick={onClose}><LocalizedText message="Cancel" /></Button>
          <Button variant="primary" loading={busy} onClick={save}><LocalizedText message="Save" /></Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Code">
          <Input value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="DOH" />
        </Field>
        <Field label="Name" className="sm:col-span-2">
          <Input value={f.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Jurisdiction">
          <Input value={f.jurisdiction} onChange={(e) => set("jurisdiction", e.target.value)} />
        </Field>
        <Field label="Channel">
          <Select value={f.channel} onChange={(e) => set("channel", e.target.value)}>
            {Object.entries(CHANNEL).map(([k, v]) => (
              <option key={k} value={k}>
                {t(v)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Programmes" hint="Comma separated">
          <Input value={f.programs} onChange={(e) => set("programs", e.target.value)} />
        </Field>
        <Field label="Endpoint" className="sm:col-span-2" hint="Portal URL, SFTP host or API base URL">
          <Input value={f.endpoint} onChange={(e) => set("endpoint", e.target.value)} />
        </Field>
        <Field label="Contact email">
          <Input type="email" value={f.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
        </Field>
        {!isNew && (
          <div className="sm:col-span-3">
            <Toggle checked={f.active} onChange={(v) => set("active", v)} label={f.active ? "Accepting submissions" : "Inactive"} />
          </div>
        )}
      </div>
    </Modal>
  );
}
