"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { Table, TableContainer, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/controls";

import { useEffect, useState } from "react";
import { Pencil, UserPlus } from "lucide-react";
import { useQualityApi } from "../../../lib/api";
import { useApi } from "../../../lib/hooks";
import { ROLE_LABEL, useAuth, useMeta } from "../../../lib/auth";
import { Badge, Button, ErrorState, Field, Input, Loading, Modal, PageHeader, Panel, Select } from "../../../components/ui";
import { useToast } from "../../../components/toast";
import { cls } from "../../../lib/format";
import { useQualityFormat } from "../../../lib/format";

interface UserRow {
  id: number;
  name: string;
  email: string;
  title: string | null;
  role: string;
  facility_id: number | null;
  facility_name: string | null;
  status: string;
  last_login_at: string | null;
  actions_30d: number;
}
interface Role { id: string; label: string; description: string; permissions: string[] }

/** Host identity projections (host-*@quality.invalid) are read-only here: the host grants roles, this directory never does. */
const isHostManaged = (email: string) => /^host-.*@quality\.invalid$/i.test(email);

export default function UsersPage() {
  const { t } = useLocalization();
  const { fmtRelative } = useQualityFormat();
  const { can, user: me, refreshMeta } = useAuth();
  const { data, error, loading, reload } = useApi<{ rows: UserRow[]; roles: Role[] }>(can("users.manage") ? "/users" : null);
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);

  if (!can("users.manage")) return <ErrorState message="Only administrators can manage users and roles." />;

  return (
    <>
      <PageHeader
        title="Users and roles"
        description="Access is role-based. Separation of duties is enforced on top of roles: the person who submits a result cannot verify it, the verifier cannot approve it, and whoever prepares a submission cannot approve it."
        actions={
          <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setEditing("new")}><LocalizedText message="Add user" /></Button>
        }
      />
      <p className="mb-4 rounded-md border border-line bg-panel px-3 py-2 text-xs text-ink-2" data-directory-note="true">
        <LocalizedText message="This is the demonstration directory of AllyVora Quality. Rows managed by the host sign-in (host-… addresses) are read-only here, and adding a user here does not grant access to the shared platform: roles are granted by the host." />
      </p>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel bodyClassName="p-0">
          {error && <div className="p-4"><ErrorState message={error} onRetry={reload} /></div>}
          {!data && loading && <Loading className="p-4" rows={8} />}
          {data && (
            <TableContainer overflow="horizontal">
              <Table className="data-table">
                <TableHeader>
                  <TableRow>
                    <TableHead><LocalizedText message="Name" /></TableHead>
                    <TableHead><LocalizedText message="Role" /></TableHead>
                    <TableHead><LocalizedText message="Facility" /></TableHead>
                    <TableHead><LocalizedText message="Last sign-in" /></TableHead>
                    <TableHead className="right"><LocalizedText message="Actions, 30 days" /></TableHead>
                    <TableHead><LocalizedText message="Status" /></TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((u) => (
                    <TableRow key={u.id} className={cls(u.status !== "active" && "text-ink-3")}>
                      <TableCell>
                        <div className="font-medium text-ink">
                          {u.name}
                          {u.id === me?.id && <span className="ml-1.5 text-xs font-normal text-ink-3"><LocalizedText message="(you)" /></span>}
                        </div>
                        <div className="text-xs text-ink-3">{u.email}</div>
                      </TableCell>
                      <TableCell>
                        <div>{ROLE_LABEL[u.role] ? <LocalizedText message={ROLE_LABEL[u.role]} /> : u.role}</div>
                        {u.title && <div className="text-xs text-ink-3">{u.title}</div>}
                      </TableCell>
                      <TableCell className="text-ink-2">{u.facility_name ?? "All facilities"}</TableCell>
                      <TableCell className="text-ink-2">{u.last_login_at ? fmtRelative(u.last_login_at) : <LocalizedText message="Never" />}</TableCell>
                      <TableCell className="num right">{u.actions_30d}</TableCell>
                      <TableCell>
                        <Badge tone={u.status === "active" ? "ok" : "neutral"} dot>
                          {u.status === "active" ? <LocalizedText message="Active" /> : <LocalizedText message="Inactive" />}
                        </Badge>
                      </TableCell>
                      <TableCell className="right">
                        {isHostManaged(u.email) ? (
                          <span className="text-xs text-ink-3" data-host-managed="true"><LocalizedText message="Managed by the host sign-in" /></span>
                        ) : (
                          <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(u)}><LocalizedText message="Edit" /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Panel>
        <Panel title="Roles">
          <ul className="space-y-4">
            {data?.roles.map((r) => (
              <li key={r.id}>
                <div className="text-sm font-medium">{t(r.label)}</div>
                <p className="text-xs text-ink-2">{t(r.description)}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {r.permissions.map((p) => (
                    <span key={p} className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-3">
                      {p}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <UserModal
        user={editing}
        roles={data?.roles ?? []}
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

function UserModal({ user, roles, onClose, onSaved }: { user: UserRow | "new" | null; roles: Role[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useLocalization();
  const { api } = useQualityApi();
  const meta = useMeta();
  const toast = useToast();
  const [f, setF] = useState({ name: "", email: "", title: "", role: "viewer", facility_id: "", status: "active", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isNew = user === "new";

  useEffect(() => {
    setErr(null);
    if (user === "new") setF({ name: "", email: "", title: "", role: "viewer", facility_id: "", status: "active", password: "" });
    else if (user) setF({ name: user.name, email: user.email, title: user.title ?? "", role: user.role, facility_id: user.facility_id ? String(user.facility_id) : "", status: user.status, password: "" });
  }, [user]);

  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setBusy(true);
    setErr(null);
    const body: Record<string, unknown> = { ...f, facility_id: f.facility_id ? Number(f.facility_id) : null };
    if (!isNew && !f.password) delete body.password;
    try {
      if (isNew) await api("/users", { body });
      else await api(`/users/${(user as UserRow).id}`, { method: "PUT", body });
      toast(isNew ? "Added {value0}." : "Saved {value0}.", "success", { value0: f.name });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title={isNew ? t("Add user") : t("Edit {value0}", { value0: f.name })}
      description={isNew ? undefined : "Changing the role, status or password signs the person out of their current sessions."}
      footer={
        <>
          {err && <p className="mr-auto self-center text-sm text-bad">{err}</p>}
          <Button variant="ghost" onClick={onClose}><LocalizedText message="Cancel" /></Button>
          <Button variant="primary" loading={busy} onClick={save}>
            {isNew ? <LocalizedText message="Add user" /> : <LocalizedText message="Save changes" />}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input value={f.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Job title">
          <Input value={f.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Role">
          <Select value={f.role} onChange={(e) => set("role", e.target.value)}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {t(r.label)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Facility" hint="Leave as all facilities for group roles">
          <Select value={f.facility_id} onChange={(e) => set("facility_id", e.target.value)}>
            <option value=""><LocalizedText message="All facilities" /></option>
            {meta.facilities.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
        {!isNew && (
          <Field label="Status">
            <Select value={f.status} onChange={(e) => set("status", e.target.value)}>
              <option value="active"><LocalizedText message="Active" /></option>
              <option value="inactive"><LocalizedText message="Inactive" /></option>
            </Select>
          </Field>
        )}
        <Field label={isNew ? "Initial password" : "Reset password"} className="sm:col-span-2" hint="At least 10 characters, with upper case, lower case and a number">
          <Input type="password" autoComplete="new-password" value={f.password} onChange={(e) => set("password", e.target.value)} placeholder={isNew ? "" : "Leave empty to keep the current password"} />
        </Field>
      </div>
    </Modal>
  );
}
