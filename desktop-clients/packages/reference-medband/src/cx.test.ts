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

  /** The reference's real tailwind-merge, when it is installed next to the original source: every cx() call and every pair of its classes. */
  const phial = "/home/pepadmin/pb/saas/reference/frontend/pharmacy-1/phial/frontend/package.json";
  const ORIGINAL = process.env.MEDBAND_REFERENCE_ROOT ?? "/home/pepadmin/pb/saas/reference/frontend/medband-patient-access-1/medband/src";
  const twMerge = (() => { try { return existsSync(phial) ? (createRequire(phial)("tailwind-merge").twMerge as (s: string) => string) : null; } catch { return null; } })();
  describe.skipIf(!twMerge || !existsSync(ORIGINAL))("matches tailwind-merge on the original source", () => {
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
    const files = () => walk(ORIGINAL).filter((f) => /\.tsx?$/.test(f) && !f.includes("/api/"));

    /** Class strings passed to cx() by the original, one entry per call (all string arguments, in order). */
    const callStrings = () => {
      const calls = new Set<string>();
      for (const f of files()) {
        const sf = ts.createSourceFile(f, readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        const lits = (n: ts.Node, out: string[]) => {
          if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text);
          else if (ts.isTemplateExpression(n)) { out.push(n.head.text); n.templateSpans.forEach((s) => { lits(s.expression, out); out.push(s.literal.text); }); }
          else ts.forEachChild(n, (c) => lits(c, out));
        };
        const visit = (n: ts.Node) => { if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "cx") { const out: string[] = []; n.arguments.forEach((a) => lits(a, out)); calls.add(out.join(" ").replace(/\s+/g, " ").trim()); } ts.forEachChild(n, visit); };
        visit(sf);
      }
      return [...calls];
    };

    it("every cx(...) call of the original, with all of its string arguments in order", () => {
      const calls = callStrings();
      expect(calls.length).toBeGreaterThan(80);
      expect(calls.filter((s) => cx(s) !== twMerge!(s)).map((s) => `${s}\n  ours ${cx(s)}\n  twMerge ${twMerge!(s)}`)).toEqual([]);
    });

    it("every pair (both orders) of the utilities the original passes to cx()", () => {
      const list = [...new Set(callStrings().flatMap((s) => s.split(" ")))].filter((t) => /^[!a-z0-9\-:[\]./%()#_,'=&>*@\\]+$/i.test(t) && /-|^(flex|grid|block|hidden|relative|absolute|fixed|sticky|truncate|border|rounded|shadow|inline-flex|inline|contents|transition|italic|underline|uppercase)$/.test(t));
      expect(list.length).toBeGreaterThan(200);
      const bad: string[] = [];
      for (const a of list) for (const b of list) { const s = `${a} ${b}`; if (cx(s) !== twMerge!(s)) bad.push(s); }
      expect(bad).toEqual([]);
    }, 60_000);
  });
});
