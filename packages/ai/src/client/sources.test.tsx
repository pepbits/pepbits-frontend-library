import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AiSourcesProvider, useAiSources, usePublishAiSources } from "./sources.tsx";

/**
 * A page PUBLISHES; the assistant reads. The inversion is the design: if the
 * panel reached into pages for data it would need a general way to find it, and
 * a general finder is exactly the "fetches related records" widening the spec
 * forbids. These pin the two halves -- what an assistant can see, and what it
 * stops seeing when a page goes away.
 */

function Publisher({ owner, id, source = "page-record" }: { owner: string; id: string; source?: string }) {
  /* A NEW object every render, which is what real pages do. The provider's
     content compare is the only thing that stops this looping. */
  usePublishAiSources(owner, { [source]: { id } } as never);
  return null;
}

function Reader() {
  return <output data-testid="sources">{JSON.stringify(useAiSources())}</output>;
}

const read = () => JSON.parse(screen.getByTestId("sources").textContent ?? "{}");

describe("publishing", () => {
  test("what a page offers is what the assistant sees", () => {
    render(
      <AiSourcesProvider>
        <Publisher owner="items-a" id="C-100" />
        <Reader />
      </AiSourcesProvider>,
    );
    expect(read()).toEqual({ "page-record": { id: "C-100" } });
  });

  test("nothing is on offer before a page publishes", () => {
    render(
      <AiSourcesProvider>
        <Reader />
      </AiSourcesProvider>,
    );
    expect(read()).toEqual({});
  });

  /* An assistant mounted outside the provider is a page with nothing to offer,
     not a crash. The panel is chrome; it renders on screens that never opted in. */
  test("reading without a provider gives an empty offer rather than throwing", () => {
    expect(() => render(<Reader />)).not.toThrow();
    expect(read()).toEqual({});
  });

  test("two pages both contribute", () => {
    render(
      <AiSourcesProvider>
        <Publisher key="items-a" owner="items-a" id="C-100" />
        <Publisher key="worklist" owner="worklist" id="W-1" source="form-values" />
        <Reader />
      </AiSourcesProvider>,
    );
    expect(read()).toEqual({ "page-record": { id: "C-100" }, "form-values": { id: "W-1" } });
  });

  test("a later publish replaces the value it published before", () => {
    const { rerender } = render(
      <AiSourcesProvider>
        <Publisher owner="items-a" id="C-100" />
        <Reader />
      </AiSourcesProvider>,
    );
    rerender(
      <AiSourcesProvider>
        <Publisher owner="items-a" id="C-200" />
        <Reader />
      </AiSourcesProvider>,
    );
    expect(read()).toEqual({ "page-record": { id: "C-200" } });
  });
});

describe("retracting", () => {
  /* Keyed by owner so an unmounting page removes exactly its own contribution.
     A single flat object would let a stale worklist selection survive into the
     next page, which is precisely the kind of leak nobody notices. */
  test("a page that goes away takes its data with it", () => {
    const { rerender } = render(
      <AiSourcesProvider>
        <Publisher owner="items-a" id="C-100" />
        <Reader />
      </AiSourcesProvider>,
    );
    expect(read()).toEqual({ "page-record": { id: "C-100" } });
    rerender(
      <AiSourcesProvider>
        <Reader />
      </AiSourcesProvider>,
    );
    expect(read()).toEqual({});
  });

  /* The keys are load-bearing. Without them React reconciles these two by
     position: dropping the first turns the surviving element into an UPDATE of
     the first, which re-runs its effect and republishes under the new owner.
     The written-down assertion then held for a reason that had nothing to do
     with retract, and a retract that wiped every page passed it. */
  test("and leaves the pages that are still there alone", () => {
    const both = (
      <AiSourcesProvider>
        <Publisher key="items-a" owner="items-a" id="C-100" />
        <Publisher key="worklist" owner="worklist" id="W-1" source="form-values" />
        <Reader />
      </AiSourcesProvider>
    );
    const { rerender } = render(both);
    expect(read()).toEqual({ "page-record": { id: "C-100" }, "form-values": { id: "W-1" } });
    rerender(
      <AiSourcesProvider>
        <Publisher key="worklist" owner="worklist" id="W-1" source="form-values" />
        <Reader />
      </AiSourcesProvider>,
    );
    expect(read()).toEqual({ "form-values": { id: "W-1" } });
  });
});

