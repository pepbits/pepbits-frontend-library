import oracle from "./__fixtures__/cx-oracle.json";
import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { cx } from "./lib/utils";

describe("cx is the source's twMerge: later utilities override earlier ones of the same group, shorthands override longhands", () => {
  it("keeps groups apart that Tailwind keeps apart (the focus ring and the selected-card ring must not lose their width)", () => {
    expect(cx("focus:border-scrub-500 focus:ring-2 focus:ring-scrub-100")).toBe("focus:border-scrub-500 focus:ring-2 focus:ring-scrub-100");
    expect(cx("border-scrub-500 bg-paper ring-1 ring-scrub-500")).toBe("border-scrub-500 bg-paper ring-1 ring-scrub-500");
    expect(cx("rounded-2xl bg-paper shadow-lift shadow-sm")).toBe("rounded-2xl bg-paper shadow-lift shadow-sm");
    expect(cx("gap-4 gap-y-2")).toBe("gap-4 gap-y-2");
    expect(cx("text-[13px] text-ink-faint")).toBe("text-[13px] text-ink-faint");
    expect(cx("font-mono font-semibold")).toBe("font-mono font-semibold");
    expect(cx("border-2 border-scrub-600 border-dashed")).toBe("border-2 border-scrub-600 border-dashed");
    expect(cx("animate-rise animate-fade")).toBe("animate-rise animate-fade");
  });

  it("later wins within a group and variant; variants are independent", () => {
    expect(cx("h-10 px-3 h-8")).toBe("px-3 h-8");
    expect(cx("border-line border-rose-400")).toBe("border-rose-400");
    expect(cx("text-ink hover:text-ink text-white")).toBe("hover:text-ink text-white");
    expect(cx("cursor-pointer cursor-not-allowed")).toBe("cursor-not-allowed");
    expect(cx("ring-1 ring-scrub-500 ring-2")).toBe("ring-scrub-500 ring-2");
    expect(cx("w-full w-auto")).toBe("w-auto");
  });

  it("a later shorthand removes the longhands it sets, but not the other way round", () => {
    expect(cx("px-2 py-1 p-4")).toBe("p-4");
    expect(cx("p-4 px-2")).toBe("p-4 px-2");
    expect(cx("h-full size-4")).toBe("size-4");
    expect(cx("size-4 h-8")).toBe("size-4 h-8");
    expect(cx("rounded-t-lg rounded-md")).toBe("rounded-md");
    expect(cx("grid line-clamp-2")).toBe("line-clamp-2");
    expect(cx("shrink-0 flex-1")).toBe("flex-1");
  });

  it("never removes classes it does not know (the source's bespoke names) and keeps order", () => {
    expect(cx("scroll-thin barcode animate-rise scroll-thin")).toBe("scroll-thin barcode animate-rise scroll-thin");
    expect(cx("a", false, null, undefined, "b c")).toBe("a b c");
  });

  it("every source cx call matches the retained tailwind-merge oracle", () => {
    expect(oracle.calls.length).toBeGreaterThan(80);
    for(const [input,expected] of oracle.calls)expect(cx(input),input).toBe(expected);
  });
  it("every utility pair in both orders matches the retained tailwind-merge oracle", () => {
    const changed=new Map(oracle.changedPairs.map(([a,b])=>[a,b]));
    expect(oracle.utilities.length).toBeGreaterThan(200);
    for(const a of oracle.utilities)for(const b of oracle.utilities){const input=a+" "+b;expect(cx(input),input).toBe(changed.get(input)??input);}
  });
});
