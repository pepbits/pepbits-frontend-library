"use client";
import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { ReferenceLink } from "@pepbits/reference-host";
import { useApi } from "../../lib/api";
import { cx } from "../../lib/cx";
import { humanize, useTenantFormat } from "../../lib/format";
import type { AuditEvent } from "../../lib/types";
import { tenantAdminPaths } from "../../routes";
import { useApp } from "../shell/context";
import { Avatar } from "../ui/Avatar";
import { Card, SourceButton, SourceSelect, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "../ui/controls";

const ACTION_LABEL: Record<string, string> = {
  CREATED: "Created", UPDATED: "Updated", SUBMITTED: "Submitted", APPROVED: "Approved", REJECTED: "Rejected", WITHDRAWN: "Withdrawn",
  RETIRED: "Retired", NEW_VERSION: "New version", DISCARDED: "Discarded", ACTIVATED: "Activated", DEACTIVATED: "Deactivated",
};
const ACTIONS = Object.keys(ACTION_LABEL);
const TONE: Record<string, string> = {
  APPROVED: "bg-jade-50 text-jade-700", ACTIVATED: "bg-jade-50 text-jade-700", SUBMITTED: "bg-saffron-50 text-saffron-700",
  REJECTED: "bg-madder-50 text-madder-700", RETIRED: "bg-madder-50 text-madder-700", DISCARDED: "bg-madder-50 text-madder-700", DEACTIVATED: "bg-madder-50 text-madder-700",
};

/** The append-only audit trail (`GET /audit`), filterable by page, action and person. */
export function ActivityLog() {
  const { meta, user, resource } = useApp();
  const { t } = useLocalization();
  const fmt = useTenantFormat();
  const [res, setRes] = useState("");
  const [action, setAction] = useState("");
  const [actorId, setActorId] = useState("");

  const path = useMemo(() => {
    const qs = new URLSearchParams({ limit: "300" });
    if (res) qs.set("resource", res);
    if (action) qs.set("action", action);
    if (actorId) qs.set("actor", actorId);
    return `/audit?${qs}`;
  }, [res, action, actorId]);
  const audit = useApi<AuditEvent[]>(path, { revalidateOnFocus: false });
  const rows = audit.data ?? null;
  const error = audit.error?.message ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-[13px] text-muted"><LocalizedText message="An append-only record of every configuration change, who made it and why." /></p>
        <SourceSelect className="input h-9 w-[230px]" value={res} onChange={(e) => setRes(e.target.value)} aria-label="Filter by page">
          <option value="">{t("All pages")}</option>
          {meta.categories.map((c) => (
            <optgroup key={c.key} label={c.label}>
              {meta.resources.filter((r) => r.category === c.key).map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </optgroup>
          ))}
        </SourceSelect>
        <SourceSelect className="input h-9 w-[160px]" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action">
          <option value="">{t("All actions")}</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{t(ACTION_LABEL[a])}</option>)}
        </SourceSelect>
        <SourceSelect className="input h-9 w-[180px]" value={actorId} onChange={(e) => setActorId(e.target.value)} aria-label="Filter by person">
          <option value="">{t("Everyone")}</option>
          {meta.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </SourceSelect>
        <SourceButton className="btn-ghost btn-sm" onClick={() => void audit.mutate()}><RefreshCw className="h-4 w-4" /> <LocalizedText message="Refresh" /></SourceButton>
      </div>
      <Card shadow="none" tone="transparent" className="panel min-h-0 flex-1 overflow-hidden">
        <TableContainer className="h-full">
          <Table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-[13px]">
            <TableHeader className="bg-mist text-[12px] text-muted">
              <TableRow>
                <TableHead scope="col" className="w-[150px] border-b border-line py-2.5 pl-5 pr-3 font-semibold"><LocalizedText message="When" /></TableHead>
                <TableHead scope="col" className="w-[200px] border-b border-line px-3 py-2.5 font-semibold"><LocalizedText message="Who" /></TableHead>
                <TableHead scope="col" className="w-[130px] border-b border-line px-3 py-2.5 font-semibold"><LocalizedText message="Action" /></TableHead>
                <TableHead scope="col" className="w-[220px] border-b border-line px-3 py-2.5 font-semibold"><LocalizedText message="Record" /></TableHead>
                <TableHead scope="col" className="border-b border-line px-3 py-2.5 pr-5 font-semibold"><LocalizedText message="What happened" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {error && <TableRow><TableCell colSpan={5} className="px-5 py-8 text-center text-madder-600"><span role="alert"><LocalizedText message={error} /></span></TableCell></TableRow>}
              {rows?.length === 0 && <TableRow><TableCell colSpan={5} className="px-5 py-10 text-center text-muted"><LocalizedText message="No events match these filters." /></TableCell></TableRow>}
              {rows?.map((e) => (
                <TableRow key={e.id} className="hover:bg-spruce-50/50">
                  <TableCell className="border-b border-line py-2.5 pl-5 pr-3 text-muted">{fmt.dateTime(e.at)}</TableCell>
                  <TableCell className="border-b border-line px-3 py-2.5"><span className="flex items-center gap-2"><Avatar user={user(e.actorId)} size="sm" />{user(e.actorId)?.name}</span></TableCell>
                  <TableCell className="border-b border-line px-3 py-2.5"><span className={cx("rounded px-1.5 py-0.5 text-[11.5px] font-semibold", TONE[e.action] ?? "bg-cobalt-50 text-cobalt-700")}>{t(ACTION_LABEL[e.action] ?? humanize(e.action))}</span></TableCell>
                  <TableCell className="border-b border-line px-3 py-2.5">
                    {e.recordId && e.action !== "DISCARDED"
                      ? <ReferenceLink href={tenantAdminPaths.resource(e.resource, { open: e.recordId })} className="font-semibold text-spruce-800 hover:underline">{e.recordCode}</ReferenceLink>
                      : <span className="font-semibold text-muted">{e.recordCode}</span>}
                    <span className="block truncate text-[11.5px] text-muted">{resource(e.resource)?.label}</span>
                  </TableCell>
                  <TableCell className="border-b border-line px-3 py-2.5 pr-5">
                    <LocalizedText message={e.summary} />
                    {e.reason && <span className="block text-[12px] italic text-muted">“{e.reason}”</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </div>
  );
}
