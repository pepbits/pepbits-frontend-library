"use client";
import {
  Stethoscope, FlaskConical, ScanLine, Scissors, Pill, Activity, Syringe, Video, Bed, ClipboardList, Brush,
  UserRound, DoorOpen, Armchair, Monitor, Package,
} from "lucide-react";
import type { Category, ResourceType } from "../lib/types";

export const CategoryIcon = ({ category, className = "size-4" }: { category: Category; className?: string }) => {
  const I = {
    consultation: Stethoscope, lab: FlaskConical, radiology: ScanLine, dental: Brush, surgery: Scissors, pharmacy: Pill,
    therapy: Activity, procedure: ClipboardList, vaccination: Syringe, telehealth: Video, admission: Bed,
  }[category] ?? Stethoscope;
  return <I className={className} aria-hidden />;
};

export const ResourceCategoryIcon = ({ category, className = "size-4" }: { category: ResourceType["category"]; className?: string }) => {
  const I = { person: UserRound, room: DoorOpen, bed: Bed, chair: Armchair, equipment: Monitor, other: Package }[category] ?? Package;
  return <I className={className} aria-hidden />;
};
