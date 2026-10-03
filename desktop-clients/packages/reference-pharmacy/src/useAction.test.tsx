import { act, cleanup, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ReferenceHostProvider } from "@pepbits/reference-host";
import { ToastProvider } from "./components/ui/toast";
import { PharmacyDataProvider } from "./lib/api";
import { useAction } from "./lib/useAction";
import { json, makeHost } from "./test-utils";

afterEach(cleanup);

describe("useAction", () => {
  it("runs one mutation at a time: a second call in the same tick is ignored until the first settles", async () => {
    const { host } = makeHost(() => json({}));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ReferenceHostProvider host={host}><PharmacyDataProvider><ToastProvider>{children}</ToastProvider></PharmacyDataProvider></ReferenceHostProvider>
    );
    const { result } = renderHook(() => useAction(), { wrapper });
    let release!: () => void;
    let started = 0;
    const slow = () => { started++; return new Promise<string>((resolve) => { release = () => resolve("done"); }); };
    let first!: Promise<string | undefined>, second!: Promise<string | undefined>;
    await act(async () => {
      first = result.current.run("save", slow);
      second = result.current.run("save", slow);
      expect(await second).toBeUndefined();
    });
    expect(started).toBe(1);
    expect(result.current.busy).toBe("save");
    await act(async () => { release(); await first; });
    expect(await first).toBe("done");
    expect(result.current.busy).toBeNull();
    await act(async () => { const again = result.current.run("save", async () => { started++; return "again"; }); expect(await again).toBe("again"); });
    expect(started).toBe(2);
  });
});
