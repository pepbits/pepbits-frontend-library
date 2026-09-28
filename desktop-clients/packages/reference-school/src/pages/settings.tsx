"use client";

import { useLookups } from "../lib/lookups";
import { Bell, KeyRound, Laptop, Monitor, Moon, Palette, ShieldCheck, Smartphone, Sun, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, Badge, Button, Card, CardGrid, CardHeader, Checkbox, ErrorNote, Field, Input, Select, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Toggle, useToast } from "../ui";
import { useApi, useSchoolApi } from "../lib/api";
import type { NotificationChannels, SchoolSettings } from "../lib/contract";
import { ROLE_CONFIG } from "../lib/nav";
import { isDarkTheme, usePreferenceControl } from "../lib/preferences";
import { useSession } from "../lib/session";
import { cn } from "../lib/utils";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


type Tab = "profile" | "preferences" | "notifications" | "security";
const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User }, { id: "preferences", label: "Preferences", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell }, { id: "security", label: "Security", icon: ShieldCheck },
];
const SESSION_ICON = (name: string) => (/iphone|android|app/i.test(name) ? Smartphone : /windows|edge/i.test(name) ? Monitor : Laptop);

/* Account settings persist through /settings. Theme, density, motion and shortcuts are HOST preferences: they are
   changed only through host.preferenceHost and honour tenant locks. Sign-out belongs to the host shell. */
export function SettingsPage() {
 const referenceT = useReferenceLocalization().t;

  const { role, user } = useSession();
  const [tab, setTab] = useState<Tab>("profile");
  const { data: settings, error, reload, setData } = useApi<SchoolSettings>("/settings");

  return (
    <CardGrid className="grid gap-2.5 lg:grid-cols-12">
      <Card className="h-fit lg:col-span-3">
        <div className="flex items-center gap-3 border-b border-line p-3">
          <Avatar name={user.name} size={44} />
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-[11px] text-muted">{user.title}</p><Badge tone="brand" className="mt-1"><ReferenceText message={ROLE_CONFIG[role].label} /> <ReferenceText message="portal" /></Badge></div>
        </div>
        <nav className="p-1.5" aria-label={referenceT("Settings sections")}>
          {TABS.map((t) => (
            <button type="button" key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined} className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium", tab === t.id ? "bg-brand/10 text-brand" : "text-muted hover:bg-subtle hover:text-fg")}>
              <t.icon className="size-4" /><ReferenceText message={t.label} />
            </button>
          ))}
        </nav>
      </Card>

      <Card className="lg:col-span-9">
        {tab === "preferences" ? <PreferencesTab /> : error ? <div className="p-3"><ErrorNote message={error} onRetry={reload} /></div> : !settings ? <div className="grid gap-2 p-3"><Skeleton className="h-8" /><Skeleton className="h-40" /></div> : (
          <>
            {tab === "profile" && <ProfileTab settings={settings} onSaved={setData} />}
            {tab === "notifications" && <NotificationsTab settings={settings} onSaved={setData} />}
            {tab === "security" && <SecurityTab settings={settings} onSaved={setData} />}
          </>
        )}
      </Card>
    </CardGrid>
  );
}

type Saved = (s: SchoolSettings) => void;

function ProfileTab({ settings, onSaved }: { settings: SchoolSettings; onSaved: Saved }) {
 const referenceT = useReferenceLocalization().t;

  const { profile: SCHOOL } = useLookups();
  const api = useSchoolApi();
  const toast = useToast();
  const [profile, setProfile] = useState(settings.profile);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.patch<{ data: SchoolSettings }>("/settings", { profile: { name: profile.name, phone: profile.phone, language: profile.language, timezone: profile.timezone } });
      onSaved(data); toast("Profile saved");
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return <>
    <CardHeader title={referenceT("Profile")} sub={referenceT("Visible to colleagues and, for teachers, to parents of your students")} />
    <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label={referenceT("Full name")}><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
      <Field label={referenceT("Email")} hint={referenceT("Managed by the school")}><Input value={profile.email} disabled /></Field>
      <Field label={referenceT("Phone")}><Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
      <Field label={referenceT("Language")}><Select value={profile.language} onChange={(e) => setProfile({ ...profile, language: e.target.value })}>{[...new Set([profile.language, "English (UK)", "English (US)", "Español", "Français", "हिन्दी"])].map((l) => <option key={l}>{l}</option>)}</Select></Field>
      <Field label={referenceT("Time zone")}><Select value={profile.timezone} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}>{[...new Set([profile.timezone, "Europe/London", "America/New_York", "Asia/Kolkata", "Asia/Singapore", "Africa/Lagos"])].map((l) => <option key={l}>{l}</option>)}</Select></Field>
      <Field label={referenceT("School")}><Input value={`${SCHOOL.name} · ${SCHOOL.campus}`} disabled /></Field>
    </div>
    <div className="flex justify-end border-t border-line px-3 py-2"><Button variant="primary" loading={busy} onClick={save}><ReferenceText message="Save changes" /></Button></div>
  </>;
}

