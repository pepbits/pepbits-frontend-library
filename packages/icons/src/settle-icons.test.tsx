// @vitest-environment jsdom
import React from "react";
import {afterEach, expect, test} from "vitest";
import {cleanup, render} from "@testing-library/react";
import * as icons from "@pepbits/icons";

afterEach(cleanup);

// Phase 6e-4 Settle primitives: direct Lucide re-exports, no billing logic.
const names = ["ChartColumnBig", "CircleDashed", "Gift", "Nfc", "Tag", "User", "Vault"] as const;
test.each(names)("%s is exported and renders", name => {
  const Component: icons.IconComponent = icons[name];
  expect(render(<Component />).container.querySelector("svg")).not.toBeNull();
});
