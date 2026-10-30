import React, {useState} from "react";
import {fireEvent, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";
import {renderClinical} from "../test/host";
import {fakePort} from "../test/fixtures";
import {ConsultSection, consultSectionId} from "./ConsultSection";
describe("ConsultSection", () => {
  it("preserves child draft state across collapse and exposes an instance-scoped anchor", () => {
    function Draft() {const [value, setValue] = useState(""); return <input aria-label="Draft" value={value} onChange={e => setValue(e.target.value)}/>;}
    renderClinical(<ConsultSection id={consultSectionId("visit1", "hpi")} title="History" collapsible status={<span>Draft</span>}><Draft/></ConsultSection>, {port: fakePort()});
    fireEvent.change(screen.getByRole("textbox"), {target: {value: "Unsaved synthetic note"}});
    fireEvent.click(screen.getByRole("button", {name: "Collapse History"}));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", {name: "Expand History"})).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", {name: "Expand History"}));
    expect(screen.getByRole("textbox")).toHaveValue("Unsaved synthetic note");
    expect(screen.getByRole("region", {name: "History"})).toHaveAttribute("id", "visit1-hpi");
  });
});
