import React from "react";
import {act, fireEvent, screen, waitFor, within} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import {consultPort, renderOwned, Controlled} from "../consult-note/test/fixtures";
import type {ConditionRow} from "../models/consult-records";
import {ProblemList, ProblemSection} from "./ProblemList";
const problem: ConditionRow = {id: "p1", category: "problem-list-item", display: "Synthetic problem", snomed: "test-code", clinicalStatus: "active", verification: "unconfirmed", version: 4, recordedAt: "2026-10-01"};
const diagnosis: ConditionRow = {...problem, id: "d1", category: "encounter-diagnosis", display: "Synthetic diagnosis"};
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label, {exact: false}), {target: {value}});
describe("problem lifecycle", () => {
  it("confirms and resolves with versions and reload notifications", async () => {
    const consult = consultPort({listConditions: vi.fn().mockResolvedValue([problem]), updateCondition: vi.fn().mockResolvedValue(undefined)}), changed = vi.fn(); renderOwned(<ProblemList patientId="P1" onRecordsChanged={changed}/>, consult); await screen.findByText(problem.display);
    fill("Actions: Synthetic problem", "Confirm"); await waitFor(() => expect(consult.updateCondition).toHaveBeenCalledWith("P1", "p1", {version: 4, verification: "confirmed"})); await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    await screen.findByLabelText("Actions: Synthetic problem"); fill("Actions: Synthetic problem", "Mark resolved"); await waitFor(() => expect(consult.updateCondition).toHaveBeenLastCalledWith("P1", "p1", {version: 4, clinicalStatus: "resolved"}));
  });
  it("requires a reason to refute and retains it after failure", async () => {
    const update = vi.fn().mockRejectedValue(Object.assign(new Error("Cannot update"), {problems: ["Version changed"]})); renderOwned(<ProblemList patientId="P1"/>, consultPort({listConditions: vi.fn().mockResolvedValue([problem]), updateCondition: update})); await screen.findByText(problem.display);
    fill("Actions: Synthetic problem", "Refute"); expect(screen.getByRole("button", {name: "Refute"})).toBeDisabled(); fill("Refute: reason", "Tests normal"); fireEvent.click(screen.getByRole("button", {name: "Refute"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Version changed"); expect(screen.getByLabelText("Refute: reason", {exact: false})).toHaveValue("Tests normal"); expect(update).toHaveBeenCalledWith("P1", "p1", {version: 4, verification: "refuted", reason: "Tests normal"});
  });
  it("promotes, links, and unlinks diagnoses using the frozen port signatures", async () => {
    const consult = consultPort({listConditions: vi.fn().mockResolvedValue([problem, diagnosis, {...diagnosis, id: "d2", display: "Linked diagnosis", problemId: "p1"}]), promoteCondition: vi.fn().mockResolvedValue(undefined), linkCondition: vi.fn().mockResolvedValue(undefined)}); renderOwned(<ProblemList patientId="P1"/>, consult); await screen.findByText(problem.display);
    await act(async () => fill("Problem link: Synthetic diagnosis", "promote")); expect(consult.promoteCondition).toHaveBeenCalledWith("P1", "d1");
    await act(async () => fill("Problem link: Synthetic diagnosis", "p1")); expect(consult.linkCondition).toHaveBeenCalledWith("P1", "d1", 4, "p1");
    await act(async () => fill("Problem link: Linked diagnosis", "unlink")); expect(consult.linkCondition).toHaveBeenCalledWith("P1", "d2", 4, null);
  });
  it("reactivates a past coded problem instead of duplicating it", async () => {
    const consult = consultPort({listConditions: vi.fn().mockResolvedValue([{...problem, clinicalStatus: "resolved"}]), updateCondition: vi.fn().mockResolvedValue(undefined), addCondition: vi.fn()}), searchCatalog = vi.fn().mockResolvedValue([{code: problem.snomed, display: problem.display, system: "test"}]);
    renderOwned(<ProblemList patientId="P1"/>, consult, {basePort: {searchCatalog}}); await screen.findByText("No active problems.");
    fireEvent.click(screen.getByRole("button", {name: "Add problem"})); fireEvent.change(screen.getByRole("combobox", {name: "Find the problem"}), {target: {value: "synthetic"}}); await screen.findByRole("option", {name: /Synthetic problem/}); fireEvent.keyDown(screen.getByRole("combobox", {name: "Find the problem"}), {key: "Enter"}); fireEvent.click(screen.getByRole("button", {name: "Mark as recurrence"}));
    await waitFor(() => expect(consult.updateCondition).toHaveBeenCalledWith("P1", "p1", {version: 4, clinicalStatus: "recurrence"})); expect(consult.addCondition).not.toHaveBeenCalled();
  });
  it("opens the timeline drawer even when editing is disabled", async () => {
    const consult = consultPort({listConditions: vi.fn().mockResolvedValue([problem]), loadProblemTimeline: vi.fn().mockResolvedValue([{problem, events: [{kind: "added", at: "2026-10-01", text: "Problem added", actor: "Test doctor", reason: "Synthetic reason"}]}])});
    renderOwned(<ProblemList patientId="P1" readOnly/>, consult); await screen.findByText(problem.display); expect(screen.queryByLabelText("Actions: Synthetic problem")).not.toBeInTheDocument(); fireEvent.click(screen.getByRole("button", {name: "View history"}));
    expect(await within(screen.getByRole("dialog")).findByText("Synthetic reason")).toBeInTheDocument(); expect(consult.loadProblemTimeline).toHaveBeenCalledWith("P1", expect.any(AbortSignal));
  });
  it("keeps the review checkbox controlled", async () => {
    const changed = vi.fn(); renderOwned(<Controlled component={ProblemSection} changed={changed}/>); await screen.findByText("No active problems."); fireEvent.click(screen.getByRole("checkbox", {name: "Reviewed with patient"})); expect(changed.mock.lastCall![0].history.problemsReviewed).toBe(true);
  });
});
