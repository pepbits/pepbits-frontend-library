import {readFileSync, existsSync} from "node:fs";
import {expect, test} from "vitest";
import {TOKEN_NAMES, tokenVar, type TokenName} from "@pepbits/tokens";

test("the typed token list exactly matches CSS declarations, without duplicates", () => {
  const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const declarations = [...new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1]))].sort();
  expect(TOKEN_NAMES).toEqual(declarations);
});

test("tokenVar preserves the CSS custom property name", () => {
  const name: TokenName = "--primary";
  expect(tokenVar(name)).toBe("var(--primary)");
  // @ts-expect-error Unknown names must not compile.
  tokenVar("--not-a-token");
});

test("every font referenced by the stylesheet is present", () => {
  const css = readFileSync(new URL("./reference-fonts.css", import.meta.url), "utf8");
  const urls = [...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)];
  expect(urls.length).toBeGreaterThan(0);
  for (const [, path] of urls) {
    expect(existsSync(new URL(path!, import.meta.url)), path).toBe(true);
    expect(readFileSync(new URL(path!, import.meta.url)).subarray(0, 4).toString()).toBe("wOF2");
  }
});
