import React from "react";
import {act, screen, waitFor} from "@testing-library/react";
import {render} from "../test/render";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NavigationProvider } from "@pepbits/platform";
import type { NavigationPort } from "@pepbits/platform";
import type { AiPolicy } from "@pepbits/ai/config";

const useSession = vi.hoisted(() => vi.fn());
/* Ids the catalogue pretends not to know, so a page can be made to declare a
   use case that no longer exists — see "a use case the catalogue has dropped". */
const dropped = vi.hoisted(() => new Set<string>());
const fetchAiPolicy = vi.hoisted(() => vi.fn());
const fetchAiConfig = vi.hoisted(() => vi.fn());
const dispatchAi = vi.hoisted(() => vi.fn());

vi.mock("@pepbits/platform", async original => ({...await original<typeof import('@pepbits/platform')>(),useSession}));
vi.mock("./provider", async () => {
  const {USE_CASES,getUseCase}=await import('../test/catalog');
  const {assembleContext}=await import('../test/runtime');
  return {useAiHost:()=>({client:{fetchAiPolicy,fetchAiConfig,dispatchAi,assembleContext},catalogue:{useCases:USE_CASES,getUseCase:(id:string)=>dropped.has(id)?undefined:getUseCase(id)},pages:{
    'items-b':{pageId:'items-b',module:'resources',title:'Items B',build:{enabled:true,useCases:['worklist.summarise-selection','record.explain']}},
    'items-a':{pageId:'items-a',module:'operations',title:'Items A',build:{enabled:true,useCases:['worklist.summarise-selection','record.explain']}},
    preferences:{pageId:'preferences',module:'shared',title:'Preferences'}
  }})};
});

const { AiSourcesProvider, usePublishAiSources } = await import("@pepbits/ai/client");
const { useAssistant } = await import("./use-assistant.ts");
const { config } = await import("./fixtures.test-support.ts");

/**
 * The engine behind every mode.
 *
 * Panel, terminal and inline action are three affordances over THIS, not three
 * implementations of one idea, and `useCases` is the single resolved list all
 * three enumerate. Everything below is about that list being the gates' answer
 * rather than the page's opinion.
 */

/* A page with a build block, so gate 1 passes and the rest have something to
   narrow. Its two use cases are declared in PAGE_REGISTRY. */
const PAGE = "items-b";
const BUILT_IN = ["worklist.summarise-selection", "record.explain"];

const policy = (over: Partial<AiPolicy> = {}): AiPolicy => ({
  tenantId: "t1",
  global: {},
  modules: {},
  pages: {},
  useCases: {},
  ...over,
});

const navigation = (pageId = PAGE): NavigationPort => ({
  current: { pageId },
  open: vi.fn(),
  openInNewContext: vi.fn(),
  hrefFor: () => "#",
});

let latest: ReturnType<typeof useAssistant>;

function Probe({ publish }: { publish?: Record<string, unknown> }) {
  usePublishAiSources("page", (publish ?? {}) as never);
  latest = useAssistant();
  return (
    <div>
      <output data-testid="allowed">{String(latest.allowed)}</output>
      <output data-testid="decided">{latest.decidedBy}</output>
      <output data-testid="cases">{latest.useCases.map((useCase) => useCase.id).join("|")}</output>
      <output data-testid="title">{latest.pageTitle}</output>
      <output data-testid="config">{latest.config ? "loaded" : "none"}</output>
    </div>
  );
}

const mount = (port = navigation(), publish?: Record<string, unknown>) =>
  render(
    <NavigationProvider value={port}>
      <AiSourcesProvider><Probe publish={publish} /></AiSourcesProvider>
    </NavigationProvider>,
  );

const read = (id: string) => screen.getByTestId(id).textContent;
const settled = () => waitFor(() => expect(screen.getByTestId("cases")).toBeInTheDocument());

beforeEach(() => {
  useSession.mockReturnValue({ user: { id: "u1", tenantId: "t1" } });
  fetchAiPolicy.mockReset();
  fetchAiPolicy.mockResolvedValue(policy());
  fetchAiConfig.mockReset();
  fetchAiConfig.mockResolvedValue({ ok: true, status: 200, data: config() });
  dispatchAi.mockReset();
  dispatchAi.mockResolvedValue({ ok: true, text: "an answer", via: "service" });
  dropped.clear();
});

