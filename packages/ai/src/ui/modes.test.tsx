import React from "react";
import {fireEvent,  screen, waitFor} from "@testing-library/react";
import {render} from "../test/render";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NavigationProvider } from "@pepbits/platform";
import type { AiUseCase } from "@pepbits/ai/config";
import type { AiReply } from "@pepbits/ai/client";

const assistantValue = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("./use-assistant.ts", () => ({ useAssistant: () => assistantValue.current }));
const erp = vi.hoisted(() => ({ helpOpen: false, setHelpOpen: vi.fn() }));
vi.mock("@pepbits/shell", () => ({ useERP: () => erp }));

const { AiTerminal } = await import("./terminal.tsx");
const { InlineAiAction } = await import("./inline-action.tsx");
const { AssistantPanel } = await import("./assistant-panel.tsx");
const { config, context, useCase } = await import("./fixtures.test-support.ts");

/**
 * Three affordances, one engine.
 *
 * Panel, terminal and inline action all enumerate `assistant.useCases` and none
 * of them resolves access itself. `verify:ai-modes` checks that structurally by
 * reading the files; this checks it by rendering all three and taking a use
 * case away — which is the thing the structure exists to guarantee.
 */

const EXPLAIN = useCase();
const SUMMARISE = useCase({
  id: "worklist.summarise-selection",
  label: "Summarise selection",
  description: "Summarises the records you have selected.",
});
const CLINICAL = useCase({ id: "restricted.summarise", label: "Summarise encounter", category: "clinical" });

const run = vi.fn<(useCase: AiUseCase, userInput?: string) => Promise<{ context: ReturnType<typeof context>; reply: AiReply }>>();
const prepare = vi.fn((useCase: AiUseCase) => context({ useCaseId: useCase.id }));

const assistant = (useCases: AiUseCase[], over: Record<string, unknown> = {}) => {
  assistantValue.current = {
    allowed: useCases.length > 0,
    decidedBy: "page",
    reason: "",
    useCases,
    pageId: "items-a",
    pageTitle: "Items A",
    config: config(),
    prepare,
    run,
    loadConfig: vi.fn(),
    ...over,
  };
  return assistantValue.current as never;
};

const navigation = {
  current: { pageId: "items-a" },
  open: vi.fn(),
  openInNewContext: vi.fn(),
  hrefFor: () => "#",
};

const withNav = (node: React.ReactNode) => render(<NavigationProvider value={navigation}>{node}</NavigationProvider>);
const type = (text: string) => {
  const input = screen.getByLabelText("Assistant command");
  fireEvent.change(input, { target: { value: text } });
  fireEvent.submit(input.closest("form")!);
};
const transcript = () => document.body.textContent ?? "";

beforeEach(() => {
  run.mockReset();
  run.mockResolvedValue({ context: context(), reply: { ok: true, text: "an answer", via: "service" } });
  prepare.mockClear();
  erp.helpOpen = false;
});

