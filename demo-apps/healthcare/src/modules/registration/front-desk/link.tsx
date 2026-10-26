"use client";

// Stand-ins for next/link and next/navigation's router in the copied pages. Source routes that
// exist in this demo are mapped to AllyVora Patients routes and opened through the host navigation;
// the rest render as a disabled element titled "Not available in this demo".
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { useNavigation } from "@pepbits/platform/navigation";
import { targetFromPath } from "../routes";

const UNAVAILABLE = "Not available in this demo";

/** Source href → demo href, or null when the source page is not part of this demo. */
export function demoHref(href: string): string | null {
  const [path = "", query = ""] = href.split("?");
  if (path === "/registration") return "/allyvora-patients/patients?mode=new";
  if (path === "/front-desk/emergency") return "/allyvora-patients/emergency";
  if (path === "/front-desk/visits/new") return "/allyvora-patients/visits/new" + (query ? `?${query}` : "");
  const chart = path.match(/^\/patients\/([1-9][0-9]{0,9})$/);
  if (chart) return `/allyvora-patients/patients?mode=view&id=${chart[1]}`;
  return null;
}

export function useRouter() {
  const navigation = useNavigation();
  const go = (href: string) => {
    const mapped = demoHref(href);
    if (!mapped) return;
    const [path = "", query = ""] = mapped.split("?");
    navigation.open(targetFromPath(path, query));
  };
  return { push: go, replace: go };
}

export function Link({ href, children, className, target, ...rest }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; children: ReactNode }) {
  const navigation = useNavigation();
  const mapped = demoHref(href);
  if (!mapped) return <span className={className} aria-disabled="true" title={UNAVAILABLE} data-unavailable={href} style={{ cursor: "not-allowed", opacity: 0.6 }}>{children}</span>;
  const [path = "", query = ""] = mapped.split("?");
  const destination = targetFromPath(path, query);
  return <a {...rest} href={mapped} target={target} className={className} onClick={(event) => {
    if (target === "_blank" || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) { if (target === "_blank") { event.preventDefault(); navigation.openInNewContext(destination); } return; }
    event.preventDefault();
    navigation.open(destination);
  }}>{children}</a>;
}
