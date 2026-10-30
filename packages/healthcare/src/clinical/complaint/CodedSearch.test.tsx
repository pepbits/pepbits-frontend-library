import React, {useState} from "react";
import {fireEvent, screen, waitFor} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import {renderClinical} from "../test/host";
import {fakePort} from "../test/fixtures";
import type {CatalogItem} from "../types";
import {CodedSearch} from "./CodedSearch";
const item: CatalogItem = {system: "synthetic", code: "TEST", display: "Test procedure"};
describe("CodedSearch consultation options", () => {
  it("passes category, limit and cancellation through the catalogue port", async () => {
    const searchCatalog = vi.fn().mockResolvedValue([item]), onPick = vi.fn();
    renderClinical(<CodedSearch catalog="procedures" label="Procedure" limit={20} category="dental" onPick={onPick}/>, {port: fakePort({searchCatalog})});
    fireEvent.change(screen.getByRole("combobox"), {target: {value: "test"}});
    await screen.findByRole("option");
    expect(searchCatalog).toHaveBeenCalledWith("procedures", "test", expect.any(AbortSignal), {limit: 20, category: "dental"});
    fireEvent.keyDown(screen.getByRole("combobox"), {key: "Enter"});
    expect(onPick).toHaveBeenCalledWith(item);
  });
  it("supports controlled multiple picks, duplicate prevention and accessible removal", async () => {
    const onChange = vi.fn();
    function Multiple() {
      const [value, setValue] = useState<CatalogItem[]>([]);
      return <CodedSearch catalog="procedures" label="Procedures" multiple value={value} onChange={items => {setValue(items); onChange(items);}}/>;
    }
    renderClinical(<Multiple/>, {port: fakePort({searchCatalog: vi.fn().mockResolvedValue([item])})});
    const input = screen.getByRole("combobox");
    fireEvent.change(input, {target: {value: "test"}});
    await screen.findByRole("option");
    fireEvent.keyDown(input, {key: "Enter"});
    expect(onChange).toHaveBeenLastCalledWith([item]);
    fireEvent.change(input, {target: {value: "test"}});
    await screen.findByRole("option");
    fireEvent.keyDown(input, {key: "Enter"});
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", {name: "Remove Test procedure"}));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith([]));
  });
});
