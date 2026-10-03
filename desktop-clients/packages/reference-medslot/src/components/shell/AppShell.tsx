'use client';
import type {ReactNode} from 'react';
import {AuthProvider} from './auth';import {Header} from './Header';import {Footer} from './Footer';
// Header module picker and collapsible sidebar are provided by the shared enterprise shell.
export function AppShell({children}:{children:ReactNode}){return <AuthProvider><div className="flex min-h-full min-w-0 flex-col"><Header onMenu={()=>{document.querySelector<HTMLButtonElement>('[data-tour="sidebar"] button[aria-expanded]')?.click();}}/><main className="w-full min-w-0 flex-1 px-4 py-5 lg:px-6">{children}</main><Footer/></div></AuthProvider>;}
