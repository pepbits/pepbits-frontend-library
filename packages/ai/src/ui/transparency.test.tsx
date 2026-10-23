import React from "react";
import {fireEvent,  screen} from "@testing-library/react";
import {render} from "../test/render";
import { describe, expect, test, vi } from "vitest";
import { TransparencyPanel } from "./transparency.tsx";
import { config, context, field, useCase } from "./fixtures.test-support.ts";

/**
 * The panel is a VIEW of the request, not a claim about it.
 *
 * The Data tab renders `context.fields` and has no other source, so it cannot
 * show a field the payload lacks nor hide one it has. Everything here is about
 * keeping that true, and about the two things that must stop a send: a use case
 * with nothing to read, and a clinical one nobody has acknowledged.
 */

const panel = (over: Partial<React.ComponentProps<typeof TransparencyPanel>> = {}) => {
  const props = {
    context: context(),
    useCase: useCase(),
    config: config(),
    decidedBy: "page" as const,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...over,
  };
  render(<TransparencyPanel {...props} />);
  return props;
};

/* fireEvent, not element.click(). A raw DOM click on a React button does not
   flush the state update it causes, so the assertion after it reads the
   PREVIOUS render — the Flow and Policy tests all passed against a panel still
   showing the Data tab until this changed. */
const tab = (name: string) => fireEvent.click(screen.getByRole("button", { name: new RegExp(name, "i") }));
const sendButton = () => screen.getByRole("button", { name: /^Send / });

describe("the Data tab", () => {
  test("lists every field the payload carries, and its source", () => {
    panel();
    expect(screen.getByText("Id")).toBeInTheDocument();
    expect(screen.getByText("C-100")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getAllByText("This record")).toHaveLength(2);
  });

  test("counts them, in the badge and on the button", () => {
    panel();
    expect(screen.getByText("2 fields")).toBeInTheDocument();
    expect(sendButton()).toHaveTextContent("Send 2 fields");
  });

  test("counts one field in the singular", () => {
    panel({ context: context({ fields: [field()] }) });
    expect(screen.getByText("1 field")).toBeInTheDocument();
    expect(sendButton()).toHaveTextContent("Send 1 field");
  });

  /* The value shown IS the value sent: redaction ran during assembly, so there
     is no unredacted original for the panel to prefer. */
  test("shows the redacted value, and says which fields were redacted", () => {
    panel({
      context: context({
        fields: [field(), field({ key: "email", label: "Email", value: "a••••@example.invalid", redacted: true })],
      }),
    });
    expect(screen.getByText("a••••@example.invalid")).toBeInTheDocument();
    expect(screen.getByText("1 redacted")).toBeInTheDocument();
    expect(screen.getByText("redacted")).toBeInTheDocument();
  });

  test("says nothing about redaction when nothing was redacted", () => {
    panel();
    expect(screen.queryByText(/redacted/)).toBeNull();
  });

  test("names the use case and describes what it does", () => {
    panel();
    expect(screen.getByText("Explain this record")).toBeInTheDocument();
    expect(screen.getByText(/Explains the fields on the open record/)).toBeInTheDocument();
  });

  test("shows what the user typed, under its own heading", () => {
    panel({ context: context({ userInput: "why is this overdue?" }) });
    expect(screen.getByText("Your message")).toBeInTheDocument();
    expect(screen.getByText("why is this overdue?")).toBeInTheDocument();
  });

  test("and shows no message box when they typed nothing", () => {
    panel();
    expect(screen.queryByText("Your message")).toBeNull();
  });

  /* A use case whose `reads` match nothing on this page. Saying so is the
     honest answer; an empty list with a live Send button is not. */
  test("says so when there is nothing to send", () => {
    panel({ context: context({ fields: [] }) });
    expect(screen.getByText(/Nothing on this page matches/)).toBeInTheDocument();
    expect(sendButton()).toBeDisabled();
  });
});

