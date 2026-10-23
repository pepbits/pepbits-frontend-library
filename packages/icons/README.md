# @pepbits/icons

A thin React icon surface for shared primitives, using the existing `lucide-react ^0.468.0` version range. This unpublished `0.0.0` source package peer-depends on React 19 or later.

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
