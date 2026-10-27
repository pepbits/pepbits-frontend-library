# @pepbits/icons

A thin React icon surface for shared primitives, using the existing `lucide-react ^0.468.0` version range. This `0.1.0` ESM package peer-depends on React 19 or later.

Published at **0.1.0** on GitHub Packages. Install with `npm install @pepbits/icons` after adding the `@pepbits` registry `.npmrc` and a read token — see the [developer quick start](../../docs/development/PUBLISHING.md#developer-quick-start-for-product-apps). Working examples: the [component showcase](../../demo-apps/showcase/README.md) and the [demo apps](../../demo-apps/README.md).

## Public API and use

The root entry exports `Check`, `ChevronDown`, `ChevronLeft`, `ChevronRight`, `FileQuestion`, `GitCompareArrows`, `Inbox`, `Loader2`, `LoaderCircle`, `LogIn`, `Search`, `ShieldOff`, `TrendingDown`, `TrendingUp`, `TriangleAlert` and `X`: the complete set imported by the existing primitive sources. It also exports `Icon`, `IconComponent` (Lucide's component type) and `IconProps`.

```tsx
import {Icon, Search} from '@pepbits/icons';

<button aria-label="Search"><Icon icon={Search} size={16} /></button>;
<Icon icon={Search} label="Search" />; // standalone named image
```

`Icon` passes Lucide sizing, stroke, style and SVG props through. It defaults to `aria-hidden=true` and `focusable=false`. A nonblank `label` gives it `role=img`, the accessible label, and `aria-hidden=false`; whitespace-only labels stay decorative. A caller can explicitly opt out of default hiding for an externally labelled SVG. Named re-exports retain Lucide's own behavior; use the wrapper for these accessibility defaults.

Hosts translate accessible labels and apply effective size, color and reduced-motion preferences through classes/props. A decorative icon inside an already labelled control needs no duplicate label. There is no internal animation or preference store.

## Scope and verification

No product/module icon maps, navigation metadata, general wildcard Lucide export, or new icon artwork. `npm test -w @pepbits/icons` renders each re-export and checks decorative/labelled accessibility behavior in jsdom; `npm run typecheck -w @pepbits/icons` checks public types. No browser or screen-reader acceptance is claimed.

## Phase 4b engine icons

The shared barrel additionally exports the 39 Lucide names used by the copied record/worklist/form engines. They use the existing Lucide dependency and decorative/accessibility conventions; page engines never import Lucide directly. See [phase 4b](../../docs/releases/unreleased/restructure-phase-4b-2026-10-23.md).

## Phase 5 shell icons

`AlertCircle` and `Info` are additionally re-exported for the shell toast viewport. Existing icon behavior is unchanged. See the [phase 5 record](../../docs/releases/unreleased/restructure-phase-5-2026-10-23.md).

Phase 5 part 2 adds 23 primitive exports used by shell chrome, tours and workspace controls (including BookOpen, Command, Pin/PinOff, LayoutDashboard, ArrowLeftRight and Maximize2). Shell imports these through this package; no second icon system or runtime wrapper was introduced.

## Phase 6b-1 product primitives

The public barrel additionally exports the Lucide primitives needed by the healthcare product screens (patient, calendar, clinical, billing and resource symbols). These are direct primitive re-exports; there is no healthcare icon registry or product logic in the library. Existing icon wrapper/export tests are retained; healthcare component and route tests exercise the newly consumed primitives. See the [6b-1 record](../../docs/releases/unreleased/restructure-phase-6b-1-2026-10-23.md) for the exact source manifest.

## Phase 6b-2 diagnostic primitives

The public barrel adds 38 direct Lucide exports for laboratory/radiology workflows (including ScanBarcode, Images, Ruler and ZoomIn). These are primitive exports using the existing dependency; no diagnostic registry or product behavior is added. Healthcare component and browser checks exercise their consuming controls.

## Phase 4c pattern icons

`Type`, `AlignLeft`, `Hash`, `Calendar`, `Clock`, `CheckSquare`, `Mail` and `WandSparkles` are additionally re-exported for form authoring and spreadsheet controls. They keep the existing Lucide dependency and named-export behavior; patterns never imports Lucide directly. See the [phase 4c record](../../docs/releases/unreleased/restructure-phase-4c-2026-10-23.md).

Pharmacy adds direct `Banknote`, `Bike`, `CirclePause`, `CornerDownLeft`, `Gavel`, `HandCoins`, `Landmark`, `MessageCircle`, `Moon`, `PackageCheck`, `PackageX`, `Radio`, `ShoppingBag`, `ShoppingBasket`, `Snowflake`, `Store` and `Sun` primitives. Each export is covered by a render test; product navigation stays in the demo.

Tenant Admin (phase 6e-2) adds direct `BookOpenCheck`, `BookText`, `CalendarRange`, `CircleDashed`, `CircleSlash`, `CopyPlus`, `FolderTree`, `GitBranch`, `Grid3x3`, `KeyRound`, `ListTree`, `PackageSearch`, `Percent`, `Rocket`, `ScrollText`, `TicketPercent`, `Waypoints` and `Workflow` primitives for registry-driven configuration pages. A dedicated render test covers each export; the registry icon-name map stays in the demo.

RCM adds direct primitives: AlarmClock, BarChart3, Calculator, Code2, ConciergeBell, FileMinus2, FileOutput, FileSearch, FileStack, GitCompare, Home, Hourglass, KanbanSquare, ListChecks, ListTodo, Megaphone, MessageSquareText, MousePointerClick, Package, PieChart, PiggyBank, RadioTower, Scale and Sigma. These are presentation exports, with no product registry.

Phase 6b-5 adds direct Lucide presentation exports: ArrowRightCircle, CalendarCheck, Camera, CameraOff, Circle, ClipboardPlus, CloudOff, FlaskConical, FolderHeart, MonitorSmartphone, MonitorUp, PhoneOff, PlusCircle, ScanFace, Signal, Smartphone, Video, Wifi, WifiOff. Each is covered by the public-export render test; no Teleconsult logic is included.

Quality adds direct Lucide exports `ArrowDownRight`, `Bell`, `Gauge`, `LineChart` and `Timer` for assurance dashboards and report sections, covered by the public icon render tests.

Phase 6b-7 adds direct `Droplet`, `Shield` and `Scissors` primitives for the SurgiSuite demonstration. Export/render cases cover all three; product aliases stay in the demo.

Patient access adds `BedDouble`, `CircleDollarSign`, `FolderPlus`, `SearchX`, `Sunrise` and `Crown` as direct primitives, covered by public render tests.

MedSlot uses the public `Armchair`, `Bed`, `Brush`, `CalendarX`, `Menu`, `Monitor` and `Trash` primitives. Product category mappings remain in the demo.

Phase 6d adds 36 direct Lucide primitives for education and general actions (including GraduationCap, School, BookCopy, BookMarked, BookPlus, BookUp, BookX, CalendarOff, Grid3x3, Highlighter and PenTool), plus the `LucideIcon` type alias. Each runtime export is included in the render regression. There is no school icon registry or new dependency.

The reports demo adds direct `Blocks`, `FileBarChart`, `FolderDown`, and `MailPlus` primitives (it also uses `KeyRound`, `Library`, `ScrollText`, `Settings` and `Zap`, which earlier phases export), each covered by a public render test. Report navigation stays in the demo.

## Phase 6e-3 onboarding primitives

Seven direct Lucide exports are added for the Orvia onboarding demo: `Accessibility`, `ArrowBigUpDash`, `FileLock2`, `KeyRound`, `MailCheck`, `TestTube` and `Workflow`. They use the existing dependency and conventions; the export test renders each one. There is no onboarding icon registry in the library.

Phase 6e-4 adds direct `ChartColumnBig`, `CircleDashed`, `Gift`, `Nfc`, `Tag`, `User` and `Vault` primitives for the Settle billing demo (reports, pending discounts, reward points, card terminal, discounts, patients and day close). Each is covered by the separate `settle-icons.test.tsx` render cases; no billing logic is included.

CareGrid scheduling adds direct `Accessibility`, `Apple`, `Baby`, `Brain`, `CalendarOff`, `CalendarRange`, `Car`, `Clipboard`, `Cpu`, `House`, `Leaf`, `LibraryBig`, `LifeBuoy`, `Lightbulb`, `Repeat`, `Smile`, `TestTube`, `User`, `UserX`, `Wand2` and `Zap` primitives, each covered by a render test. Category and resource-kind mappings stay in the demo.

## Hierarchy primitives

`ChevronsDownUp`, `ChevronsUpDown`, `Folder` and `FolderOpen` are additive direct Lucide exports in their own module. They use the existing dependency and have four public-barrel render checks. Product hierarchy metadata stays with the host.

`ZoomOut` is also available from the public barrel for print-preview zoom controls, alongside `ZoomIn`. It forwards the existing Lucide icon without a dependency or behavior change.
