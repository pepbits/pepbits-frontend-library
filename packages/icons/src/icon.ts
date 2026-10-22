import {createElement} from "react";
import type {LucideIcon, LucideProps} from "lucide-react";

export type IconComponent = LucideIcon;
export interface IconProps extends LucideProps {
  icon: IconComponent;
  /** Localized accessible name. Omit for a decorative icon in a labelled control. */
  label?: string;
}

export function Icon({icon, label, ...props}: IconProps) {
  const name = label?.trim();
  return createElement(icon, {
    focusable: false,
    ...props,
    ...(name ? {role: "img", "aria-label": name, "aria-hidden": false}
      : {"aria-hidden": props["aria-hidden"] ?? true}),
  });
}
