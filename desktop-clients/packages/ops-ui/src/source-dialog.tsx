"use client";
import {useEffect,useRef,type ReactNode,type RefObject} from 'react';
import {useLocalization} from './localization';
/** Shared dialog semantics and focus lifecycle; imported designs supply their own scoped chrome. */
const dialogStack: HTMLElement[] = [];
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
function useSourceDialog(open: boolean, onClose: () => void, panelRef: RefObject<HTMLElement | null>) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const restoreTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (panel) dialogStack.push(panel);
    if (panel && !panel.contains(document.activeElement)) panel.focus();
    const onKey = (event: KeyboardEvent) => {
      if (dialogStack.at(-1) !== panel || event.defaultPrevented) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); closeRef.current(); return; }
      if (event.key !== "Tab" || !panel) return;
      const stops = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute("disabled") && el.tabIndex >= 0 && !el.closest('[hidden], [aria-hidden="true"]') && el.getAttribute("type") !== "hidden" && getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden");
      if (!stops.length) { event.preventDefault(); return; }
      const first = stops[0], last = stops[stops.length - 1], active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const index = panel ? dialogStack.indexOf(panel) : -1;
      const wasTop = index === dialogStack.length - 1;
      if (index >= 0) dialogStack.splice(index, 1);
      if (wasTop && restoreTo?.isConnected) restoreTo.focus();
    };
  }, [open, panelRef]);
}

export interface SourceDialogProps {open:boolean;onClose:()=>void;title:string;className?:string;children:(panel:RefObject<HTMLDivElement|null>)=>ReactNode;}
export function SourceDialog({open,onClose,title,className,children}:SourceDialogProps){
 const {t}=useLocalization();const panel=useRef<HTMLDivElement>(null);useSourceDialog(open,onClose,panel);
 return open?<div className={className} role="dialog" aria-modal="true" aria-label={t(title)}>{children(panel)}</div>:null;
}
