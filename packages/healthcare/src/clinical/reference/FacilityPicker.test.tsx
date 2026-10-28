import React, {useState} from "react";
import {act, fireEvent, screen, waitFor} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import {renderClinical} from "../test/host";
import {fakePort} from "../test/fixtures";
import {ClinicalProvider} from "../context/clinical-context";
import type {ConsultationDataPort} from "../context/consult-contracts";
import type {FacilityChoice} from "../models/consult-reference";
import {FacilityPicker} from "./FacilityPicker";
const choices: FacilityChoice[] = [{code: "ed", name: "Test Emergency", type: "hospital", emergency: true}, {code: "clinic", name: "Test Clinic", type: "clinic", emergency: false}];
const consult = (listFacilities: ConsultationDataPort["listFacilities"]) => ({listFacilities}) as ConsultationDataPort;

describe("FacilityPicker", () => {
  it("filters emergency facilities and emits facility names or free text", async () => {
    const onChange = vi.fn();
    function Form() {
      const [value, setValue] = useState("");
      return <FacilityPicker label="Destination" value={value} emergencyOnly onChange={v => {setValue(v); onChange(v);}}/>;
    }
    renderClinical(<Form/>, {port: fakePort({consult: consult(vi.fn().mockResolvedValue(choices))})});
    expect(await screen.findByRole("option", {name: "Test Emergency"})).toBeInTheDocument();
    expect(screen.queryByRole("option", {name: "Test Clinic"})).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), {target: {value: "Test Emergency"}});
    expect(onChange).toHaveBeenLastCalledWith("Test Emergency");
    fireEvent.change(screen.getByRole("combobox"), {target: {value: "__other"}});
    fireEvent.change(screen.getByRole("textbox", {name: "Destination: name"}), {target: {value: "Another test hospital"}});
    expect(onChange).toHaveBeenLastCalledWith("Another test hospital");
  });
  it("aborts the former host read and fences late results when the port changes", async () => {
    let resolveOld!: (items: FacilityChoice[]) => void;
    const oldRead = vi.fn((_signal?: AbortSignal) => new Promise<FacilityChoice[]>(resolve => {resolveOld = resolve;}));
    const oldPort = fakePort({consult: consult(oldRead)});
    const nextPort = fakePort({consult: consult(vi.fn().mockResolvedValue([choices[1]!]))});
    function SwitchHost() {
      const [port, setPort] = useState(oldPort);
      return <><button onClick={() => setPort(nextPort)}>Switch host</button><ClinicalProvider port={port}>
        <FacilityPicker label="Facility" value="" onChange={() => {}}/>
      </ClinicalProvider></>;
    }
    renderClinical(<SwitchHost/>, {port: oldPort});
    fireEvent.click(screen.getByRole("button", {name: "Switch host"}));
    expect(oldRead.mock.calls[0]?.[0]?.aborted).toBe(true);
    await screen.findByRole("option", {name: "Test Clinic"});
    await act(async () => resolveOld([choices[0]!]));
    expect(screen.queryByRole("option", {name: "Test Emergency"})).not.toBeInTheDocument();
  });
  it("shows structured load errors and guards a disabled control", async () => {
    const onChange = vi.fn();
    renderClinical(<FacilityPicker label="Facility" disabled value="" onChange={onChange}/>, {port: fakePort({consult: consult(vi.fn().mockRejectedValue({problems: ["Facility access denied"]}))})});
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Facility access denied"));
    fireEvent.change(screen.getByRole("combobox"), {target: {value: "__other"}});
    expect(onChange).not.toHaveBeenCalled();
  });
});
