import React from "react";
import {expect, it} from "vitest";
import {screen} from "@testing-library/react";
import {PatientBanner} from "./PatientBanner";
import {consultation, renderFindings} from "../consult-records/test-fixtures";
it("shows reproductive safety flags and only visible actionable care gaps at the host anchor", () => {
  const detail = consultation();
  renderFindings(<PatientBanner patient={detail.patient} allergies={detail.allergies} reproductive={{version: 2, pregnancy: "pregnant", breastfeeding: "yes", verification: "unconfirmed"}} careGaps={{sectionId: "consult-E1-care", items: [{id: "G1", version: 1, name: "Synthetic check", status: "overdue", dueOn: "2026-10-20", mode: "full"}, {id: "G2", version: 1, name: "Hidden check", status: "due", dueOn: "2026-10-28", mode: "hidden"}, {id: "G3", version: 1, name: "Complete check", status: "up-to-date", dueOn: "2026-10-28", mode: "full"}]}}/>);
  expect(screen.getByText("Pregnant (unconfirmed)")).toBeInTheDocument(); expect(screen.getByText("Breastfeeding")).toBeInTheDocument();
  expect(screen.getByRole("link", {name: "1 due · 1 overdue"})).toHaveAttribute("href", "#consult-E1-care");
});