describe("what the page is allowed", () => {
  test("offers the use cases the page declares", async () => {
    mount();
    await waitFor(() => expect(read("cases")).toBe(BUILT_IN.join("|")));
    expect(read("allowed")).toBe("true");
  });

  /* Gate 1 is the one an administrator cannot reach: a page with no build
     block never renders the assistant, whatever the policy says. */
  test("a page with no build block is refused, whatever the policy allows", async () => {
    fetchAiPolicy.mockResolvedValue(policy({ global: { platform: { allowed: true } } }));
    mount(navigation("preferences"));
    await settled();
    expect(read("allowed")).toBe("false");
    expect(read("cases")).toBe("");
  });

  test("a page nobody has registered is refused, and says which gate", async () => {
    mount(navigation("no-such-page"));
    await settled();
    expect(read("allowed")).toBe("false");
    expect(read("decided")).toBe("build");
  });

  /* Deny-wins, at any level. */
  test("the platform switching it off refuses everything under it", async () => {
    fetchAiPolicy.mockResolvedValue(policy({ global: { platform: { allowed: false } } }));
    mount();
    await waitFor(() => expect(read("allowed")).toBe("false"));
    expect(read("decided")).toBe("platform");
  });

  test("a module switched off refuses its pages", async () => {
    fetchAiPolicy.mockResolvedValue(policy({ modules: { resources: { allowed: false } } }));
    mount();
    await waitFor(() => expect(read("allowed")).toBe("false"));
  });

  /* Narrowing, not granting. A gate may remove a use case the page declared; it
     can never add one the page did not. */
  test("a gate narrows the list rather than replacing it", async () => {
    fetchAiPolicy.mockResolvedValue(policy({ pages: { [PAGE]: { useCases: ["record.explain"] } } }));
    mount();
    await waitFor(() => expect(read("cases")).toBe("record.explain"));
  });

  test("a gate cannot add a use case the page never declared", async () => {
    fetchAiPolicy.mockResolvedValue(policy({ pages: { [PAGE]: { useCases: ["dashboard.explain-metrics"] } } }));
    mount();
    await waitFor(() => expect(read("cases")).toBe(""));
    /* Nothing survived the intersection, so there is nothing to offer — and
       `allowed` says so even though the gates themselves said yes. */
    expect(read("allowed")).toBe("false");
  });

  test("a use case disabled everywhere disappears from the page that declared it", async () => {
    fetchAiPolicy.mockResolvedValue(policy({ useCases: { "record.explain": { allowed: false } } }));
    mount();
    await waitFor(() => expect(read("cases")).toBe("worklist.summarise-selection"));
  });

  /* A page declares use cases by id, and the catalogue can lose one: removed in
     a release while a registry entry still names it. The gates all say yes —
     nothing was denied — and the resolved list is still empty, so `allowed` has
     to account for the list as well as the verdict. Without that, the assistant
     renders with a menu of nothing. */
  test("a use case the catalogue has dropped is not offered", async () => {
    dropped.add("record.explain");
    mount();
    await waitFor(() => expect(read("cases")).toBe("worklist.summarise-selection"));
    expect(read("allowed")).toBe("true");
  });

  test("and a page whose every use case has gone is not allowed at all", async () => {
    for (const id of BUILT_IN) dropped.add(id);
    mount();
    await waitFor(() => expect(read("cases")).toBe(""));
    expect(read("allowed")).toBe("false");
  });

  test("names the page for the surfaces to title themselves with", async () => {
    mount();
    await settled();
    expect(read("title")).not.toBe("Workspace");
    expect(read("title")).toBeTruthy();
  });

  test("and falls back to a generic title on a page it does not know", async () => {
    mount(navigation("no-such-page"));
    await settled();
    expect(read("title")).toBe("Workspace");
  });

  /* A failed policy fetch resolves to null, which is not a denial: the client
     decides what to RENDER and the server re-checks at dispatch. */
  test("an unavailable policy leaves the page's own declaration standing", async () => {
    fetchAiPolicy.mockResolvedValue(null);
    mount();
    await waitFor(() => expect(read("cases")).toBe(BUILT_IN.join("|")));
  });

  test("asks for the policy of the signed-in user", async () => {
    mount();
    await settled();
    expect(fetchAiPolicy).toHaveBeenCalledWith("u1");
  });

  test("asks for nothing at all when nobody is signed in", async () => {
    useSession.mockReturnValue({ user: null });
    mount();
    await settled();
    expect(fetchAiPolicy).not.toHaveBeenCalled();
    /* The page's own declaration still stands, and the server re-checks. */
    expect(read("allowed")).toBe("true");
  });
});

