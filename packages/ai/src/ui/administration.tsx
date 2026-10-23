"use client";
import { CardGrid, TableContainer } from "@pepbits/components";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@pepbits/components";
import { LocalizedText, useLocalization } from "@pepbits/i18n/react";


import React, { useCallback, useEffect, useState } from "react";
import { AudioLines, BadgeCheck, CircleAlert, Eye, RefreshCw, Save, ShieldAlert, Trash2 } from "@pepbits/icons";
import { Badge, Button, Input, cn } from "@pepbits/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@pepbits/components";
import { useSession } from "@pepbits/platform";
import type { AiConfig, AiUsage } from "@pepbits/ai/config";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {useAiHost} from "./provider";

/**
 * The administration surface.
 *
 * Every client function in client/admin existed for two tasks with nothing
 * rendering them, so the only way to configure a provider was curl with a
 * bearer token. This is that screen.
 *
 * Two rules it is built to keep:
 *
 * IT NEVER SHOWS A CREDENTIAL. There is no state here that holds one after
 * submit, no field populated from the server, and nothing to reveal — the
 * "show" affordance a password input usually earns is absent on purpose,
 * because there would be nothing behind it. What is shown is the status: four
 * characters, a hash prefix, who set it and when.
 *
 * THE DISABLED STATE IS NOT THE ENFORCEMENT POINT. Writes are refused by the
 * server on the session's role. This screen greys the controls as a courtesy so
 * a non-admin is not invited to fill a form that will 403, and says so in as
 * many words — a UI that implied it were the gate would be the more dangerous
 * of the two lies.
 */

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] py-2.5 last:border-b-0">
      <div className="min-w-0">
        <div className="text-[length:calc(10.5px*var(--fs-scale))] font-bold"><LocalizedText message={label} /></div>
        {hint ? <div className="mt-0.5 text-[length:calc(9px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]"><LocalizedText message={hint} /></div> : null}
      </div>
      <div className="shrink-0 text-right text-[length:calc(10px*var(--fs-scale))] font-semibold tabular-nums">{children}</div>
    </div>
  );
}

function Meter({ used, of, label }: { used: number; of: number; label: string }) {
  const format=useFormatters();
  const pct = of > 0 ? Math.min(100, Math.round((used / of) * 100)) : 0;
  /* Colour turns at 75%, not at 100%. A budget that only looks alarming once it
     is spent has told you at the one moment you can no longer act on it. */
  const tone = pct >= 100 ? "var(--danger)" : pct >= 75 ? "var(--warning)" : "var(--primary)";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[length:calc(9px*var(--fs-scale))] font-bold uppercase tracking-[.08em] text-[var(--text-muted)]"><LocalizedText message={label} /></span>
        <span className="text-[length:calc(10px*var(--fs-scale))] font-extrabold tabular-nums">{format.number(used)} / {format.number(of)}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: tone }} />
      </div>
    </div>
  );
}

