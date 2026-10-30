import React from "react";
import {fireEvent, screen, waitFor, within} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import {consultPort, detail, renderOwned} from "../consult-note/test/fixtures";
import {PatientAssessmentsPanel} from "./PatientAssessmentsPanel";
const tool = {id: "t1", name: "Synthetic tool", category: "test", source: "test", version: "1", favourite: false, canPerform: true, bound: true};
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), {target: {value}});
describe("governed assessments", () => {
  it("launches through host navigation and retains request identity across retries", async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error("Temporarily unavailable")).mockResolvedValue({assessment: {id: "a1", number: "A001"}}), navigate = vi.fn();
    const consult = consultPort({listAvailableAssessments: vi.fn().mockResolvedValue([tool]), createAssessment: create});
    renderOwned(<PatientAssessmentsPanel patientId="P1" encounterId="E1" visitOnly/>, consult, {host: {onNavigate: navigate}});
    await screen.findByText("No assessments at this visit."); expect(consult.listAssessments).toHaveBeenCalledWith({encounterId: "E1"}, expect.any(AbortSignal));
    fireEvent.click(screen.getByRole("button", {name: "New assessment"})); await screen.findByRole("option", {name: "Synthetic tool"}); fill("Assessment tool", "t1"); fill("Purpose (optional)", "Synthetic review"); fireEvent.click(screen.getByRole("button", {name: "Start assessment"}));
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent("Temporarily unavailable"); expect(screen.getByLabelText("Purpose (optional)")).toHaveValue("Synthetic review"); fireEvent.click(screen.getByRole("button", {name: "Start assessment"}));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({kind: "assessment", assessmentId: "a1"})); expect(create.mock.calls[1]![0]).toEqual(create.mock.calls[0]![0]); expect(create.mock.calls[0]![0]).toMatchObject({requestId: expect.any(String), patientId: "P1", encounterId: "E1", toolId: "t1", mode: "current-knowledge", workflowStage: null, purpose: "Synthetic review", effectiveAt: null});
  });
  it("hides excluded snapshots but reports all rows, using semantic host links", async () => {
    const row = {id: "a1", number: "A001", patientId: "P1", toolId: "t1", toolName: "Synthetic tool", status: "final", revisionStatus: "final", currentRevision: 1, createdAt: "2026-10-28", effectiveAt: "2026-10-28", patient: detail().patient};
    const report = vi.fn(); renderOwned(<PatientAssessmentsPanel patientId="P1" exclude={["a1"]} onRows={report}/>, consultPort({listAssessments: vi.fn().mockResolvedValue([row, {...row, id: "a2", toolName: "Visible tool"}])}));
    await screen.findByRole("link", {name: "Visible tool A001"}); expect(screen.queryByText("Synthetic tool")).not.toBeInTheDocument(); await waitFor(() => expect(report).toHaveBeenCalledWith([row, {...row, id: "a2", toolName: "Visible tool"}]));
  });
  it("respects server tool capability and rejects future effective time", async () => {
    renderOwned(<PatientAssessmentsPanel patientId="P1"/>, consultPort({listAvailableAssessments: vi.fn().mockResolvedValue([{...tool, id: "denied", name: "Denied", canPerform: false}, tool])}));
    fireEvent.click(screen.getByRole("button", {name: "New assessment"})); await screen.findByRole("option", {name: "Denied · Not for your role"}); fill("Assessment tool", "denied"); expect(screen.getByRole("button", {name: "Start assessment"})).toBeDisabled();
    fill("Assessment tool", "t1"); fill("Effective time", "2099-01-01T12:00"); expect(screen.getByRole("button", {name: "Start assessment"})).toBeDisabled();
  });
  it("does not read without patient.read or create in read-only mode", () => {
    const consult = consultPort(); const first = renderOwned(<PatientAssessmentsPanel patientId="P1"/>, consult, {permissions: []}); expect(consult.listAssessments).not.toHaveBeenCalled(); expect(screen.queryByRole("button", {name: "New assessment"})).not.toBeInTheDocument(); first.unmount();
    renderOwned(<PatientAssessmentsPanel patientId="P1" readOnly/>, consult); expect(screen.queryByRole("button", {name: "New assessment"})).not.toBeInTheDocument();
  });
});
