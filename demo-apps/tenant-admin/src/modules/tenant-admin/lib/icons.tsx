import {
  Activity, ArrowLeftRight, BadgeCheck, BedDouble, BookOpenCheck, BookText, Boxes, Building2, CalendarRange,
  ClipboardList, CreditCard, FileSignature, FolderTree, GitBranch, GitCompareArrows, Grid3x3, Handshake, Hash,
  KeyRound, Landmark, Layers, ListTree, PackageSearch, Percent, Rocket, Route, Scale, ScrollText, Share2,
  ShieldCheck, Sigma, SlidersHorizontal, Sparkles, Stethoscope, TicketPercent, Users, Waypoints, Workflow,
  type IconComponent,
} from "@pepbits/icons";

const ICONS: Record<string, IconComponent> = {
  Activity, ArrowLeftRight, BadgeCheck, BedDouble, BookOpenCheck, BookText, Boxes, Building2, CalendarRange,
  ClipboardList, CreditCard, FileSignature, FolderTree, GitBranch, GitCompareArrows, Grid3x3, Handshake, Hash,
  KeyRound, Landmark, Layers, ListTree, PackageSearch, Percent, Rocket, Route, Scale, ScrollText, Share2,
  ShieldCheck, Sigma, SlidersHorizontal, Sparkles, Stethoscope, TicketPercent, Users, Waypoints, Workflow,
};

export function Icon({ name, className, strokeWidth = 1.75 }: { name: string; className?: string; strokeWidth?: number }) {
  const C = ICONS[name] ?? Boxes;
  return <C className={className} strokeWidth={strokeWidth} aria-hidden />;
}

/** The component for a registry icon name (navigation and badges); unknown names fall back to the source's Boxes. */
export const iconFor = (name: string): IconComponent => ICONS[name] ?? Boxes;
