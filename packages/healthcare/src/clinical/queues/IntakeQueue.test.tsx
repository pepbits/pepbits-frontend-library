import React from "react";
import {describe, expect, it, vi} from "vitest";
import {fireEvent, screen, waitFor} from "@testing-library/react";
import {IntakeQueue} from "./IntakeQueue";
import {renderClinical} from "../test/host";
import {fakePort, queueRow} from "../test/fixtures";

const rows = [queueRow("1", "registered"), queueRow("2", "intake", {allergyCount: 2, news2: 5}), queueRow("3", "ready"), queueRow("4", "signed")];

describe("IntakeQueue", () => {
  it("lists only visits waiting for intake, with stage counts for the whole clinic", async () => {
    const port = fakePort({listEncounters: vi.fn(async () => rows)});
    renderClinical(<IntakeQueue onOpenIntake={() => {}}/>, {port});
    expect(await screen.findByText("Patient 1")).toBeInTheDocument();
    expect(screen.getByText("Patient 2")).toBeInTheDocument();
    expect(screen.queryByText("Patient 3")).not.toBeInTheDocument();
    expect(port.listEncounters).toHaveBeenCalledWith("OP");
    expect(screen.getByRole("button", {name: /Ready for doctor/})).toHaveTextContent("1");
    expect(screen.getByText("2 allergies")).toBeInTheDocument();
    expect(screen.getByText("NEWS2 5")).toBeInTheDocument();
  });

  it("gives nurses start and continue intake", async () => {
    const port = fakePort({listEncounters: vi.fn(async () => rows)}), onOpenIntake = vi.fn();
    renderClinical(<IntakeQueue onOpenIntake={onOpenIntake}/>, {port});
    fireEvent.click(await screen.findByRole("button", {name: "Start intake"}));
    expect(onOpenIntake).toHaveBeenCalledWith(expect.objectContaining({id: "1"}));
    expect(screen.getByRole("button", {name: "Continue intake"})).toBeInTheDocument();
    expect(screen.queryByRole("button", {name: "See now"})).not.toBeInTheDocument();
  });

  it("lets doctors see the patient now, moving the visit into consultation", async () => {
    const port = fakePort({listEncounters: vi.fn(async () => [rows[0]!])}), onSeeNow = vi.fn();
    renderClinical(<IntakeQueue onOpenIntake={() => {}} onSeeNow={onSeeNow}/>, {port, actor: {role: "doctor", permissions: ["note.write", "vitals.write"]}});
    fireEvent.click(await screen.findByRole("button", {name: "See now"}));
    await waitFor(() => expect(onSeeNow).toHaveBeenCalled());
    expect(port.setEncounterStatus).toHaveBeenCalledWith("1", "in-consult");
  });

  it("hides safety details from staff without clinical access", async () => {
    const port = fakePort({listEncounters: vi.fn(async () => [queueRow("9", "registered", {clinicalVisible: false, allergyCount: 1})])});
    renderClinical(<IntakeQueue onOpenIntake={() => {}}/>, {port});
    expect(await screen.findByText("Restricted to clinical staff")).toBeInTheDocument();
    expect(screen.queryByText(/^\d+ allerg/)).not.toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    renderClinical(<IntakeQueue onOpenIntake={() => {}}/>, {port: fakePort()});
    expect(await screen.findByText("No one here right now")).toBeInTheDocument();
  });

  it("shows a load failure with the server message", async () => {
    renderClinical(<IntakeQueue onOpenIntake={() => {}}/>, {port: fakePort({listEncounters: vi.fn(async () => { throw new Error("Sign in again."); })})});
    expect(await screen.findByText("Sign in again.")).toBeInTheDocument();
    expect(screen.getByText("Couldn’t load the queue")).toBeInTheDocument();
  });
});
