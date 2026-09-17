"use client";
import { LocalizedText } from "@pepbits/ops-ui";

import React from "react";
import { useERP } from "./erp-context";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { PageDocumentationNotice } from "./documentation";
import {SentinelBoundary,SentinelBridge} from "./sentinel";
import {useNavigation} from "@pepbits/platform-ports";
import { Footer } from "./footer";
import styles from "./enterprise-shell.module.css";

/* Structurally identical to the original shell, with one substitution: the workspace
   tab strip was mounted here directly and is now the `tabs` prop, because it exists
   only on desktop. The desktop app passes <WorkspaceTabs/>; the web app passes
   nothing and the band collapses. Everything else is shared and unchanged. */
export function EnterpriseShell({ tabs, children, header, footer }: { tabs?: React.ReactNode; children: React.ReactNode; header?: React.ReactNode; footer?: React.ReactNode }) {
  const navigation=useNavigation();
  const { preferences, preferencesAvailable } = useERP();
  return (
    /* relative: the sidebar is absolutely positioned inside this box so that hover
         expansion floats over the page instead of pushing it. */
    <div className={`relative flex h-dvh w-full overflow-hidden ${(preferences.sidebarPlacement === "right") !== (preferences.language === "ar") ? "flex-row-reverse" : "flex-row"}`}>
      <SentinelBridge />
      <SentinelBoundary resetKey={navigation.current.pageId}>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {header ?? <Header />}
        {preferencesAvailable === false ? <div role="status" className="border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-sm text-[var(--text-muted)]"><LocalizedText message="ui.settings.could.not.be.loaded.preference.changes.apply.to.9cc9f6fa" /></div> : null}
        {tabs}
        <main className={`${styles.content} nex-scrollbar relative min-h-0 flex-1 overflow-auto bg-[var(--bg)] p-3 md:p-4`}><PageDocumentationNotice />{children}</main>
        {footer ?? <Footer />}
      </div>
      </SentinelBoundary>
    </div>
  );
}