export function AiAdministration() {
  const {t: translateCopy, dateTime} = useLocalization();
  const {user,status,expired} = useSession();
  const {client,canManageAi=false} = useAiHost();
  const {clearAiCredential,fetchAiConfig,fetchAiUsage,saveAiConfig,setAiCredential,setAiScopedCredential,verifyAiCredential} = client;
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [secret, setSecret] = useState("");
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string; detail?: string } | null>(null);

  const load = useCallback(async () => {
    const [c, u] = await Promise.all([fetchAiConfig(), fetchAiUsage()]);
    if (c.data) {
      setConfig(c.data);
      setDraft({
        providerId: c.data.provider.id, providerLabel: c.data.provider.label, endpoint: c.data.provider.endpoint,
        modelId: c.data.model.id, modelLabel: c.data.model.label, contextWindow: String(c.data.model.contextWindow),
        requestsPerMinute: String(c.data.limits.requestsPerMinute), tokensPerDay: String(c.data.limits.tokensPerDay),
        maxContextFields: String(c.data.limits.maxContextFields),
      });
    } else {
      setNote({ tone: "bad", text: c.error ?? "The AI configuration could not be read.", detail: c.detail });
    }
    if (u.data) setUsage(u.data);
  }, [fetchAiConfig,fetchAiUsage]);

  useEffect(() => { void load(); }, [load]);

  /* Advisory only. The server decides; see the header. */
  const mayWrite = canManageAi && status === "authenticated" && !expired;

  const act = async (key: string, run: () => Promise<{ ok: boolean; error?: string; detail?: string }>, success: string) => {
    if (!mayWrite) return;
    setBusy(key); setNote(null);
    const result = await run();
    setBusy(null);
    setNote(result.ok ? { tone: "ok", text: success } : { tone: "bad", text: result.error ?? "The change was refused.", detail: result.detail });
    await load();
  };

  if (!config) {
    return (
      <div className="p-8 text-center text-[length:calc(11px*var(--fs-scale))] text-[var(--text-muted)]">
        {note ? <><b className="text-[var(--danger-ink)]">{note.text}</b>{note.detail ? <div className="mt-1">{note.detail}</div> : null}</> : <LocalizedText message="ui.loading.the.ai.configuration.5c22d70c" />}
      </div>
    );
  }

  const credential = config.credential;

  return (
    <div className="nex-scrollbar h-full overflow-y-auto p-4">
      <CardGrid className="mx-auto max-w-5xl gap-4">
        {!mayWrite ? (
          <div className="flex items-start gap-2.5 rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] p-3">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[var(--warning-ink)]" />
            <div className="text-[length:calc(9.5px*var(--fs-scale))] leading-relaxed">
              <b><LocalizedText message="ui.read.only.for.this.session.0fce39ec" /></b><LocalizedText message="ui.signed.in.as.c2f48eaa" /><b>{user?.role ?? "an unknown role"}</b><LocalizedText message="ui.administrative.writes.need.4fd2e058" /><b><LocalizedText message="permission from your administrator" /></b><LocalizedText message="ui.the.controls.below.are.greyed.as.a.courtesy.the.refusal.fffc8d0a" /></div>
          </div>
        ) : null}

        {note ? (
          <div className={cn("flex items-start gap-2.5 rounded-[var(--radius)] border p-3",
            note.tone === "ok"
              ? "border-[color-mix(in_srgb,var(--success)_35%,var(--border))] bg-[color-mix(in_srgb,var(--success)_10%,transparent)]"
              : "border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]")}>
            {note.tone === "ok" ? <BadgeCheck className="mt-0.5 size-4 shrink-0 text-[var(--success-ink)]" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-[var(--danger-ink)]" />}
            <div className="text-[length:calc(9.5px*var(--fs-scale))] leading-relaxed"><b>{note.text}</b>{note.detail ? <div className="mt-0.5 text-[var(--text-muted)]">{note.detail}</div> : null}</div>
          </div>
        ) : null}

        {/* ---- credential ---------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle title="ui.provider.credential.a97d8364" subtitle="ui.write.only.set.and.replaced.here.never.read.back.c6b23d5d" />
            <Badge tone={credential.configured ? "success" : "neutral"}>{credential.configured ? <LocalizedText message="ui.configured.20158224" /> : <LocalizedText message="ui.not.set.1aef9399" />}</Badge>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-[length:calc(9px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]"><LocalizedText message="ui.write.only.the.value.is.never.returned.by.any.endpoint.s.b22264b9" /><b><LocalizedText message="ui.verify.eea2745e" /></b><LocalizedText message="ui.to.find.out.whether.it.still.works.2a65988c" /></p>
            <Row label="Ends with" hint="Four characters. Enough to tell two keys apart, not enough to be one.">{credential.hint ?? "—"}</Row>
            <Row label="Fingerprint" hint="SHA-256 prefix, for matching against a vault record.">
              <span className="font-mono text-[length:calc(9px*var(--fs-scale))]">{credential.fingerprint ?? "—"}</span>
            </Row>
            <Row label="Set by">{credential.setBy ?? "—"}</Row>
            <Row label="First set">{credential.setAt ? dateTime(credential.setAt) : "—"}</Row>
            <Row label="Last rotated" hint="Distinct from first set: an incident usually turns on when it last changed.">
              {credential.rotatedAt ? dateTime(credential.rotatedAt) : <LocalizedText message="ui.never.6497e4b3" />}
            </Row>
            <Row label="Last verified">{credential.lastVerifiedAt ? dateTime(credential.lastVerifiedAt) : <LocalizedText message="ui.never.6497e4b3" />}</Row>
            {credential.lastError ? (
              <Row label="Last error"><span className="text-[var(--danger-ink)]">{translateCopy(credential.lastError ?? "")}</span></Row>
            ) : null}

            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="min-w-56 flex-1">
                <Input
                  label={credential.configured ? "Replace the key" : "Set the key"}
                  type="password"
                  autoComplete="off"
                  placeholder="ui.paste.the.provider.key.84482375"
                  hint="ui.submitted.once.and.not.kept.in.this.page.1a316320"
                  value={secret}
                  disabled={!mayWrite}
                  onChange={(event) => setSecret(event.target.value)}
                />
              </div>
              <Button size="sm" variant="primary" leftIcon={<Save className="size-3.5" />}
                disabled={!mayWrite || !secret.trim() || busy !== null}
                onClick={() => void act("set", async () => {
                  const result = await setAiCredential(secret.trim());
                  /* Cleared whatever happened. A rejected key left in the box is
                     a key sitting in the DOM for no reason. */
                  setSecret("");
                  return result;
                }, credential.configured ? "The key was replaced." : "The key was set.")}>
                {busy === "set" ? <LocalizedText message="ui.saving.23e39291" /> : credential.configured ? <LocalizedText message="ui.replace.95e15439" /> : <LocalizedText message="ui.set.key.d599b6ec" />}
              </Button>
              <Button size="sm" variant="secondary" leftIcon={<Eye className="size-3.5" />}
                disabled={!mayWrite || !credential.configured || busy !== null}
                onClick={() => void act("verify", () => verifyAiCredential(), "The provider accepted the key.")}>
                {busy === "verify" ? <LocalizedText message="ui.verifying.63bbd08c" /> : <LocalizedText message="ui.verify.eea2745e" />}
              </Button>
              <Button size="sm" variant="danger" leftIcon={<Trash2 className="size-3.5" />}
                disabled={!mayWrite || !credential.configured || busy !== null}
                onClick={() => void act("clear", () => clearAiCredential(), "The key was removed. The assistant falls back to its echo transport.")}><LocalizedText message="ui.remove.c3812fc4" /></Button>
            </div>
            <p className="mt-2 text-[length:calc(8.5px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]"><LocalizedText message="ui.verifying.and.removing.both.reach.the.provider.or.the.st.b63b3716" /></p>
          </CardContent>
        </Card>

        {/* ---- provider ------------------------------------------------ */}
        <Card>
          <CardHeader><CardTitle title="ui.provider.and.model.b9fdc888" subtitle="ui.where.dispatch.sends.and.as.what.88c3fbaa" /></CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="ui.provider.id.c03102a8" value={draft.providerId ?? ""} disabled={!mayWrite} onChange={(e) => setDraft({ ...draft, providerId: e.target.value })} />
              <Input label="ui.provider.label.96cd4b4a" value={draft.providerLabel ?? ""} disabled={!mayWrite} onChange={(e) => setDraft({ ...draft, providerLabel: e.target.value })} />
              <Input className="md:col-span-2" label="ui.endpoint.3df9726c" placeholder="https://…" hint="ui.the.base.url.dispatch.appends.chat.completions.9ba2af6c"
                value={draft.endpoint ?? ""} disabled={!mayWrite} onChange={(e) => setDraft({ ...draft, endpoint: e.target.value })} />
              <Input label="ui.model.id.7789530b" value={draft.modelId ?? ""} disabled={!mayWrite} onChange={(e) => setDraft({ ...draft, modelId: e.target.value })} />
              <Input label="ui.model.label.b5f5cfb0" value={draft.modelLabel ?? ""} disabled={!mayWrite} onChange={(e) => setDraft({ ...draft, modelLabel: e.target.value })} />
              <Input label="ui.context.window.7696d085" type="number" min={0} value={draft.contextWindow ?? ""} disabled={!mayWrite} onChange={(e) => setDraft({ ...draft, contextWindow: e.target.value })} />
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="primary" leftIcon={<Save className="size-3.5" />} disabled={!mayWrite || busy !== null}
                onClick={() => void act("provider", () => saveAiConfig({
                  provider: { id: draft.providerId ?? "", label: draft.providerLabel ?? "", endpoint: draft.endpoint ?? "" },
                  model: { id: draft.modelId ?? "", label: draft.modelLabel ?? "", contextWindow: Number(draft.contextWindow) || 0 },
                }), "Provider and model saved.")}>
                {busy === "provider" ? <LocalizedText message="ui.saving.23e39291" /> : <LocalizedText message="ui.save.provider.4986554f" />}
              </Button>
              <Button size="sm" variant="ghost" leftIcon={<RefreshCw className="size-3.5" />} onClick={() => void load()}><LocalizedText message="ui.reload.bdc090ec" /></Button>
            </div>
          </CardContent>
        </Card>

        {/* ---- limits and spend ---------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle title="ui.limits.and.spend.d3d3cff7" subtitle="ui.what.is.allowed.and.what.has.been.used.5a7bc7b9" />
            {usage?.limitsAreDefaults ? <Badge tone="warning"><LocalizedText message="ui.defaults.in.use.9afc074e" /></Badge> : null}
          </CardHeader>
          <CardContent>
            {usage ? (
              <div className="mb-4 grid gap-3 md:grid-cols-2">
                <Meter label="Requests this minute" used={usage.requestsLastMinute} of={usage.requestsPerMinute} />
                <Meter label={translateCopy("Tokens today · {day} UTC", {day:usage.day})} used={usage.tokensUsedToday} of={usage.tokensPerDay} />
              </div>
            ) : null}
            <p className="mb-2 text-[length:calc(9px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]"><LocalizedText message="ui.a.missing.zero.or.malformed.limit.resolves.to.the.server.fafc05f4" /><b><LocalizedText message="ui.defaults.in.use.9afc074e" /></b><LocalizedText message="ui.is.worth.showing.20.because.someone.chose.20.and.20.beca.91d7efba" /></p>
            <div className="grid gap-3 md:grid-cols-3">
              <Input label="ui.requests.per.minute.aa6d477f" type="number" min={1} value={draft.requestsPerMinute ?? ""} disabled={!mayWrite} onChange={(e) => setDraft({ ...draft, requestsPerMinute: e.target.value })} />
              <Input label="ui.tokens.per.day.7d000080" type="number" min={1} value={draft.tokensPerDay ?? ""} disabled={!mayWrite} onChange={(e) => setDraft({ ...draft, tokensPerDay: e.target.value })} />
              <Input label="ui.max.context.fields.3991aba7" type="number" min={1} hint="ui.assembly.is.truncated.to.this.5d3886f2" value={draft.maxContextFields ?? ""} disabled={!mayWrite} onChange={(e) => setDraft({ ...draft, maxContextFields: e.target.value })} />
            </div>
            <Button className="mt-3" size="sm" variant="primary" leftIcon={<Save className="size-3.5" />} disabled={!mayWrite || busy !== null}
              onClick={() => void act("limits", () => saveAiConfig({
                limits: {
                  requestsPerMinute: Number(draft.requestsPerMinute) || 0,
                  tokensPerDay: Number(draft.tokensPerDay) || 0,
                  maxContextFields: Number(draft.maxContextFields) || 0,
                },
              }), "Limits saved.")}>
              {busy === "limits" ? <LocalizedText message="ui.saving.23e39291" /> : <LocalizedText message="ui.save.limits.237e964b" />}
            </Button>
          </CardContent>
        </Card>

        {/* ---- speech providers ----------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle title="ui.speech.providers.34325dc3" subtitle="ui.priority.order.for.transcription.the.first.that.can.run.1e0d628e" />
            <Badge tone="neutral">{config.speech?.providers?.length ?? 0}<LocalizedText message="ui.configured.a3ed874e" /></Badge>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-[length:calc(9px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]"><LocalizedText message="ui.the.gateway.picks.the.lowest.priority.number.that.is.ena.1c2a2c84" /><b><LocalizedText message="ui.skipped.not.attempted.59189ba9" /></b><LocalizedText message="ui.failing.at.call.time.would.turn.a.configuration.mistake.c05babfa" /></p>
            {(config.speech?.providers ?? []).map((sp) => (
              <Card shadow="none" tone="muted" radius="lg" key={sp.id} className="mb-2 p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <AudioLines className="size-3.5 text-[var(--primary)]" />
                  <b className="text-[length:calc(10.5px*var(--fs-scale))]">{sp.label}</b>
                  <Badge tone={sp.enabled ? "success" : "neutral"}>{sp.enabled ? <LocalizedText message="ui.enabled.fb9cf756" /> : <LocalizedText message="ui.disabled.17eb3c01" />}</Badge>
                  <Badge tone="neutral"><LocalizedText message="ui.priority.5f016d6d" />{sp.priority}</Badge>
                  {sp.credential?.configured ? <Badge tone="success"><LocalizedText message="ui.key.cbc3fdcb" />{sp.credential.hint}</Badge> : <Badge tone="warning"><LocalizedText message="ui.no.key.a199dc8c" /></Badge>}
                  <span className="flex-1" />
                  <span className="text-[length:calc(9px*var(--fs-scale))] text-[var(--text-muted)]">
                    {sp.model} · {(sp.languages ?? []).join(", ")}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <div className="min-w-48 flex-1">
                    <Input label={translateCopy("{provider} key", {provider:sp.label})} type="password" autoComplete="off" placeholder="ui.paste.the.provider.key.84482375"
                      disabled={!mayWrite} value={secrets[sp.id] ?? ""} onChange={(e) => setSecrets({ ...secrets, [sp.id]: e.target.value })} />
                  </div>
                  <Button size="sm" variant="primary" disabled={!mayWrite || !(secrets[sp.id] ?? "").trim() || busy !== null}
                    onClick={() => void act(`sp-${sp.id}`, async () => {
                      const r = await setAiScopedCredential(`speech:${sp.id}`, (secrets[sp.id] ?? "").trim());
                      setSecrets({ ...secrets, [sp.id]: "" });
                      return r;
                    }, `${sp.label} key stored.`)}>
                    {busy === `sp-${sp.id}` ? <LocalizedText message="ui.saving.23e39291" /> : <LocalizedText message="ui.set.key.d599b6ec" />}
                  </Button>
                  <Button size="sm" variant="secondary" disabled={!mayWrite || busy !== null}
                    onClick={() => void act(`sp-toggle-${sp.id}`, () => saveAiConfig({
                      speech: { ...config.speech, providers: (config.speech?.providers ?? []).map((x) => x.id === sp.id ? { ...x, enabled: !x.enabled } : x) },
                    } as never), `${sp.label} ${sp.enabled ? "disabled" : "enabled"}.`)}>
                    {sp.enabled ? <LocalizedText message="ui.disable.b7e3e4aa" /> : <LocalizedText message="ui.enable.5342e09f" />}
                  </Button>
                </div>
              </Card>
            ))}
            <p className="mt-1 text-[length:calc(8.5px*var(--fs-scale))] leading-relaxed text-[var(--text-subtle)]"><LocalizedText message="ui.only.the.built.in.mock.transcriber.runs.in.this.build.th.99c7dabf" /></p>
          </CardContent>
        </Card>

        {/* ---- prompts ------------------------------------------------- */}
        <Card>
          <CardHeader><CardTitle title="ui.prompts.5f2e66e6" subtitle="ui.ids.and.versions.the.text.stays.on.the.server.976cd4c2" /><Badge tone="neutral">{config.prompts.length}<LocalizedText message="ui.registered.1804af94" /></Badge></CardHeader>
          <CardContent>
            <p className="mb-2 text-[length:calc(9px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]"><LocalizedText message="ui.ids.and.versions.only.prompt.e8f8a0a3" /><b><LocalizedText message="ui.text.982d9e3e" /></b><LocalizedText message="ui.is.resolved.server.side.at.dispatch.and.is.never.sent.to.0bc8d5de" /></p>
            <TableContainer overflow="horizontal" className="rounded-lg border border-[var(--border)]">
              <Table className="w-full border-collapse text-left text-[length:calc(9.5px*var(--fs-scale))]">
                <TableHeader>
                  <TableRow className="bg-[var(--surface-2)]">
                    {["Prompt id", "Use case", "Version", "Updated"].map((h) => (
                      <TableHead key={h} className="px-3 py-2 text-[length:calc(8.5px*var(--fs-scale))] font-black uppercase tracking-[.08em] text-[var(--text-subtle)]"><LocalizedText message={h} /></TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {config.prompts.map((prompt) => (
                    <TableRow key={prompt.id} className="border-t border-[var(--border)]">
                      <TableCell className="px-3 py-2 font-mono">{prompt.id}</TableCell>
                      <TableCell className="px-3 py-2">{prompt.useCaseId}</TableCell>
                      <TableCell className="px-3 py-2 tabular-nums">v{prompt.version}</TableCell>
                      <TableCell className="px-3 py-2 text-[var(--text-muted)]">{dateTime(prompt.updatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* ---- handling ------------------------------------------------ */}
        <Card>
          <CardHeader><CardTitle title="ui.retention.and.data.sharing.b44d2e81" subtitle="ui.how.the.provider.is.permitted.to.handle.what.it.is.sent.8a5b2181" /></CardHeader>
          <CardContent>
            <Row label="Retention class">{config.retention.class}</Row>
            <Row label="Retention period">{config.retention.days}<LocalizedText message="ui.days.b1c50316" /></Row>
            <Row label="Provider trains on content" hint="Must stay false for protected content.">
              <Badge tone={config.dataSharing.providerTrainsOnContent ? "danger" : "success"}>
                {config.dataSharing.providerTrainsOnContent ? "yes" : "no"}
              </Badge>
            </Row>
            <Row label="Processing region">{config.dataSharing.region}</Row>
            <Row label="Tenant">{config.tenantId}</Row>
          </CardContent>
        </Card>
      </CardGrid>
    </div>
  );
}
