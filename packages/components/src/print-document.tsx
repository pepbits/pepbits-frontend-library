"use client";
import React, {useEffect,useRef,type RefObject} from "react";
import { createPortal } from "react-dom";
/** Host-controlled print surface. No data fetching, formatting or authorization. */
export function PrintDocument({ children, className = '', style, sourceRef }: { children?: React.ReactNode; className?: string; style?: React.CSSProperties; sourceRef?: RefObject<HTMLElement|null> }) {
  const snapshot=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!sourceRef)return;
    const clear=()=>snapshot.current?.replaceChildren();
    const capture=()=>{
      clear();const source=sourceRef.current;if(!source||!snapshot.current)return;
      const clone=source.cloneNode(true) as HTMLElement;
      // Copy live form properties, which cloneNode intentionally does not serialize consistently.
      const originals=source.querySelectorAll('input,textarea,select');
      clone.querySelectorAll('input,textarea,select').forEach((node,index)=>{
        const original=originals[index] as HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement;
        if(node instanceof HTMLInputElement&&original instanceof HTMLInputElement){node.value=original.value;node.checked=original.checked;}
        else if(node instanceof HTMLTextAreaElement||node instanceof HTMLSelectElement)node.value=original.value;
      });
      snapshot.current.append(clone);
    };
    window.addEventListener('beforeprint',capture);window.addEventListener('afterprint',clear);
    return ()=>{window.removeEventListener('beforeprint',capture);window.removeEventListener('afterprint',clear);clear();};
  },[sourceRef]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className={`ops-print-document ${className}`} style={style}>
      <style>{`.ops-print-document{display:none}@media print{body:has(>.ops-print-document)>:not(.ops-print-document){display:none!important}body>.ops-print-document{display:block!important;color:#000;background:#fff;padding:12mm;font:12pt sans-serif;overflow-wrap:anywhere}body>.ops-print-document section{break-inside:avoid}body>.ops-print-document h2{margin-top:8mm}}`}</style>
      {sourceRef?<div ref={snapshot} data-print-snapshot/>:children}
    </div>,
    document.body,
  );
}
