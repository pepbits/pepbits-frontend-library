"use client";

import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { useDocumentScope } from "@pepbits/shell/workspace";
import type { AiSources } from "./assemble.ts";

/**
 * What the current page is willing to hand the assistant.
 *
 * A page PUBLISHES; the assistant reads. The inversion matters: if the panel
 * reached into pages for data it would need a way to find it, and a general
 * finder is exactly the "fetches related records" widening the design forbids
 * (spec D5). Here a page can only offer what it already has on screen, and the
 * use case still filters that down.
 */
const SourcesContext = createContext<{
  byOwner: Record<string, { scope: string | null; sources: AiSources }>;
  publish: (owner: string, scope: string | null, sources: AiSources) => void;
  retract: (owner: string) => void;
} | null>(null);

export function AiSourcesProvider({ children }: { children: React.ReactNode }) {
  /* Keyed by owner so an unmounting page removes exactly its own contribution.
     A single flat object would let a stale worklist selection survive into the
     next page, which is precisely the kind of leak nobody notices. */
  const [byOwner, setByOwner] = useState<Record<string, { scope: string | null; sources: AiSources }>>({});

  /* publish and retract are STABLE -- `setByOwner` never changes identity, so
     these never do either. That is load-bearing, not tidiness.

     They used to be rebuilt inside the same useMemo as `sources`, on [byOwner].
     Every publish therefore handed subscribers a new `publish`, and the effect
     in usePublishAiSources listed the whole context object in its deps: publish
     -> new context -> effect re-runs -> cleanup retracts -> new context ->
     publish, without end.

     Outside a navigation this was invisible. React bails out of re-rendering
     children whose element identity has not changed, so the page never
     re-rendered and the cycle stopped after one turn. During a Next App Router
     navigation the subtree IS re-rendered from a fresh payload, the bail-out no
     longer applies, and the loop starves the transition: the RSC payload
     arrives 200, nothing throws, and the URL simply never commits. */
  const publish = useCallback((owner: string, scope: string | null, sources: AiSources) => {
    const entry = { scope, sources };
    setByOwner((previous) => (JSON.stringify(previous[owner]) === JSON.stringify(entry) ? previous : { ...previous, [owner]: entry }));
  }, []);

  const retract = useCallback((owner: string) => {
    setByOwner((previous) => {
      if (!(owner in previous)) return previous;
      const next = { ...previous };
      delete next[owner];
      return next;
    });
  }, []);

  const value = useMemo(() => ({ byOwner, publish, retract }), [byOwner, publish, retract]);

  return <SourcesContext.Provider value={value}>{children}</SourcesContext.Provider>;
}

/** Read-only view, for the assistant. Empty when no provider is mounted, which
    is a page with nothing to offer rather than an error. */
export function useAiSources(): AiSources {
  const context = useContext(SourcesContext);
  const scope = useDocumentScope();
  return useMemo(() => Object.values(context?.byOwner ?? {})
    .filter(entry => entry.scope === scope)
    .reduce<AiSources>((all, entry) => ({ ...all, ...entry.sources }), {}), [context?.byOwner, scope]);
}

/**
 * Publish this page's data for as long as the component is mounted.
 *
 * The compare in `publish` is what keeps this from looping: callers pass a
 * freshly built object every render, and without it each publish would set
 * state, re-render, and publish again.
 */
export function usePublishAiSources(owner: string, sources: AiSources): void {
  const context = useContext(SourcesContext);
  const scope = useDocumentScope();
  const instance = useId();
  const publisherId = JSON.stringify([owner, instance]);
  /* The FUNCTIONS, not the context object. Depending on the whole context here
     is what created the publish/retract loop described in the provider: the
     object changes on every publish, including this component's own. */
  const publish = context?.publish;
  const retract = context?.retract;
  const serialised = JSON.stringify(sources);
  const latest = useRef(sources);
  latest.current = sources;

  useEffect(() => {
    if (!publish || !retract) return;
    publish(publisherId, scope, latest.current);
    return () => retract(publisherId);
    // serialised, not `sources`: a new object with identical content is not a change.
  }, [publish, retract, publisherId, scope, serialised]);
}
