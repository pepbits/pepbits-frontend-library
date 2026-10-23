"use client";
import {useLocalization} from "@pepbits/i18n/react";
import {ShellLayers} from "./layers";

import React from "react";
import { useERP } from "./shell-context";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { PageDocumentationNotice } from "./documentation";
import {SentinelBoundary,SentinelBridge} from "./sentinel";
import {useNavigation} from "@pepbits/platform";
import { Footer } from "./footer";
import styles from "./enterprise-shell.module.css";

/* Structurally identical to the original shell, with one substitution: the workspace
   tab strip was mounted here directly and is now the `tabs` prop, because it exists
   only on desktop. The desktop app passes <WorkspaceTabs/>; the web app passes
   nothing and the band collapses. Everything else is shared and unchanged. */
export function EnterpriseShell({ tabs, children, header, footer, navigationExpanded = false }: { navigationExpanded?: boolean; tabs?: React.ReactNode; children: React.ReactNode; header?: React.ReactNode; footer?: React.ReactNode }) {
  const navigation=useNavigation();
  const { preferences } = useERP();
  const {direction} = useLocalization();
  return (
    /* relative: the sidebar is absolutely positioned inside this box so that hover
         expansion floats over the page instead of pushing it. */
    <div className={`relative flex h-dvh w-full overflow-hidden ${(preferences.sidebarPlacement === "right") !== (direction === "rtl") ? "flex-row-reverse" : "flex-row"}`}>
      <SentinelBridge />
      <SentinelBoundary resetKey={navigation.current.pageId}>
      <Sidebar forceExpanded={navigationExpanded} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {header ?? <Header />}

        {tabs}
        <main className={`${styles.content} nex-scrollbar relative min-h-0 flex-1 overflow-auto bg-[var(--bg)] p-3 md:p-4`}><PageDocumentationNotice />{children}</main>
        {footer ?? <Footer />}
      </div>
      <ShellLayers />
      </SentinelBoundary>
    </div>
  );
}
