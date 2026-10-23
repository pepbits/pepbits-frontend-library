// @vitest-environment jsdom
import React from "react";
import {afterEach, expect, test} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import * as icons from "@pepbits/icons";

afterEach(cleanup);

const names = ["BedDouble","CircleDollarSign","FolderPlus","SearchX","Sunrise","Crown","Droplet","Shield","Scissors","ArrowDownRight","Bell","Gauge","LineChart","Timer","ArrowRightCircle","CalendarCheck","Camera","CameraOff","Circle","ClipboardPlus","CloudOff","FlaskConical","FolderHeart","MonitorSmartphone","MonitorUp","PhoneOff","PlusCircle","ScanFace","Signal","Smartphone","Video","Wifi","WifiOff","AlarmClock","BarChart3","Calculator","Code2","ConciergeBell","FileMinus2","FileOutput","FileSearch","FileStack","GitCompare","Home","Hourglass","KanbanSquare","ListChecks","ListTodo","Megaphone","MessageSquareText","MousePointerClick","Package","PieChart","PiggyBank","RadioTower","Scale","Sigma","Check", "ChevronDown", "ChevronLeft", "ChevronRight", "FileQuestion", "GitCompareArrows",
  "Banknote", "Bike", "CirclePause", "CornerDownLeft", "Gavel", "HandCoins", "Landmark", "MessageCircle", "Moon", "PackageCheck", "PackageX", "Radio", "ShoppingBag", "ShoppingBasket", "Snowflake", "Store", "Sun",
  "Inbox", "Loader2", "LoaderCircle", "LogIn", "Search", "ShieldOff", "TrendingDown", "TrendingUp", "TriangleAlert", "X"] as const;
test.each(names)("%s is exported and renders", name => {
  const Component: icons.IconComponent = icons[name];
  expect(render(<Component />).container.querySelector("svg")).not.toBeNull();
});

test("icons are decorative by default and retain sizing and styling props", () => {
  const {container} = render(<icons.Icon icon={icons.Search} size={18} className="test-icon" />);
  const svg = container.querySelector("svg")!;
  expect(svg.getAttribute("aria-hidden")).toBe("true");
  expect(svg.getAttribute("focusable")).toBe("false");
  expect(svg.getAttribute("width")).toBe("18");
  expect(svg.classList.contains("test-icon")).toBe(true);
  expect(screen.queryByRole("img")).toBeNull();
});

test("a localized label provides an accessible image name, even with conflicting hidden props", () => {
  render(<icons.Icon icon={icons.Search} label="بحث" aria-hidden />);
  expect(screen.getByRole("img", {name: "بحث"}).getAttribute("aria-hidden")).toBe("false");
});

test("blank labels stay decorative and an explicit external name can opt out", () => {
  const {rerender, container} = render(<icons.Icon icon={icons.Search} label="  " />);
  expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  rerender(<icons.Icon icon={icons.Search} aria-hidden={false} role="img" aria-label="Search" />);
  expect(screen.getByRole("img", {name: "Search"})).not.toBeNull();
});
