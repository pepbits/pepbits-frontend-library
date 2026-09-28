import {
  ArrowLeftRight, Banknote, BookOpen, BookOpenCheck, BookText, Boxes, Building2, Calculator, CalendarCheck,
  CalendarClock, CalendarDays, Car, ChartColumn, ClipboardCheck, Clock, Coins, Database, DoorOpen, FileText,
  FlaskConical, FolderTree, Globe, GraduationCap, Hash, HeartPulse, Hourglass, Inbox, Layers, LayoutDashboard,
  LifeBuoy, Map, Network, Package, PackageCheck, Percent, PiggyBank, Plane, Printer, Receipt, Ruler, School,
  ScrollText, Settings, ShoppingBag, ShoppingCart, SquareUser, Stethoscope, Tags, Timer, Truck, UserCog, Users,
  Wallet, Wrench, Bell, Circle, type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  ArrowLeftRight, Banknote, BookOpen, BookOpenCheck, BookText, Boxes, Building2, Calculator, CalendarCheck,
  CalendarClock, CalendarDays, Car, ChartColumn, ClipboardCheck, Clock, Coins, Database, DoorOpen, FileText,
  FlaskConical, FolderTree, Globe, GraduationCap, Hash, HeartPulse, Hourglass, Inbox, Layers, LayoutDashboard,
  LifeBuoy, Map, Network, Package, PackageCheck, Percent, PiggyBank, Plane, Printer, Receipt, Ruler, School,
  ScrollText, Settings, ShoppingBag, ShoppingCart, UserSquare: SquareUser, Stethoscope, Tags, Timer, Truck,
  UserCog, Users, Wallet, Wrench, Bell,
};

export function Icon({ name, className, size = 18 }: { name: string; className?: string; size?: number }) {
  const C = ICONS[name] ?? Circle;
  return <C size={size} className={className ? `shrink-0 ${className}` : 'shrink-0'} strokeWidth={1.75} aria-hidden />;
}
