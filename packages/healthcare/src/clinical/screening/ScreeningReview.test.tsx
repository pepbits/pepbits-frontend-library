import React from "react";
import {describe, expect, it, vi} from "vitest";
import {fireEvent, screen, waitFor, within} from "@testing-library/react";
import {ScreeningReview} from "./ScreeningReview";
import {PregnancyStatus} from "./PregnancyStatus";
import {consultation, findingsPort, renderFindings, sectionProps} from "../consult-records/test-fixtures";
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), {target: {value}});

describe("ScreeningReview", () => {
  it("records a review with status version and no reassessment answers", async () => {
    const detail = consultation(); detail.encounter.intake = {screening: {pregnant: "unknown"}}; detail.reproductiveStatus = {version: 4};
    const port = findingsPort(), props = sectionProps(detail); renderFindings(<ScreeningReview {...props}/>, port);
    fireEvent.click(screen.getByRole("button", {name: "Reviewed"}));
    await waitFor(() => expect(props.onRecordsChanged).toHaveBeenCalled());
    expect(port.consult.reviewScreening).toHaveBeenCalledWith("E1", {action: "reviewed", answers: {}, note: "", statusVersion: 4});
  });
  it("reassesses only answered questions while retaining original nursing answers", async () => {
    const detail = consultation(); detail.encounter.intake = {screening: {pregnant: "unknown", safeHome: "yes"}}; detail.reproductiveStatus = {version: 5, verification: "confirmed"};
    const props = sectionProps(detail), port = findingsPort(); renderFindings(<ScreeningReview {...props}/>, port);
    fireEvent.click(screen.getByRole("button", {name: "Reassess"}));
    fireEvent.click(within(screen.getByRole("radiogroup", {name: "Could the patient be pregnant?"})).getByRole("radio", {name: "No"}));
    fill("Note", "Test negative today"); fireEvent.click(screen.getByRole("button", {name: "Save reassessment"}));
    await waitFor(() => expect(port.consult.reviewScreening).toHaveBeenCalledWith("E1", {action: "reassessed", answers: {pregnant: "no"}, note: "Test negative today", statusVersion: 5}));
    expect(detail.encounter.intake.screening).toEqual({pregnant: "unknown", safeHome: "yes"});
  });
  it("retains a reassessment when the server rejects a stale status version", async () => {
    const detail = consultation(); detail.encounter.intake = {screening: {safeHome: "no"}};
    const port = findingsPort({reviewScreening: vi.fn().mockRejectedValue(Object.assign(new Error("Status changed"), {status: 409}))});
    renderFindings(<ScreeningReview {...sectionProps(detail)}/>, port);
    fireEvent.click(screen.getByRole("button", {name: "Reassess"}));
    fireEvent.click(within(screen.getByRole("radiogroup", {name: "Feels safe at home"})).getByRole("radio", {name: "Yes"}));
    fill("Note", "Private discussion"); fireEvent.click(screen.getByRole("button", {name: "Save reassessment"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Status changed"); expect(screen.getByLabelText("Note")).toHaveValue("Private discussion");
  });
});
describe("PregnancyStatus", () => {
  it("requires a reason to change confirmed pregnancy and sends only changed fields", async () => {
    const port = findingsPort(), changed = vi.fn();
    renderFindings(<PregnancyStatus patientId="P1" encounterId="E1" status={{version: 8, pregnancy: "pregnant", verification: "confirmed"}} canWrite clinician onChanged={changed}/>, port);
    fireEvent.click(screen.getByRole("button", {name: "Update"})); fill("Pregnancy", "not-pregnant");
    expect(screen.getByRole("button", {name: "Save"})).toBeDisabled(); fill("Reason", "Confirmed by examination");
    fireEvent.click(screen.getByRole("button", {name: "Save"}));
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(port.consult.updateReproductiveStatus).toHaveBeenCalledWith("P1", {version: 8, encounterId: "E1", reason: "Confirmed by examination", pregnancy: "not-pregnant"});
  });
  it("confirms the displayed record rather than a cancelled draft", async () => {
    const port = findingsPort();
    renderFindings(<PregnancyStatus patientId="P1" encounterId="E1" status={{version: 3, pregnancy: "possibly", verification: "unconfirmed"}} canWrite clinician/>, port);
    fireEvent.click(screen.getByRole("button", {name: "Update"})); fill("Pregnancy", "pregnant"); fireEvent.click(screen.getByRole("button", {name: "Cancel"}));
    fireEvent.click(screen.getByRole("button", {name: "Confirm as recorded"}));
    await waitFor(() => expect(port.consult.updateReproductiveStatus).toHaveBeenCalledWith("P1", {version: 3, encounterId: "E1"}));
  });
  it("does not offer confirmation without write permission", () => {
    renderFindings(<PregnancyStatus patientId="P1" encounterId="E1" status={{version: 1, pregnancy: "possibly", verification: "unconfirmed"}} canWrite={false} clinician/>);
    expect(screen.queryByRole("button", {name: "Confirm as recorded"})).not.toBeInTheDocument(); expect(screen.queryByRole("button", {name: "Update"})).not.toBeInTheDocument();
  });
});

it("retains the version and draft from when reproductive status editing began", async () => {
  const {FindingsHost} = await import("../consult-records/test-fixtures");
  const port = findingsPort({updateReproductiveStatus: vi.fn().mockRejectedValue(new Error("Status changed elsewhere"))});
  const initial = {version: 4, pregnancy: "possibly" as const, verification: "unconfirmed" as const};
  const view = renderFindings(<PregnancyStatus patientId="P1" encounterId="E1" status={initial} canWrite clinician/>, port);
  fireEvent.click(screen.getByRole("button", {name: "Update"})); fill("Pregnancy", "pregnant");
  view.rerender(<FindingsHost port={port}><PregnancyStatus patientId="P1" encounterId="E1" status={{...initial, version: 5, pregnancy: "not-pregnant", verification: "confirmed"}} canWrite clinician/></FindingsHost>);
  fireEvent.click(screen.getByRole("button", {name: "Save"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("Status changed elsewhere");
  expect(port.consult.updateReproductiveStatus).toHaveBeenCalledWith("P1", {version: 4, encounterId: "E1", reason: "", pregnancy: "pregnant"});
  expect(screen.getByLabelText("Pregnancy")).toHaveValue("pregnant");
});