describe("the Flow tab", () => {
  test("names all three hops, in order", () => {
    panel();
    tab("Flow");
    expect(screen.getByText("This browser")).toBeInTheDocument();
    expect(screen.getByText("Your AI service")).toBeInTheDocument();
    expect(screen.getByText("Example Provider")).toBeInTheDocument();
  });

  test("says which sources the payload was assembled from", () => {
    panel();
    tab("Flow");
    expect(screen.getByText(/Assembled from This record/)).toBeInTheDocument();
  });

  test("says 'nothing' rather than trailing off when no field was captured", () => {
    panel({ context: context({ fields: [] }) });
    tab("Flow");
    expect(screen.getByText(/Assembled from nothing/)).toBeInTheDocument();
  });

  test("carries the retention the service actually applies", () => {
    panel();
    tab("Flow");
    expect(screen.getByText("30 days")).toBeInTheDocument();
  });

  /* Config null means the administration surface has not loaded or is
     unavailable. Naming a provider anyway would be a guess presented as fact. */
  test("names no provider when the configuration is unavailable", () => {
    panel({ config: null });
    tab("Flow");
    expect(screen.getByText("Provider (not configured)")).toBeInTheDocument();
    expect(screen.getByText("per policy")).toBeInTheDocument();
  });

  test("says plainly when the provider trains on what is sent", () => {
    panel({ config: config({ dataSharing: { providerTrainsOnContent: true, region: "us-east-1" } }) });
    tab("Flow");
    expect(screen.getByText("trains on content")).toBeInTheDocument();
  });
});

describe("the Policy tab", () => {
  test("names the gate that allowed this", () => {
    panel({ decidedBy: "module" });
    tab("Policy");
    expect(screen.getByText("The module gate")).toBeInTheDocument();
  });

  test("carries retention, region and the training answer", () => {
    panel();
    tab("Policy");
    expect(screen.getByText("standard, 30 days")).toBeInTheDocument();
    expect(screen.getByText("eu-central-1")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  /* The prompt ID, never prompt text. The browser holds none, so there is none
     here to show. */
  test("names the prompt by id", () => {
    panel();
    tab("Policy");
    expect(screen.getByText("record.explain.v1")).toBeInTheDocument();
  });

  test("says Unknown rather than guessing when the configuration is unavailable", () => {
    panel({ config: null });
    tab("Policy");
    expect(screen.getByText("Unknown — configuration unavailable")).toBeInTheDocument();
    /* Region and the training answer both. Neither is guessed at, and neither
       is quietly left blank, which would read as "no". */
    expect(screen.getAllByText("Unknown")).toHaveLength(2);
    expect(screen.getByText("Not configured — the request cannot be sent")).toBeInTheDocument();
  });
});

describe("sending", () => {
  test("confirms through the caller", () => {
    const props = panel();
    fireEvent.click(sendButton());
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  test("cancels through the caller", () => {
    const props = panel();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  /* Nothing can be sent without a credential, and the panel says why rather
     than offering a button that fails. */
  test("is refused, and explained, when no credential is configured", () => {
    panel({ config: config({ credential: { configured: false } as never }) });
    expect(sendButton()).toBeDisabled();
    expect(screen.getByText(/No provider credential is configured/)).toBeInTheDocument();
  });

  test("and the explanation is absent once one is", () => {
    panel();
    expect(screen.queryByText(/No provider credential is configured/)).toBeNull();
  });
});

/**
 * A clinical use case needs a second, explicit acknowledgement naming the
 * record. One button for both categories makes the careful case cost nothing,
 * which is the same as not having one.
 */
describe("the clinical acknowledgement", () => {
  const clinical = { useCase: useCase({ category: "clinical", label: "Summarise encounter" }) };

  test("is asked for, and names the record", () => {
    panel(clinical);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(screen.getByText(/This is a clinical use case/)).toBeInTheDocument();
    expect(screen.getByText("items-a")).toBeInTheDocument();
  });

  test("holds the send until it is given", () => {
    panel(clinical);
    expect(sendButton()).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(sendButton()).toBeEnabled();
  });

  test("and taking it back holds the send again", () => {
    panel(clinical);
    const box = screen.getByRole("checkbox");
    fireEvent.click(box);
    fireEvent.click(box);
    expect(sendButton()).toBeDisabled();
  });

  test("is not asked for on an ordinary use case", () => {
    panel();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(sendButton()).toBeEnabled();
  });

  /* It says what the assistant is for, in the same breath as the consent. */
  test("says the assistant summarises rather than diagnoses", () => {
    panel(clinical);
    expect(screen.getByText(/does not diagnose/)).toBeInTheDocument();
  });
});

test('explicit simulation can confirm without a credential and still requires captured fields',()=>{
 const props=panel({simulation:true,config:null});
 const button=screen.getByRole('button',{name:/mock transport.*2/i});
 expect(button).toBeEnabled();fireEvent.click(button);expect(props.onConfirm).toHaveBeenCalledOnce();
});
test('explicit simulation cannot confirm empty context',()=>{
 panel({simulation:true,config:null,context:context({fields:[]})});
 expect(screen.getByRole('button',{name:/mock transport.*0/i})).toBeDisabled();
});
