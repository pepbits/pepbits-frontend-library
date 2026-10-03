import {
  Activity, ArrowRightLeft, BadgeCheck, Banknote, BarChart3, BookOpen, Boxes, Calculator, CalendarClock, Code2, Columns3,
  ConciergeBell, FileMinus2, FileOutput, FilePlus2, FileStack, FileText, Gavel, GitCompare, HandCoins, Home, IdCard, Inbox,
  KanbanSquare, Landmark, Layers, ListTodo, Mail, Megaphone, MessageSquareText, Package, PencilLine, PieChart, PiggyBank,
  RadioTower, Receipt, Scale, ShieldCheck, ShieldPlus, Sigma, Sparkles, TrendingUp, Undo2, Users, Wallet,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  Activity, ArrowRightLeft, BadgeCheck, Banknote, BarChart3, BookOpen, Boxes, Calculator, CalendarClock, Code2, Columns3,
  ConciergeBell, FileMinus2, FileOutput, FilePlus2, FileStack, FileText, Gavel, GitCompare, HandCoins, Home, IdCard, Inbox,
  KanbanSquare, Landmark, Layers, ListTodo, Mail, Megaphone, MessageSquareText, Package, PencilLine, PieChart, PiggyBank,
  RadioTower, Receipt, Scale, ShieldCheck, ShieldPlus, Sigma, Sparkles, TrendingUp, Undo2, Users, Wallet,
};

export function Icon({ name, className, strokeWidth = 1.75 }: { name: string; className?: string; strokeWidth?: number }) {
  const C = ICONS[name] ?? Boxes;
  return <C className={className} strokeWidth={strokeWidth} aria-hidden />;
}