describe("preparing and running", () => {
  const sources = { "page-record": { id: "E-100", status: "Active", email: "aisha@example.invalid" } };

  test("prepare assembles from what the page published, and sends nothing", async () => {
    mount(navigation(), sources);
    await settled();
    const context = latest.prepare(latest.useCases.find((u) => u.id === "record.explain")!);
    expect(context.fields.map((f) => f.label)).toEqual(["Id", "Status"]);
    expect(dispatchAi).not.toHaveBeenCalled();
  });

  /* The use case is the allowlist, and the engine does not widen it: `email`
     is on the page and is not in `reads`, so it is not in the context. */
  test("prepare reads only what the use case names", async () => {
    mount(navigation(), sources);
    await settled();
    const context = latest.prepare(latest.useCases.find((u) => u.id === "record.explain")!);
    expect(JSON.stringify(context)).not.toContain("example.invalid");
  });

  test("prepare stamps the page the request was made from", async () => {
    mount(navigation(), sources);
    await settled();
    expect(latest.prepare(latest.useCases[1]!).pageId).toBe(PAGE);
  });

  test("prepare carries what the user typed", async () => {
    mount(navigation(), sources);
    await settled();
    expect(latest.prepare(latest.useCases[1]!, "why?").userInput).toBe("why?");
  });

  test("run assembles and dispatches the same context it returns", async () => {
    mount(navigation(), sources);
    await settled();
    const { context, reply } = await latest.run(latest.useCases[1]!);
    expect(dispatchAi).toHaveBeenCalledTimes(1);
    expect(dispatchAi.mock.calls[0]![0]).toBe(context);
    expect(reply.text).toBe("an answer");
  });
});

describe("the administration config", () => {
  /* Fetched on demand, not on every page load: §6 separates the two endpoints
     precisely so provider and limit data do not ride along with a navigation. */
  test("is not fetched until a surface asks for it", async () => {
    mount();
    await settled();
    expect(fetchAiConfig).not.toHaveBeenCalled();
    expect(read("config")).toBe("none");
  });

  test("arrives once asked for", async () => {
    mount();
    await settled();
    await act(async()=>latest.loadConfig());
    await waitFor(() => expect(read("config")).toBe("loaded"));
    expect(fetchAiConfig).toHaveBeenCalledTimes(1);
  });

  test("a refused config leaves it null rather than half-built", async () => {
    fetchAiConfig.mockResolvedValue({ ok: false, status: 403, error: "No authorization layer." });
    mount();
    await settled();
    await act(async()=>latest.loadConfig());
    await waitFor(() => expect(fetchAiConfig).toHaveBeenCalled());
    expect(read("config")).toBe("none");
  });
});

test("an inline assistant uses its owning document's page while another page is focused", async () => {
  const { createWorkspace, WorkspaceProvider, DocumentProvider } = await import("@pepbits/shell/workspace");
  const workspace = createWorkspace({ session: { tenantId: "t1", userId: "u1" }, policy: { platform: { modes: ["TAB"] } } });
  const a = workspace.openDocument({ module: "resources", documentType: "EMPLOYEE", entityId: "A", title: "A", route: PAGE }).document!;
  workspace.openDocument({ module: "operations", documentType: "CUSTOMER", entityId: "B", title: "B", route: "items-a" });
  render(<WorkspaceProvider workspace={workspace}><NavigationProvider value={navigation("items-a")}><AiSourcesProvider>
    <DocumentProvider documentId={a.documentId}><Probe publish={{ "page-record": { id: "A", status: "Active" } }} /></DocumentProvider>
  </AiSourcesProvider></NavigationProvider></WorkspaceProvider>);
  await settled();
  expect(latest.pageId).toBe(PAGE);
});