function PreferencesTab() {
 const referenceT = useReferenceLocalization().t;

  const theme = usePreferenceControl("theme");
  const density = usePreferenceControl("density");
  const motion = usePreferenceControl("reducedMotion");
  const shortcuts = usePreferenceControl("keyboardShortcuts");
  const dark = isDarkTheme(theme.value);
  /* Light/Dark as in the source; each maps to a host theme and stays on the current one when it already matches. */
  const choices = [["light", Sun, "Light", dark ? "nexora" : theme.value], ["dark", Moon, "Dark", dark ? theme.value : "midnight"]] as const;
  return <>
    <CardHeader title={referenceT("Preferences")} sub={referenceT("Saved to your account by the host application")} />
    <div className="grid gap-4 p-3">
      <div>
        <p className="mb-1.5 text-[11px] font-medium text-muted"><ReferenceText message="Theme" />{theme.reason && <span className="ml-1 text-faint">· {theme.reason}</span>}</p>
        <div className="flex gap-2" role="radiogroup" aria-label={referenceT("Theme")}>
          {choices.map(([k, Icon, l, target]) => {
            const on = (k === "dark") === dark;
            const disabled = !theme.editable || !theme.allows(target);
            return (
              <button type="button" role="radio" aria-checked={on} key={k} disabled={disabled} onClick={() => !on && theme.set(target)}
                className={cn("flex w-32 flex-col items-center gap-1 rounded-lg border p-3 text-xs disabled:cursor-not-allowed disabled:opacity-60", on ? "border-brand ring-2 ring-brand/20" : "border-line hover:bg-subtle")}>
                <Icon className="size-5" />{l}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={referenceT("Density")} hint={density.reason}>
          <Select value={density.value} disabled={!density.editable} onChange={(e) => density.set(e.target.value as typeof density.value)}>
            <option value="compact"><ReferenceText message="Compact (recommended)" /></option><option value="comfortable"><ReferenceText message="Comfortable" /></option><option value="spacious"><ReferenceText message="Spacious" /></option>
          </Select>
        </Field>
        <Field label={referenceT("Week starts on")} hint={referenceT("Set by the school calendar")}><Select value="Monday" disabled><option><ReferenceText message="Monday" /></option></Select></Field>
      </div>
      <Toggle label={referenceT("Reduce motion and animations")} description={motion.reason} checked={motion.value} disabled={!motion.editable} onChange={(v) => motion.set(v)} />
      <Toggle label={referenceT("Keyboard shortcuts")} description={shortcuts.reason ?? "Quiz answer keys and whiteboard tool keys"} checked={shortcuts.value} disabled={!shortcuts.editable} onChange={(v) => shortcuts.set(v)} />
    </div>
  </>;
}

const CHANNELS = ["In app", "Email", "SMS"] as const;

function NotificationsTab({ settings, onSaved }: { settings: SchoolSettings; onSaved: Saved }) {
 const referenceT = useReferenceLocalization().t;

  const api = useSchoolApi();
  const toast = useToast();
  const [notif, setNotif] = useState(settings.notifications);
  const [busy, setBusy] = useState(false);
  useEffect(() => setNotif(settings.notifications), [settings.notifications]);
  const save = async () => {
    setBusy(true);
    try { const { data } = await api.patch<{ data: SchoolSettings }>("/settings", { notifications: notif }); onSaved(data); toast("Notification preferences saved"); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return <>
    <CardHeader title={referenceT("Notifications")} sub={referenceT("Choose how you hear about each kind of update")} />
    <Table className="w-full text-xs">
      <TableHeader className="bg-subtle text-[11px] text-muted"><TableRow><TableHead className="px-3 py-1.5 text-left"><ReferenceText message="Event" /></TableHead>{CHANNELS.map((c) => <TableHead key={c} className="w-20 py-1.5">{c}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{Object.entries(notif).map(([k, v]) => (
        <TableRow key={k} className="border-t border-line/60"><TableCell className="px-3 py-2">{k}</TableCell>{v.map((on, i) => (
          <TableCell key={i} className="text-center"><span className="inline-flex"><Checkbox checked={on} aria-label={referenceT("{value0}: {value1}", {value0: k, value1: CHANNELS[i]})}
            onChange={(e) => setNotif((n) => ({ ...n, [k]: n[k]!.map((y, j) => (j === i ? e.target.checked : y)) as NotificationChannels }))} /></span></TableCell>
        ))}</TableRow>
      ))}</TableBody>
    </Table>
    <div className="flex justify-end border-t border-line px-3 py-2"><Button variant="primary" loading={busy} onClick={save}><ReferenceText message="Save" /></Button></div>
  </>;
}

function SecurityTab({ settings, onSaved }: { settings: SchoolSettings; onSaved: Saved }) {
 const referenceT = useReferenceLocalization().t;

  const api = useSchoolApi();
  const toast = useToast();
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const strength = [/.{10,}/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw.next)).length;
  const updatePassword = async () => {
    setBusy("password");
    try { await api.post("/settings/password", pw); setPw({ current: "", next: "", confirm: "" }); toast("Password updated"); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(null); }
  };
  const setTwofa = async (v: boolean) => {
    setBusy("2fa");
    try { const { data } = await api.patch<{ data: SchoolSettings }>("/settings", { twoStepVerification: v }); onSaved(data); toast(v ? "Two-step verification enabled" : "Two-step verification turned off", v ? "success" : "info"); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(null); }
  };
  const endSession = async (id: string) => {
    setBusy(id);
    try { await api.del(`/settings/sessions/${encodeURIComponent(id)}`); onSaved({ ...settings, sessions: settings.sessions.filter((s) => s.id !== id) }); toast("Session signed out"); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(null); }
  };
  return <>
    <CardHeader title={referenceT("Security")} />
    <div className="grid gap-4 p-3 lg:grid-cols-2">
      <div className="grid content-start gap-2.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold"><KeyRound className="size-4" /><ReferenceText message="Change password" /></p>
        <Field label={referenceT("Current password")}><Input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" /></Field>
        <Field label={referenceT("New password")} hint={referenceT("10+ characters with a capital, a number and a symbol")}>
          <Input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
        </Field>
        <div className="flex gap-1" aria-hidden>{[0, 1, 2, 3].map((i) => <span key={i} className={cn("h-1 flex-1 rounded-full", i < strength ? (strength >= 3 ? "bg-ok" : "bg-warn") : "bg-line")} />)}</div>
        <Field label={referenceT("Confirm new password")} error={pw.confirm && pw.confirm !== pw.next ? "Passwords don't match" : undefined}><Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" /></Field>
        <Button variant="primary" className="w-fit" loading={busy === "password"} disabled={!pw.current || strength < 3 || pw.next !== pw.confirm} onClick={updatePassword}><ReferenceText message="Update password" /></Button>
      </div>
      <div className="grid content-start gap-3">
        <div className="flex items-center gap-3 rounded-lg border border-line p-3">
          <ShieldCheck className="size-5 text-ok" />
          <Toggle className="flex-1 border-0 bg-transparent p-0" label={referenceT("Two-step verification")} description={settings.twoStepVerification ? "On — codes from your authenticator app" : "Add a second step when signing in"}
            checked={settings.twoStepVerification} disabled={busy === "2fa"} onChange={setTwofa} />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold"><ReferenceText message="Active sessions" /></p>
          <ul className="divide-y divide-line/70 rounded-lg border border-line text-xs">
            {settings.sessions.map((s) => {
              const I = SESSION_ICON(s.name);
              return <li key={s.id} className="flex items-center gap-2 px-3 py-2"><I className="size-4 text-muted" /><span className="flex-1"><span className="block font-medium">{s.name}</span><span className="text-[11px] text-muted">{s.current ? referenceT("This device · {value0}", { value0: s.detail }) : s.detail}</span></span>{!s.current && <Button size="xs" variant="ghost" loading={busy === s.id} onClick={() => endSession(s.id)}><ReferenceText message="Sign out" /></Button>}</li>;
            })}
          </ul>
        </div>
      </div>
    </div>
  </>;
}
