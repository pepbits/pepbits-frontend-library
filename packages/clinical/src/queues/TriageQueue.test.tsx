import React from "react";
import {describe, expect, it, vi} from "vitest";
import {fireEvent, screen, within} from "@testing-library/react";
import {TriageQueue, EsiLevelCounts} from "./TriageQueue";
import {renderClinical} from "../test/host";
import {fakePort, queueRow} from "../test/fixtures";

const er = (id: string, status: string, waitingMinutes: number, extra = {}) => queueRow(id, status, {class: "ER", waitingMinutes, reason: "Fall", ...extra});
const rows = [er("A", "waiting-triage", 5), er("B", "waiting-triage", 22, {patient: {id: "PB", mrn: "MRN-B", name: "Unknown male", restricted: false, identityStatus: "unknown"}}), er("C", "triaged", 40, {acuity: 2})];

describe("TriageQueue", () => {
  it("lists only patients waiting for triage, longest wait first, and opens triage for a nurse", async () => {
    const onTriage = vi.fn(), port = fakePort({listEncounters: vi.fn(async () => rows)});
    renderClinical(<TriageQueue onTriage={onTriage}/>, {port});
    const list = await screen.findByRole("list");
    expect(within(list).getAllByRole("listitem").map(li => li.textContent)).toEqual([expect.stringContaining("Unknown male"), expect.stringContaining("Patient A")]);
    expect(screen.queryByText("Patient C")).not.toBeInTheDocument();
    expect(screen.getByText("Unidentified")).toBeInTheDocument();
    expect(screen.getByText("22 min")).toHaveClass("font-bold");
    expect(port.listEncounters).toHaveBeenCalledWith("ER");
    fireEvent.click(screen.getAllByRole("button", {name: "Triage now"})[0]!);
    expect(onTriage).toHaveBeenCalledWith(expect.objectContaining({id: "B"}));
  });

  it("shows other roles that the patient is awaiting triage instead of the action", async () => {
    renderClinical(<TriageQueue onTriage={() => {}}/>, {port: fakePort({listEncounters: vi.fn(async () => rows)}), actor: {role: "receptionist", permissions: []}});
    expect(await screen.findAllByText("Awaiting triage")).toHaveLength(2);
    expect(screen.queryByRole("button", {name: "Triage now"})).not.toBeInTheDocument();
  });

  it("says when nobody is waiting and offers retry when loading fails", async () => {
    const {unmount} = renderClinical(<TriageQueue onTriage={() => {}}/>, {port: fakePort()});
    expect(await screen.findByText("Nobody is waiting for triage")).toBeInTheDocument();
    unmount();
    renderClinical(<TriageQueue onTriage={() => {}}/>, {port: fakePort({listEncounters: vi.fn(async () => { throw new Error("Emergency list unavailable"); })})});
    expect(await screen.findByText("Emergency list unavailable")).toBeInTheDocument();
  });
});

describe("EsiLevelCounts", () => {
  it("counts the waiting patients and the triaged patients at each level", () => {
    renderClinical(<EsiLevelCounts rows={rows}/>, {port: fakePort()});
    expect(screen.getByText("Waiting for triage").nextSibling).toHaveTextContent("2");
    expect(screen.getByText("ESI 2").nextSibling).toHaveTextContent("1");
    expect(screen.getByText("ESI 5").nextSibling).toHaveTextContent("0");
  });
});
