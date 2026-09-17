"use client";
import React from 'react';
import styles from './workspace-page.module.css';
/** Presentation only. Hosts retain navigation, authentication and data ownership. */
export function WorkspacePage({layout='standard',children}:{layout?:'standard'|'record';children:React.ReactNode}){
 return <div className={styles.page} data-workspace-layout={layout}>{children}</div>;
}
