"use client";
import { Card } from "@pepbits/components";
import { LocalizedText, useLocalization } from "@pepbits/i18n/react";


import React, { useEffect, useMemo, useState } from "react";
import { Bot, ChevronLeft, MessageSquare, Sparkles, SquareTerminal, X } from "@pepbits/icons";
import { Badge, Button, IconButton, cn } from "@pepbits/ui";
import type { AiContext, AiUseCase } from "@pepbits/ai/config";
import type { AiReply } from "@pepbits/ai/client";
import { useNavigation } from "@pepbits/platform";
import { useERP } from "@pepbits/shell";
import { TransparencyPanel } from "./transparency.tsx";
import { AiTerminal } from "./terminal.tsx";
import { useAssistant } from "./use-assistant.ts";

type Stage = "choose" | "review" | "answer";

/**
 * The docked assistant.
 *
 * Renders NOTHING unless every gate allows it. That is deliberately a return of
 * null rather than a disabled button: a control the user can see but not use
 * invites them to go looking for the permission, and on most pages the honest
 * answer is that the assistant does not belong there at all.
 */
export function AssistantPanel() {
  const {t: translateCopy} = useLocalization();
  const navigation = useNavigation();
  /* The ONE place access and the use-case set come from. Terminal and inline
     read the same object, which is what makes "one removal, three
     disappearances" structural rather than a promise. */
  const assistant = useAssistant();

  /* Both panels are ~370px wide and both anchor to bottom-28 right-5, so with
     both open one sits on top of the other. Resolved HERE rather than by moving
     one aside: side by side survives a wide screen and collides again on a
     narrow one, and two panels in a corner is cluttered even when it fits.

     It is one-sided in the code and two-sided in effect. ai-ui already depends
     on shell for the ERP context, so this reads and writes `helpOpen`
     directly and shell learns nothing -- help-assistant.tsx is untouched,
     which also means the tour cannot be interrupted by an import it does not
     know about. */
  const { helpOpen, setHelpOpen } = useERP();
  const [open, setOpen] = useState(false);

  /* Help winning is deliberate: it is the older affordance and the one a
     confused user reaches for, so it should never be the thing that closes. */
  useEffect(() => { if (helpOpen) setOpen(false); }, [helpOpen]);

  const openAssistant = (next: boolean) => {
    if (next) setHelpOpen(false);
    setOpen(next);
  };
  const [mode, setMode] = useState<"panel" | "terminal">("panel");
  const [stage, setStage] = useState<Stage>("choose");
  const [chosen, setChosen] = useState<AiUseCase | null>(null);
  const [context, setContext] = useState<AiContext | null>(null);
  const [reply, setReply] = useState<AiReply | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => { if (open && assistant.allowed) assistant.loadConfig(); }, [assistant.loadConfig, assistant.allowed, open]);
  useEffect(() => { if (!assistant.allowed) setOpen(false); }, [assistant.allowed]);

  /* A page change invalidates everything: the use cases differ, and a context
     assembled from the previous page's record must never survive into the next
     one's request. */
  useEffect(() => {
    setStage("choose"); setChosen(null); setContext(null); setReply(null);
  }, [navigation.current.pageId]);

  if (!assistant.allowed) return null;
  const useCases = assistant.useCases;

  const choose = (useCase: AiUseCase) => {
    setChosen(useCase);
    setContext(assistant.prepare(useCase));
    setStage("review");
  };

  const send = async () => {
    if (!chosen || !context) return;
    setSending(true);
    /* Re-runs assembly so what is sent is what the page holds NOW, not what it
       held when the panel was opened. The transparency panel is re-rendered
       from the returned context for the same reason. */
    const { context: sent, reply: answer } = await assistant.run(chosen);
    setContext(sent);
    setReply(answer);
    setSending(false);
    setStage("answer");
  };

  return (
    <>
      {/* Matched to shell's help button on purpose: same size, radius,
          fill and elevation, sitting beside it rather than above. Two peers in
          one corner, not a primary control and an afterthought. The help
          button itself is untouched -- this one was moved to meet it. */}
      <button type="button" aria-label={translateCopy("ui.open.the.ai.assistant.9ef7c20f")} title={translateCopy("AI assistant — {count} available here",{count:useCases.length})}
        onClick={() => openAssistant(!open)}
        className="no-print fixed bottom-12 right-20 z-[70] flex size-12 items-center justify-center rounded-2xl bg-[var(--primary-fill)] text-white shadow-[var(--shadow-md)] transition hover:-translate-y-0.5">
        <Sparkles className="size-5" />
      </button>

      {open ? (
        <Card shadow="lg" role="dialog" aria-label={translateCopy("ui.ai.assistant.ab6eb4ac")}
          className="animate-slide-up no-print fixed bottom-28 right-5 z-[71] flex max-h-[70vh] w-[380px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
            {mode === "panel" && stage !== "choose" ? (
              <IconButton label="ui.back.76900f1b" className="size-7" onClick={() => { setStage("choose"); setReply(null); }}><ChevronLeft className="size-4" /></IconButton>
            ) : <Bot className="size-4 text-[var(--primary)]" />}
            <span className="min-w-0 flex-1 truncate text-[length:calc(11.5px*var(--fs-scale))] font-extrabold">
              {stage === "choose" ? <LocalizedText message="ui.ai.assistant.ab6eb4ac" /> : chosen?.label}
            </span>
            <Badge tone="neutral"><LocalizedText message={assistant.pageTitle} /></Badge>
            <IconButton label={mode === "panel" ? "Terminal mode" : "Panel mode"} className="size-7"
              onClick={() => setMode((previous) => (previous === "panel" ? "terminal" : "panel"))}>
              {mode === "panel" ? <SquareTerminal className="size-4" /> : <MessageSquare className="size-4" />}
            </IconButton>
            <IconButton label="ui.close.7d9eb7ac" className="size-7" onClick={() => setOpen(false)}><X className="size-4" /></IconButton>
          </div>

          {mode === "terminal" ? <AiTerminal assistant={assistant} /> : null}

          {mode === "panel" && stage === "choose" ? (
            <div className="nex-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
              <p className="mb-2 text-[length:calc(9.5px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]"><LocalizedText message="ui.enabled.here.by.the.9729cac7" /><b>{assistant.decidedBy}</b><LocalizedText message="ui.gate.you.will.see.exactly.what.is.captured.before.anythi.26f5481b" /></p>
              <div className="grid gap-2">
                {useCases.map((useCase) => (
                  <button key={useCase.id} type="button" onClick={() => choose(useCase)}
                    className={cn("focus-ring rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition hover:border-[var(--primary)] hover:bg-[var(--surface-2)]")}>
                    <span className="flex items-center gap-2">
                      <span className="text-[length:calc(11px*var(--fs-scale))] font-extrabold"><LocalizedText message={useCase.label} /></span>
                      {useCase.category === "clinical" ? <Badge tone="warning"><LocalizedText message="ui.clinical.98569e7e" /></Badge> : null}
                    </span>
                    <span className="mt-1 block text-[length:calc(9.5px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]"><LocalizedText message={useCase.description} /></span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {mode === "panel" && stage === "review" && chosen && context ? (
            <TransparencyPanel context={context} useCase={chosen} config={assistant.config} decidedBy={assistant.decidedBy} simulation={assistant.simulation}
              sending={sending} onCancel={() => setStage("choose")} onConfirm={() => void send()} />
          ) : null}

          {mode === "panel" && stage === "answer" ? (
            <div className="nex-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
              {reply?.via === "mock" ? (
                <div className="mb-2 rounded-lg border border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-2.5 py-1.5 text-[length:calc(9px*var(--fs-scale))] font-bold text-[var(--text)]"><LocalizedText message="ui.mock.transport.no.provider.was.contacted.a98a191e" /></div>
              ) : null}
              {/* A refusal is not an answer, and without this it renders as one:
                  the text below is the same <pre> either way. The dispatch guard
                  stops the request before anything is contacted, so the panel has
                  to say that rather than leave a plausible-looking reply. */}
              {reply?.via === "blocked" ? (
                <div className="mb-2 rounded-lg border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-2.5 py-1.5 text-[length:calc(9px*var(--fs-scale))] font-bold text-[var(--text)]"><LocalizedText message="ui.not.sent.this.request.was.held.back.before.it.left.the.b.249b6f31" /></div>
              ) : null}
              <pre className="whitespace-pre-wrap break-words font-sans text-[length:calc(10.5px*var(--fs-scale))] leading-relaxed">{reply?.text ?? translateCopy(reply?.error ?? "")}</pre>
              <Button className="mt-3" size="sm" variant="secondary" onClick={() => setStage("choose")}><LocalizedText message="ui.ask.something.else.6b2e237d" /></Button>
            </div>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}