describe("the terminal", () => {
  const terminal = (useCases = [EXPLAIN, SUMMARISE]) => render(<AiTerminal assistant={assistant(useCases) as never} />);

  /* The command list is GENERATED from assistant.useCases, never written down
     in the file. That is why terminal mode is not a bypass: it can only name
     what the gates already allowed. */
  test(":help lists exactly what the gates allowed, and says which gate", async () => {
    terminal();
    type(":help");
    await waitFor(() => expect(transcript()).toContain("Explain this record"));
    expect(transcript()).toContain("Summarise selection");
    expect(transcript()).toContain("page gate");
    expect(transcript()).toContain("2 commands");
  });

  test(":help counts a single command in the singular", async () => {
    terminal([EXPLAIN]);
    type(":help");
    await waitFor(() => expect(transcript()).toContain("1 command"));
  });

  test("a command runs through the shared engine", async () => {
    terminal();
    type(":explain");
    await waitFor(() => expect(transcript()).toContain("an answer"));
    expect(run).toHaveBeenCalledWith(EXPLAIN, undefined);
  });

  test("anything after the command is passed on as what the user typed", async () => {
    terminal();
    type(":explain why is this overdue?");
    await waitFor(() => expect(run).toHaveBeenCalledWith(EXPLAIN, "why is this overdue?"));
  });

  /* Deliberately identical wording whether the command never existed or was
     removed by a gate. "Disabled for your tenant" would tell the user which
     capabilities exist elsewhere, which is not theirs to learn from a console. */
  test("refuses an unknown command and a gated-away one in the same words", async () => {
    const first = terminal([EXPLAIN, SUMMARISE]);
    type(":nonsense");
    await waitFor(() => expect(transcript()).toContain('No such command here: "nonsense"'));
    const unknown = screen.getByText(/No such command here/).textContent ?? "";
    /* Unmounted before the second: two terminals share the transcript this test
       reads, and the getByLabelText it types into would find both. */
    first.unmount();

    render(<AiTerminal assistant={assistant([SUMMARISE]) as never} />);
    type(":explain");
    await waitFor(() => expect(transcript()).toContain('No such command here: "explain"'));
    const gated = screen.getByText(/No such command here/).textContent ?? "";

    /* Same sentence, different noun. Nothing in either refusal says whether the
       command exists elsewhere, or that a gate had an opinion. */
    expect(unknown.replace("nonsense", "X")).toBe(gated.replace("explain", "X"));
    expect(gated).not.toMatch(/disabled|not permitted|your tenant|elsewhere/i);
  });

  test("says how commands are written when the colon is missing", async () => {
    terminal();
    type("explain");
    await waitFor(() => expect(transcript()).toContain("Commands start with a colon"));
  });

  /* :fields is the inspection command — it must never send. */
  test(":fields shows what would be captured, and sends nothing", async () => {
    terminal();
    type(":fields explain");
    await waitFor(() => expect(transcript()).toContain("C-100"));
    expect(prepare).toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  test(":fields marks the fields that were redacted", async () => {
    prepare.mockReturnValueOnce(context({
      fields: [{ key: "email", label: "Email", value: "a••••@example.invalid", source: "This record", redacted: true }],
    }));
    terminal();
    type(":fields explain");
    await waitFor(() => expect(transcript()).toContain("(redacted)"));
  });

  test(":fields says so when the page offers nothing", async () => {
    prepare.mockReturnValueOnce(context({ fields: [] }));
    terminal();
    type(":fields explain");
    await waitFor(() => expect(transcript()).toContain("Nothing on this page matches"));
  });

  test(":fields refuses a command the gates removed, in the same words", async () => {
    terminal([SUMMARISE]);
    type(":fields explain");
    await waitFor(() => expect(transcript()).toContain('No such command here: "explain"'));
  });

  test(":clear empties the transcript", async () => {
    terminal();
    type(":help");
    await waitFor(() => expect(transcript()).toContain("Explain this record"));
    type(":clear");
    await waitFor(() => expect(transcript()).not.toContain("Explain this record"));
  });

  /* A mock answer can never be mistaken for a real one. */
  test("says when nothing left the browser", async () => {
    run.mockResolvedValue({ context: context(), reply: { ok: true, text: "mocked", via: "mock" } });
    terminal();
    type(":explain");
    await waitFor(() => expect(transcript()).toContain("nothing left this browser"));
  });

  test("and says nothing of the sort when the service answered", async () => {
    terminal();
    type(":explain");
    await waitFor(() => expect(transcript()).toContain("an answer"));
    expect(transcript()).not.toContain("nothing left this browser");
  });

  test("shows a refusal from the engine rather than an empty answer", async () => {
    run.mockResolvedValue({ context: context(), reply: { ok: false, error: "This request was not sent: subjectName", via: "blocked" } });
    terminal();
    type(":explain");
    await waitFor(() => expect(transcript()).toContain("This request was not sent"));
  });
});

describe("the inline action", () => {
  const inline = (useCases: AiUseCase[], id = EXPLAIN.id) => {
    assistant(useCases);
    return withNav(<InlineAiAction useCaseId={id} />);
  };

  test("offers the use case it names", () => {
    inline([EXPLAIN, SUMMARISE]);
    expect(screen.getByRole("button", { name: /Explain this record/ })).toBeInTheDocument();
  });

  test("renders nothing when the gates removed it", () => {
    const { container } = inline([SUMMARISE]);
    expect(container).toBeEmptyDOMElement();
  });

  test("renders nothing when the assistant is not allowed here at all", () => {
    const { container } = inline([]);
    expect(container).toBeEmptyDOMElement();
  });

  /* There is no review stage here, so a clinical use case is never surfaced
     this way — the acknowledgement it requires lives in the panel. */
  test("never surfaces a clinical use case", () => {
    assistant([CLINICAL]);
    const { container } = withNav(<InlineAiAction useCaseId={CLINICAL.id} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("runs through the shared engine and shows the answer in place", async () => {
    inline([EXPLAIN]);
    fireEvent.click(screen.getByRole("button", { name: /Explain this record/ }));
    await waitFor(() => expect(screen.getByText("an answer")).toBeInTheDocument());
    expect(run).toHaveBeenCalledWith(EXPLAIN);
    expect(screen.getByText(/2 fields captured/)).toBeInTheDocument();
  });

  test("marks a mock answer as one", async () => {
    run.mockResolvedValue({ context: context(), reply: { ok: true, text: "mocked", via: "mock" } });
    inline([EXPLAIN]);
    fireEvent.click(screen.getByRole("button", { name: /Explain this record/ }));
    await waitFor(() => expect(screen.getByText(/mock transport/)).toBeInTheDocument());
  });

  test("shows a refusal rather than nothing", async () => {
    run.mockResolvedValue({ context: context(), reply: { ok: false, error: "not sent", via: "blocked" } });
    inline([EXPLAIN]);
    fireEvent.click(screen.getByRole("button", { name: /Explain this record/ }));
    await waitFor(() => expect(screen.getByText("not sent")).toBeInTheDocument());
  });

  test("the answer can be dismissed", async () => {
    inline([EXPLAIN]);
    fireEvent.click(screen.getByRole("button", { name: /Explain this record/ }));
    await waitFor(() => expect(screen.getByText("an answer")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("an answer")).toBeNull();
  });
});

describe("the docked panel", () => {
  const panel = (useCases: AiUseCase[]) => {
    assistant(useCases);
    return withNav(<AssistantPanel />);
  };
  const open = () => fireEvent.click(screen.getByRole("button", { name: "Open the AI assistant" }));

  /* Null rather than a disabled button: a control the user can see but not use
     invites them to go looking for the permission, and on most pages the honest
     answer is that the assistant does not belong there. */
  test("renders nothing at all where it is not allowed", () => {
    const { container } = panel([]);
    expect(container).toBeEmptyDOMElement();
  });

  test("offers exactly the use cases the engine resolved", () => {
    panel([EXPLAIN, SUMMARISE]);
    open();
    expect(screen.getByRole("button", { name: /Explain this record/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Summarise selection/ })).toBeInTheDocument();
  });

  test("says which gate allowed it", () => {
    panel([EXPLAIN]);
    open();
    expect(screen.getByText(/gate/)).toHaveTextContent("page");
  });

  test("marks a clinical use case in the list", () => {
    panel([EXPLAIN, CLINICAL]);
    open();
    expect(screen.getByText("clinical")).toBeInTheDocument();
  });

  test("choosing one shows the transparency panel before anything is sent", () => {
    panel([EXPLAIN]);
    open();
    fireEvent.click(screen.getByRole("button", { name: /Explain this record/ }));
    expect(prepare).toHaveBeenCalledWith(EXPLAIN);
    expect(run).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^Send 2 fields/ })).toBeInTheDocument();
  });

  /* Re-runs assembly on send, so what leaves is what the page holds NOW rather
     than what it held when the panel was opened. */
  test("sending re-assembles rather than replaying the reviewed context", async () => {
    panel([EXPLAIN]);
    open();
    fireEvent.click(screen.getByRole("button", { name: /Explain this record/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Send 2 fields/ }));
    await waitFor(() => expect(screen.getByText("an answer")).toBeInTheDocument());
    expect(run).toHaveBeenCalledWith(EXPLAIN);
  });

  test("a mock answer is banner-marked, not just worded", async () => {
    run.mockResolvedValue({ context: context(), reply: { ok: true, text: "mocked", via: "mock" } });
    panel([EXPLAIN]);
    open();
    fireEvent.click(screen.getByRole("button", { name: /Explain this record/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Send 2 fields/ }));
    await waitFor(() => expect(screen.getByText(/no provider was contacted/i)).toBeInTheDocument());
  });

  /* A refusal is not an answer, and without its own banner it renders as one:
     the text below is the same element either way. */
  test("a blocked request says it was held back, and does not read as an answer", async () => {
    run.mockResolvedValue({ context: context(), reply: { ok: false, error: "This request was not sent: subjectName", via: "blocked" } });
    panel([EXPLAIN]);
    open();
    fireEvent.click(screen.getByRole("button", { name: /Explain this record/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Send 2 fields/ }));
    await waitFor(() => expect(screen.getByText(/held back before it left the browser/i)).toBeInTheDocument());
    expect(screen.getByText(/This request was not sent/)).toBeInTheDocument();
    expect(screen.queryByText(/no provider was contacted/i)).toBeNull();
  });

  test("a service answer carries no banner at all", async () => {
    panel([EXPLAIN]);
    open();
    fireEvent.click(screen.getByRole("button", { name: /Explain this record/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Send 2 fields/ }));
    await waitFor(() => expect(screen.getByText("an answer")).toBeInTheDocument());
    expect(screen.queryByText(/no provider was contacted/i)).toBeNull();
    expect(screen.queryByText(/held back/i)).toBeNull();
  });

  /* Help is the older affordance and the one a confused user reaches for, so
     it should never be the thing that closes. */
  test("opening the assistant closes the help panel, not the other way round", () => {
    panel([EXPLAIN]);
    open();
    expect(erp.setHelpOpen).toHaveBeenCalledWith(false);
  });
});

/**
 * The guarantee itself: one removal, three disappearances.
 */
describe("one engine, three surfaces", () => {
  const all = (useCases: AiUseCase[]) => {
    assistant(useCases);
    return withNav(
      <>
        <AssistantPanel />
        <InlineAiAction useCaseId={EXPLAIN.id} />
        <AiTerminal assistant={assistantValue.current as never} />
      </>,
    );
  };

  test("a use case the gates allow is offered by all three", async () => {
    all([EXPLAIN, SUMMARISE]);
    fireEvent.click(screen.getByRole("button", { name: "Open the AI assistant" }));
    expect(screen.getAllByText("Explain this record").length).toBeGreaterThan(0);
    type(":help");
    await waitFor(() => expect(transcript()).toContain("Explain this record"));
  });

  test("and removing it takes it out of all three at once", async () => {
    all([SUMMARISE]);
    fireEvent.click(screen.getByRole("button", { name: "Open the AI assistant" }));
    /* The panel's chooser, the inline button, and the terminal's :help. */
    expect(screen.queryByText("Explain this record")).toBeNull();
    expect(screen.queryByRole("button", { name: /Explain this record/ })).toBeNull();
    type(":help");
    await waitFor(() => expect(transcript()).toContain("Summarise selection"));
    expect(transcript()).not.toContain("Explain this record");
    /* And it stops resolving, rather than merely being unlisted. */
    type(":explain");
    await waitFor(() => expect(transcript()).toContain('No such command here: "explain"'));
    expect(run).not.toHaveBeenCalled();
  });
});
