"use client";
import { DescriptionList } from "@pepbits/components";
import { Card } from "@pepbits/components";
import { LocalizedText } from "@pepbits/i18n/react";


import React, { useState } from "react";
import { Database, EyeOff, Route, ShieldCheck, TriangleAlert } from "@pepbits/icons";
import { Badge, Button, Checkbox, cn } from "@pepbits/ui";
import type { AiConfig, AiContext, AiUseCase, Gate } from "@pepbits/ai/config";

type Tab = "data" | "flow" | "policy";

/**
 * What is captured, where it goes, and under what terms — shown BEFORE
 * dispatch (spec constraint 3, §8).
 *
 * The Data tab renders `context.fields` and nothing else. That is deliberate
 * and it is the whole design: the panel cannot show a field the payload lacks,
 * nor hide one it has, because it has no other source. Any other arrangement
 * turns this screen into a claim about the request rather than a view of it.
 */
export function TransparencyPanel({ context, useCase, config, decidedBy, onConfirm, onCancel, sending }: {
  context: AiContext;
  useCase: AiUseCase;
  /** Null while the administration config has not loaded, or is unavailable. */
  config: AiConfig | null;
  decidedBy: Gate;
  onConfirm: () => void;
  onCancel: () => void;
  sending?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("data");
  /* Clinical use cases require a second, explicit acknowledgement naming the
     record. A single button for both categories makes the careful case cost
     nothing, which is the same as not having one. */
  const [acknowledged, setAcknowledged] = useState(false);
  const clinical = useCase.category === "clinical";
  const redactedCount = context.fields.filter((field) => field.redacted).length;

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "data", label: "Data", icon: <Database className="size-3.5" /> },
    { id: "flow", label: "Flow", icon: <Route className="size-3.5" /> },
    { id: "policy", label: "Policy", icon: <ShieldCheck className="size-3.5" /> },
  ];

  const hop = (label: string, detail: string, retains: string) => (
    <li className="flex gap-3 border-b border-[var(--border)] py-2.5 last:border-0">
      <span className="mt-0.5 size-2 shrink-0 rounded-full bg-[var(--primary)]" />
      <span className="min-w-0 flex-1">
        <span className="block text-[length:calc(10.5px*var(--fs-scale))] font-bold"><LocalizedText message={label} /></span>
        <span className="block text-[length:calc(9.5px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]">{detail}</span>
      </span>
      <span className="shrink-0 text-[length:calc(9px*var(--fs-scale))] text-[var(--text-subtle)]">{retains}</span>
    </li>
  );

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex shrink-0 border-b border-[var(--border)]">
        {tabs.map((item) => (
          <button key={item.id} type="button" onClick={() => setTab(item.id)}
            className={cn("focus-ring flex h-9 flex-1 items-center justify-center gap-1.5 border-b-2 text-[length:calc(10.5px*var(--fs-scale))] font-bold transition",
              tab === item.id ? "border-[var(--primary)] text-[var(--text)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]")}>
            {item.icon}{item.label}
          </button>
        ))}
      </div>

      <div className="nex-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {tab === "data" ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[length:calc(11px*var(--fs-scale))] font-extrabold"><LocalizedText message={useCase.label} /></span>
              <Badge tone="neutral">{context.fields.length} {context.fields.length === 1 ? <LocalizedText message="ui.field.c0d2856b" /> : <LocalizedText message="ui.fields.bfe5d697" />}</Badge>
              {redactedCount ? <Badge tone="warning">{redactedCount}<LocalizedText message="ui.redacted.4a081a65" /></Badge> : null}
            </div>
            <p className="mt-1.5 text-[length:calc(9.5px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]"><LocalizedText message={useCase.description} /></p>

            {context.fields.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-[var(--border-strong)] px-3 py-6 text-center text-[length:calc(9.5px*var(--fs-scale))] text-[var(--text-muted)]"><LocalizedText message="ui.nothing.on.this.page.matches.what.this.use.case.may.read.7844af00" /></p>
            ) : (
              <ul className="mt-3">
                {context.fields.map((field, index) => (
                  <li key={`${field.label}-${index}`} className="flex gap-3 border-b border-[var(--border)] py-2 last:border-0">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[length:calc(9px*var(--fs-scale))] font-bold uppercase tracking-[.08em] text-[var(--text-subtle)]"><LocalizedText message={field.label} /></span>
                      <span className="mt-0.5 block break-words text-[length:calc(10.5px*var(--fs-scale))] font-semibold">{field.value}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[length:calc(8.5px*var(--fs-scale))] text-[var(--text-subtle)]">{field.source}</span>
                      {field.redacted ? <span className="flex items-center gap-1 text-[length:calc(8.5px*var(--fs-scale))] font-bold text-[var(--warning-ink)]"><EyeOff className="size-3" /><LocalizedText message="ui.redacted.b68919af" /></span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {context.userInput ? (
              <Card shadow="none" tone="muted" radius="xl" className="mt-3 p-3">
                <div className="text-[length:calc(9px*var(--fs-scale))] font-bold uppercase tracking-[.08em] text-[var(--text-subtle)]"><LocalizedText message="ui.your.message.7a057bd9" /></div>
                <p className="mt-1 whitespace-pre-wrap text-[length:calc(10.5px*var(--fs-scale))]">{context.userInput}</p>
              </Card>
            ) : null}
          </>
        ) : null}

        {tab === "flow" ? (
          <ul>
            {hop("This browser", `Assembled from ${[...new Set(context.fields.map((f) => f.source))].join(", ") || "nothing"}. Redaction has already been applied.`, "not stored")}
            {hop("Your AI service", "Resolves the prompt, attaches the provider credential, applies rate limits, writes the audit record.", config ? `${config.retention.days} days` : "per policy")}
            {hop(config?.provider.label ?? "Provider (not configured)", config?.provider.endpoint || "No endpoint is configured for this tenant.", config?.dataSharing.providerTrainsOnContent ? "trains on content" : "no training")}
          </ul>
        ) : null}

        {tab === "policy" ? (
          <DescriptionList layout="rows" className="gap-2.5"
            itemClassName="border-b border-[var(--border)] pb-2 last:border-0"
            termClassName="text-[length:calc(9.5px*var(--fs-scale))] text-[var(--text-muted)]"
            valueClassName="text-right text-[length:calc(9.5px*var(--fs-scale))] font-bold"
            items={[
              ["Allowed by", `The ${decidedBy} gate`],
              ["Retention", config ? `${config.retention.class}, ${config.retention.days} days` : "Unknown — configuration unavailable"],
              ["Region", config?.dataSharing.region ?? "Unknown"],
              ["Provider trains on this content", config ? (config.dataSharing.providerTrainsOnContent ? "Yes" : "No") : "Unknown"],
              ["Credential", config?.credential.configured ? `Configured ${config.credential.hint ?? ""}` : "Not configured — the request cannot be sent"],
              ["Prompt", useCase.promptId],
            ].map(([term, value]) => ({id: term!, label: term!, value: value!}))} />
        ) : null}
      </div>

      <div className="shrink-0 border-t border-[var(--border)] px-4 py-3">
        {clinical ? (
          <label className="mb-2.5 flex cursor-pointer items-start gap-2 rounded-xl border border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] p-2.5">
            <Checkbox className="mt-0.5" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
            <span className="text-[length:calc(9.5px*var(--fs-scale))] leading-relaxed">
              <TriangleAlert className="mr-1 inline size-3.5 text-[var(--warning-ink)]" /><LocalizedText message="ui.this.is.a.clinical.use.case.i.confirm.the.fields.above.m.f472ba9e" /><b>{context.pageId}</b><LocalizedText message="ui.the.assistant.summarises.it.does.not.diagnose.4388468f" /></span>
          </label>
        ) : null}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}><LocalizedText message="ui.cancel.19766ed6" /></Button>
          <span className="flex-1" />
          <Button variant="primary" size="sm" loading={sending}
            disabled={context.fields.length === 0 || (clinical && !acknowledged) || !config?.credential.configured}
            onClick={onConfirm}><LocalizedText message="ui.send.e8fbd3f3" />{context.fields.length} {context.fields.length === 1 ? <LocalizedText message="ui.field.c0d2856b" /> : <LocalizedText message="ui.fields.bfe5d697" />}
          </Button>
        </div>
        {!config?.credential.configured ? (
          <p className="mt-2 text-[length:calc(8.5px*var(--fs-scale))] text-[var(--text-muted)]"><LocalizedText message="ui.no.provider.credential.is.configured.for.this.tenant.so.a77c2f62" /></p>
        ) : null}
      </div>
    </div>
  );
}
