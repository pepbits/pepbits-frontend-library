"use client";

import React from "react";
import { cn } from "./cn";

export interface NavLinkProps {
  /** A real URL on web; "#" or undefined on desktop, where clicks are handled in JS. */
  href?: string;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  className?: string;
  title?: string;
  "aria-current"?: React.AriaAttributes["aria-current"];
  children: React.ReactNode;
}

/* One component so a navigating row is a real anchor on web — giving cmd-click,
   middle-click, "copy link address" and a status-bar preview for free — and a button
   on desktop, where there is no URL to copy. The reset classes exist so the two
   branches render identically: an <a> carries an underline and a text cursor by
   default, and a <button> centres its text. */
const RESET = "no-underline cursor-pointer text-left appearance-none";

export function NavLink({ href, onClick, className, title, children, "aria-current": ariaCurrent }: NavLinkProps) {
  if (href && href !== "#") {
    return (
      <a href={href} onClick={onClick} title={title} aria-current={ariaCurrent} className={cn(RESET, className)}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} title={title} aria-current={ariaCurrent} className={cn(RESET, className)}>
      {children}
    </button>
  );
}
