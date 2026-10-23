import {render,TestHost} from '../test';
import React from "react";
import {  screen, fireEvent, waitFor } from "@testing-library/react";
import { test, expect, vi } from "vitest";
import {
  
  type IntegrationLibrary,
} from "@pepbits/data/device-integrations";
import {
  WorkflowRequestFailure,
  type IntegrationAdapter,
} from "@pepbits/data";
import { DeviceIntegrationWorkspace } from "./workspace";
const base: IntegrationLibrary = {
  ...{"devices": [{"id": "browser", "title": "devices.browser", "transport": "browser", "capabilities": ["receipt", "report"]}, {"id": "demo-receipt", "title": "devices.receiptDemo", "transport": "demo", "capabilities": ["receipt", "drawer"]}, {"id": "demo-label", "title": "devices.labelDemo", "transport": "demo", "capabilities": ["label"]}, {"id": "keyboard", "title": "devices.keyboard", "transport": "browser", "capabilities": ["scan"]}, {"id": "native", "title": "devices.native", "transport": "native", "capabilities": ["receipt", "label", "report", "scan", "drawer", "scale"]}], "policy": {"version": 1, "lockedDevice": "", "automatic": false, "maxCopies": 10}, "rules": [{"id": "sale", "event": "sale.completed", "capability": "receipt", "deviceId": "demo-receipt", "enabled": true}, {"id": "purchase", "event": "goods.received", "capability": "label", "deviceId": "demo-label", "enabled": true}, {"id": "bill", "event": "bill.finalized", "capability": "receipt", "deviceId": "demo-receipt", "enabled": true}, {"id": "report", "event": "report.ready", "capability": "report", "deviceId": "browser", "enabled": true}]},
  records: [
    { id: "ITEM-1", code: "CODE-1", title: "Synthetic item", context: "pos" },
  ],
  jobs: [],
  defaultDevice: "browser",
  stationId: "demo-station",
  canManage: false,
};
test("effective tenant lock disables device preference and unsupported output is filtered", async () => {
  render(
    <DeviceIntegrationWorkspace
      mode="workbench" contexts={[{value:"pos",label:"Items"}]}
      stationId="demo-station" scopeKey="a"
      adapter={{
        library: async () => ({
          ...base,
          policy: { ...base.policy, lockedDevice: "demo-label" },
        }),
        command: vi.fn(),
      }}
    />,
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Device / destination")).toHaveValue(
      "demo-label",
    ),
  );
  expect(screen.getByLabelText("Device / destination")).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Save workstation default" }),
  ).toBeDisabled();
  expect(screen.getByLabelText("Output type")).toHaveValue("label");
});
test("recoverable queue failure retries exactly the same operation and selected source", async () => {
  const command = vi
    .fn()
    .mockRejectedValueOnce(
      new WorkflowRequestFailure(503, { form: "devices.storage" }),
    )
    .mockResolvedValue({ id: "job" });
  render(
    <DeviceIntegrationWorkspace
      mode="workbench" contexts={[{value:"pos",label:"Items"}]}
      stationId="demo-station" scopeKey="b"
      adapter={{ library: async () => base, command } as IntegrationAdapter}
    />,
  );
  await screen.findByLabelText("Source record");
  fireEvent.change(screen.getByLabelText("Source record"), {
    target: { value: "ITEM-1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create device job" }));
  await screen.findByText(
    "Device service could not save the request. Retry with the same operation.",
  );
  expect(screen.getByLabelText("Source record")).toHaveValue("ITEM-1");
  fireEvent.click(screen.getByRole("button", { name: /^Retry$/ }));
  await waitFor(() => expect(command).toHaveBeenCalledTimes(2));
  await waitFor(()=>{expect(command.mock.calls[1]![0]!).toEqual(command.mock.calls[0]![0]!);});
});
