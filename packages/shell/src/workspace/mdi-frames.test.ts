import { describe, expect, test, vi } from "vitest";
import { bringToFront, cascade, clampFrame, readFrameSizes, syncFrames, toggleMinimised, writeFrameSizes } from "./mdi-frames.ts";
import type { MdiFrame } from "./mdi-frames.ts";

const bounds = { width: 1200, height: 800 };
const frame = (documentId: string, over: Partial<MdiFrame> = {}): MdiFrame =>
  ({ documentId, documentType: "PAGE", x: 20, y: 20, width: 600, height: 400, minimised: false, z: 1, ...over });

describe("cascade", () => {
  /* Windows opened one after another must not land on top of each other, or the
     second one looks like the first one moved. */
  test("each new frame steps down and across", () => {
    const a = cascade(0, bounds);
    const b = cascade(1, bounds);
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.y).toBeGreaterThan(a.y);
  });

  /* Otherwise the fifth window opens below the fold, and a window you cannot
     see is a window you cannot close. */
  test("it wraps rather than walking off the bottom", () => {
    const many = Array.from({ length: 12 }, (_, index) => cascade(index, bounds));
    for (const f of many) {
      expect(f.x + f.width).toBeLessThanOrEqual(bounds.width);
      expect(f.y + f.height).toBeLessThanOrEqual(bounds.height);
    }
    expect(many[11]!.y).toBeLessThan(many[6]!.y + 200);
  });

  test("a frame is never bigger than the space it opens into", () => {
    const small = cascade(0, { width: 500, height: 360 });
    expect(small.width).toBeLessThanOrEqual(500);
    expect(small.height).toBeLessThanOrEqual(360);
  });
});

describe("clampFrame", () => {
  /* Shrinking the shell — a smaller monitor, a sidebar opening — must not leave
     windows stranded outside it. */
  test("pulls a frame back inside when the space shrinks", () => {
    const out = clampFrame(frame("a", { x: 1100, y: 700 }), { width: 800, height: 600 });
    expect(out.x + out.width).toBeLessThanOrEqual(800);
    expect(out.y + out.height).toBeLessThanOrEqual(600);
    expect(out.x).toBeGreaterThanOrEqual(0);
  });

  test("and shrinks one that no longer fits at all", () => {
    const out = clampFrame(frame("a", { width: 900, height: 700 }), { width: 400, height: 300 });
    expect(out.width).toBeLessThanOrEqual(400);
    expect(out.height).toBeLessThanOrEqual(300);
  });

  test("a frame already inside is returned unchanged", () => {
    const inside = frame("a");
    expect(clampFrame(inside, bounds)).toBe(inside);
  });
});

describe("bringToFront", () => {
  test("puts the named frame above every other", () => {
    const frames = [frame("a", { z: 1 }), frame("b", { z: 2 }), frame("c", { z: 3 })];
    const next = bringToFront(frames, "a");
    const z = Object.fromEntries(next.map((f) => [f.documentId, f.z]));
    expect(z.a).toBeGreaterThan(z.b!);
    expect(z.a).toBeGreaterThan(z.c!);
  });

  /* Raising one window must not shuffle the rest. Two clicks on the same window
     should leave everything else where it was. */
  test("leaves the order of the others alone", () => {
    const frames = [frame("a", { z: 1 }), frame("b", { z: 2 }), frame("c", { z: 3 })];
    const next = bringToFront(frames, "a");
    const z = Object.fromEntries(next.map((f) => [f.documentId, f.z]));
    expect(z.c).toBeGreaterThan(z.b!);
  });

  test("raising the front frame changes nothing", () => {
    const frames = [frame("a", { z: 1 }), frame("b", { z: 9 })];
    expect(bringToFront(frames, "b")).toBe(frames);
  });
});

describe("toggleMinimised", () => {
  /* Restoring has to put the window back where it was, or minimising becomes a
     way of losing your layout. */
  test("keeps the geometry across a round trip", () => {
    const frames = [frame("a", { x: 300, y: 150, width: 700, height: 500 })];
    const min = toggleMinimised(frames, "a");
    expect(min[0]!.minimised).toBe(true);
    expect(min[0]!.x).toBe(300);
    const back = toggleMinimised(min, "a");
    expect(back[0]).toEqual(frames[0]);
  });

  test("restoring brings it to the front", () => {
    const frames = [frame("a", { z: 1, minimised: true }), frame("b", { z: 5 })];
    const next = toggleMinimised(frames, "a");
    expect(next.find((f) => f.documentId === "a")!.z).toBeGreaterThan(5);
  });
});

describe("syncFrames", () => {
  const docs = [
    { documentId: "a", documentType: "ITEM" },
    { documentId: "b", documentType: "RECORD" },
  ];

  test("gives a new document a frame", () => {
    const next = syncFrames([], docs, bounds);
    expect(next.map((f) => f.documentId)).toEqual(["a", "b"]);
  });

  test("drops frames for documents that closed", () => {
    const next = syncFrames([frame("a"), frame("gone")], docs, bounds);
    expect(next.map((f) => f.documentId).sort()).toEqual(["a", "b"]);
  });

  /* A window the user moved must stay where they put it when another one
     opens. */
  test("leaves an existing frame exactly as it was", () => {
    const mine = frame("a", { x: 444, y: 222 });
    const next = syncFrames([mine], docs, bounds);
    expect(next.find((f) => f.documentId === "a")).toBe(mine);
  });

  test("returns the same array when nothing changed", () => {
    const frames = [frame("a"), frame("b")];
    expect(syncFrames(frames, docs, bounds)).toBe(frames);
  });
});

describe("remembered sizes", () => {
  /* Keyed by document TYPE, never by record. "How big I like an record window"
     is the useful memory, and it puts no record ids in local storage — §17.7
     wants the minimum kept there, and this is less than the minimum. */
  test("round-trips a size for a type", () => {
    writeFrameSizes({ RECORD: { width: 900, height: 620 } });
    expect(readFrameSizes().RECORD).toEqual({ width: 900, height: 620 });
  });

  test("stores no record identifiers at all", () => {
    writeFrameSizes({ INTERACTION: { width: 800, height: 600 } });
    const raw = JSON.stringify(readFrameSizes());
    expect(raw).not.toMatch(/CUS-|5001|documentId/);
  });

  /* A private window, cleared site data, or a browser set to block storage.
     Spied on the prototype, not the instance: jsdom's localStorage is
     proxy-backed and an assignment to window.localStorage.getItem is quietly
     ignored, so the first version of this test replaced nothing and passed
     against the real implementation. */
  test("survives storage being unavailable", () => {
    const blocked = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => readFrameSizes()).not.toThrow();
    expect(readFrameSizes()).toEqual({});
    blocked.mockRestore();
  });

  test("and survives storage refusing a write", () => {
    const blocked = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(() => writeFrameSizes({ RECORD: { width: 900, height: 620 } })).not.toThrow();
    blocked.mockRestore();
  });

  test("ignores anything that is not a size", () => {
    window.localStorage.setItem("pepbits-mdi-frames", '{"RECORD":{"width":"wide"},"OK":{"width":700,"height":500}}');
    const sizes = readFrameSizes();
    expect(sizes.RECORD).toBeUndefined();
    expect(sizes.OK).toEqual({ width: 700, height: 500 });
  });
});