/**
 * The loop that broke navigation.
 *
 * publish and retract used to be rebuilt in the same useMemo as the data, so
 * every publish handed subscribers new functions, the effect that lists them
 * re-ran, and the cycle repeated. Outside a navigation React's bail-out hid it;
 * during an App Router transition the subtree re-renders from a fresh payload,
 * the bail-out no longer applies, and the URL simply never commits.
 *
 * Restoring that bug does not fail these tests so much as end the run: the loop
 * is inside render(), so the process exhausts its heap before any assertion is
 * reached. Red either way, but worth knowing what it looks like.
 */
describe("stability", () => {
  test("publishing does not re-render the page that published", () => {
    let renders = 0;
    function Counting() {
      renders += 1;
      usePublishAiSources("items-a", { "page-record": { id: "C-100" } } as never);
      return null;
    }
    render(
      <AiSourcesProvider>
        <Counting />
        <Reader />
      </AiSourcesProvider>,
    );
    /* One render, then one more for the state the publish set. Anything that
       grows with each publish is the loop coming back. */
    expect(renders).toBeLessThanOrEqual(2);
    expect(read()).toEqual({ "page-record": { id: "C-100" } });
  });

  test("republishing identical content changes nothing", () => {
    let renders = 0;
    function Counting({ tick }: { tick: number }) {
      renders += 1;
      /* `tick` changes, the published content does not. A page re-rendering for
         its own reasons must not churn the assistant's view. */
      void tick;
      usePublishAiSources("items-a", { "page-record": { id: "C-100" } } as never);
      return null;
    }
    const tree = (tick: number) => (
      <AiSourcesProvider>
        <Counting tick={tick} />
        <Reader />
      </AiSourcesProvider>
    );
    const { rerender } = render(tree(1));
    const settled = renders;
    rerender(tree(2));
    rerender(tree(3));
    expect(renders - settled).toBeLessThanOrEqual(2);
  });
});

describe("document isolation", () => {
  test("the focused record owns panel sources even when another record publishes last", async () => {
    const { createWorkspace, WorkspaceProvider, DocumentProvider } = await import("@pepbits/shell/workspace");
    const workspace = createWorkspace({ session: { tenantId: "t", userId: "u" }, policy: { platform: { modes: ["TAB", "SPLIT"] } } });
    const a = workspace.openDocument({ module: "M", documentType: "CUSTOMER", entityId: "A", title: "A" }).document!;
    const b = workspace.openDocument({ module: "M", documentType: "CUSTOMER", entityId: "B", title: "B" }).document!;
    workspace.focusDocument(a.documentId);
    const InlineReader = () => <output data-testid="inline-sources">{JSON.stringify(useAiSources())}</output>;
    const tree = (showB: boolean) => <WorkspaceProvider workspace={workspace}><AiSourcesProvider>
      <DocumentProvider documentId={a.documentId}><Publisher owner="form:customer" id="A" /><InlineReader /></DocumentProvider>
      {showB && <DocumentProvider documentId={b.documentId}><Publisher owner="form:customer" id="B" /></DocumentProvider>}
      <Reader />
    </AiSourcesProvider></WorkspaceProvider>;
    const { rerender } = render(tree(true));
    expect(read()).toEqual({ "page-record": { id: "A" } });
    React.act(() => { workspace.focusDocument(b.documentId); });
    expect(read()).toEqual({ "page-record": { id: "B" } });
    expect(JSON.parse(screen.getByTestId("inline-sources").textContent!)).toEqual({ "page-record": { id: "A" } });
    rerender(tree(false));
    expect(read()).toEqual({});
    React.act(() => { workspace.focusDocument(a.documentId); });
    expect(read()).toEqual({ "page-record": { id: "A" } });
  });
});
