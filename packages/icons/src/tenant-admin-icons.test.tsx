// @vitest-environment jsdom
import React from "react";
import {afterEach, expect, test} from "vitest";
import {cleanup, render} from "@testing-library/react";
import * as icons from "@pepbits/icons";

afterEach(cleanup);

const names = ["BookOpenCheck", "BookText", "CalendarRange", "CircleDashed", "CircleSlash", "CopyPlus", "FolderTree", "GitBranch", "Grid3x3", "KeyRound", "ListTree", "PackageSearch", "Percent", "Rocket", "ScrollText", "TicketPercent", "Waypoints", "Workflow"] as const;
test.each(names)("tenant configuration primitive %s is exported and renders decoratively", name => {
  const Component: icons.IconComponent = icons[name];
  const svg = render(<Component aria-hidden />).container.querySelector("svg");
  expect(svg).not.toBeNull();
  expect(svg!.getAttribute("aria-hidden")).toBe("true");
});
