// @vitest-environment jsdom
import React from "react";
import {afterEach, expect, test} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import * as icons from "@pepbits/icons";

afterEach(cleanup);

const names = ["ArrowDownWideNarrow","Award","BookCopy","BookMarked","BookPlus","BookUp","BookX","Briefcase","CalendarOff","Coffee","DollarSign","Eraser","FileSpreadsheet","Film","Flag","GraduationCap","Grid3x3","Highlighter","Kanban","KeyRound","Laptop","Library","Palette","Paperclip","PenTool","Percent","Redo2","School","Settings","Smile","Target","User","UserCog","UserX","VideoOff","Zap","BedDouble","CircleDollarSign","FolderPlus","SearchX","Sunrise","Crown","Droplet","Shield","Scissors","ArrowDownRight","Bell","Gauge","LineChart","Timer","ArrowRightCircle","CalendarCheck","Camera","CameraOff","Circle","ClipboardPlus","CloudOff","FlaskConical","FolderHeart","MonitorSmartphone","MonitorUp","PhoneOff","PlusCircle","ScanFace","Signal","Smartphone","Video","Wifi","WifiOff","AlarmClock","BarChart3","Calculator","Code2","ConciergeBell","FileMinus2","FileOutput","FileSearch","FileStack","GitCompare","Home","Hourglass","KanbanSquare","ListChecks","ListTodo","Megaphone","MessageSquareText","MousePointerClick","Package","PieChart","PiggyBank","RadioTower","Scale","Sigma","Check", "ChevronDown", "ChevronLeft", "ChevronRight", "FileQuestion", "GitCompareArrows",
  "Banknote", "Bike", "CirclePause", "CornerDownLeft", "Gavel", "HandCoins", "Landmark", "MessageCircle", "Moon", "PackageCheck", "PackageX", "Radio", "ShoppingBag", "ShoppingBasket", "Snowflake", "Store", "Sun",
  "Accessibility", "ArrowBigUpDash", "FileLock2", "KeyRound", "MailCheck", "TestTube", "Workflow",
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

import {Armchair,Bed,Brush,CalendarX,Menu,Monitor,Trash} from './index';
test.each([Armchair,Bed,Brush,CalendarX,Menu,Monitor,Trash])('renders MedSlot primitive %s',Icon=>{const {container}=render(<Icon aria-label="Scheduling icon"/>);expect(container.querySelector('svg')).toBeTruthy();});

import {Blocks,FileBarChart,FolderDown,KeyRound,Library,MailPlus,ScrollText,Settings,Zap} from './index';
test.each([Blocks,FileBarChart,FolderDown,KeyRound,Library,MailPlus,ScrollText,Settings,Zap])('renders reports demo primitive %s',Icon=>{const {container}=render(<Icon aria-label="Reports icon"/>);expect(container.querySelector('svg')).toBeTruthy();});
