import React from "react";
import {describe, expect, it, vi} from "vitest";
import {screen, fireEvent} from "@testing-library/react";
import {renderClinical} from "../test/host";
import {fakePort} from "../test/fixtures";
import {ConsultHostProvider, useConsultHost, useConsultPort, type ConsultHost} from "./consult-host";
import type {ConsultationDataPort} from "./consult-contracts";

const host: ConsultHost = {onNavigate: vi.fn(), renderLink: (dest, props) => <a href="#host-owned" data-kind={dest.kind}>{props.children}</a>};
function Probe() {
  const consult = useConsultPort(), h = useConsultHost();
  return <button onClick={() => {void consult.acknowledgeReviews(["review-1"]); h.onNavigate({kind: "assessment", assessmentId: "test"}, {newTab: true});}}>Acknowledge</button>;
}
describe("consultation host boundary", () => {
  it("calls the supplied consultation port and semantic host destination", () => {
    const acknowledgeReviews = vi.fn().mockResolvedValue(undefined);
    const consult = {acknowledgeReviews} as unknown as ConsultationDataPort;
    renderClinical(<ConsultHostProvider value={host}><Probe/></ConsultHostProvider>, {port: fakePort({consult})});
    fireEvent.click(screen.getByRole("button", {name: "Acknowledge"}));
    expect(acknowledgeReviews).toHaveBeenCalledWith(["review-1"]);
    expect(host.onNavigate).toHaveBeenCalledWith({kind: "assessment", assessmentId: "test"}, {newTab: true});
  });
  it("explains a missing consultation capability without requiring it for intake", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => renderClinical(<ConsultHostProvider value={host}><Probe/></ConsultHostProvider>, {port: fakePort()})).toThrow("ClinicalProvider.port.consult");
    } finally {quiet.mockRestore();}
  });
  it("explains a missing host provider", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => renderClinical(<Probe/>, {port: fakePort({consult: {} as ConsultationDataPort})})).toThrow("ConsultHostProvider");
    } finally {quiet.mockRestore();}
  });
});
