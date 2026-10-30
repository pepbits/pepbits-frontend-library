import React from "react";
import {describe, expect, it, vi} from "vitest";
import {act, fireEvent, screen, waitFor, within} from "@testing-library/react";
import {ReviewSection} from "./ReviewSection";
import {NursingEntries} from "./NursingEntries";
import {consultation, findingsPort, FindingsHost, renderFindings, review, sectionProps} from "./test-fixtures";
import type {NursingEntry} from "../models/consult-records";
const entry: NursingEntry = {recordType: "intake", recordId: "I1", title: "Intake", summary: "Patient reports cough", at: "2026-10-28T08:00:00Z", authorName: "Synthetic nurse", clarifications: []};

describe("ReviewSection", () => {
  it("batches only routine acknowledge tasks and acknowledges an abnormal finding individually", async () => {
    const detail = consultation(); detail.reviews = [review("normal-1"), review("normal-2"), review("abnormal", true), review("verify", false, "verify")];
    const port = findingsPort(), props = sectionProps(detail);
    renderFindings(<ReviewSection {...props} allergySectionId="consult-1-allergies"/>, port);
    fireEvent.click(screen.getByRole("button", {name: "Acknowledge all routine"}));
    await waitFor(() => expect(port.consult.acknowledgeReviews).toHaveBeenCalledWith(["normal-1", "normal-2"]));
    await waitFor(() => expect(props.onRecordsChanged).toHaveBeenCalled());
    const abnormal = screen.getByText("Finding abnormal").closest("li")!;
    fireEvent.click(within(abnormal).getByRole("button", {name: "Acknowledge"}));
    await waitFor(() => expect(port.consult.acknowledgeReviews).toHaveBeenLastCalledWith(["abnormal"]));
    expect(screen.getByRole("link", {name: "Verify in allergies"})).toHaveAttribute("href", "#consult-1-allergies");
    expect(props.onChange).not.toHaveBeenCalled();
  });
  it("keeps failed acknowledgements visible and uses the controlled draft convention", async () => {
    const detail = consultation(); detail.reviews = [review("abnormal", true)];
    const port = findingsPort({acknowledgeReviews: vi.fn().mockRejectedValue(new Error("Record changed; reload"))}), props = sectionProps(detail);
    renderFindings(<ReviewSection {...props}/>, port);
    fireEvent.change(screen.getByLabelText("Reason vitals were not taken"), {target: {value: "Telephone visit"}});
    const update = props.onChange.mock.calls[0]![0] as (draft: typeof props.draft) => void;
    const next = structuredClone(props.draft); update(next);
    expect(next.vitalsNotTaken).toBe("Telephone visit"); expect(props.draft.vitalsNotTaken).toBe("");
    fireEvent.click(screen.getByRole("button", {name: "Acknowledge"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Record changed; reload");
    expect(screen.getByText("Finding abnormal")).toBeInTheDocument(); expect(props.onRecordsChanged).not.toHaveBeenCalled();
  });
  it("locks closed encounters even when the caller omits readOnly", () => {
    const detail = consultation(); detail.encounter.status = "signed"; detail.reviews = [review("abnormal", true)];
    renderFindings(<ReviewSection {...sectionProps(detail)}/>);
    expect(screen.queryByRole("button", {name: "Record vitals"})).not.toBeInTheDocument();
    expect(screen.queryByRole("button", {name: "Acknowledge"})).not.toBeInTheDocument();
    expect(screen.getByLabelText("Reason vitals were not taken")).toBeDisabled();
  });
});
describe("NursingEntries", () => {
  it("signs a separate clarification with record identity, refreshes, and preserves the nurse's text", async () => {
    const port = findingsPort({listNursingEntries: vi.fn(async () => [entry])}), changed = vi.fn();
    renderFindings(<NursingEntries encounterId="E1" canWrite closed={false} onRecordsChanged={changed}/>, port);
    fireEvent.click(await screen.findByRole("button", {name: "Add clarification"}));
    expect(screen.getByRole("button", {name: "Sign clarification"})).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Clarification to Intake"), {target: {value: "Cough started yesterday"}});
    fireEvent.click(screen.getByRole("button", {name: "Sign clarification"}));
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(port.consult.requestClarification).toHaveBeenCalledWith("E1", {recordType: "intake", recordId: "I1", text: "Cough started yesterday"});
    expect(screen.getByText("Patient reports cough")).toBeInTheDocument();
    expect(port.consult.listNursingEntries).toHaveBeenCalledTimes(2);
  });
  it("keeps clarification text on a rejected write", async () => {
    const port = findingsPort({listNursingEntries: vi.fn(async () => [entry]), requestClarification: vi.fn().mockRejectedValue(new Error("Signing refused"))});
    renderFindings(<NursingEntries encounterId="E1" canWrite closed={false}/>, port);
    fireEvent.click(await screen.findByRole("button", {name: "Add clarification"}));
    fireEvent.change(screen.getByLabelText("Clarification to Intake"), {target: {value: "Clarified history"}});
    fireEvent.click(screen.getByRole("button", {name: "Sign clarification"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Signing refused");
    expect(screen.getByLabelText("Clarification to Intake")).toHaveValue("Clarified history");
  });
  it("fences obsolete encounter reads and offers recovery", async () => {
    let resolve!: (items: NursingEntry[]) => void;
    const port = findingsPort({listNursingEntries: vi.fn().mockImplementationOnce(() => new Promise<NursingEntry[]>(r => {resolve = r;})).mockRejectedValueOnce(new Error("Nursing offline")).mockResolvedValue([])});
    const view = renderFindings(<NursingEntries encounterId="E1" canWrite closed={false}/>, port);
    view.rerender(<FindingsHost port={port}><NursingEntries encounterId="E2" canWrite closed={false}/></FindingsHost>);
    await screen.findByText("Nursing offline");
    await act(async () => resolve([entry]));
    expect(screen.queryByText("Patient reports cough")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name: /retry|try[ .]again/i}));
    expect(await screen.findByText("No nursing entries recorded for this visit.")).toBeInTheDocument();
  });
});
