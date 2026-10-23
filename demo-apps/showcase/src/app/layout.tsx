import React from 'react';
import type {Metadata} from 'next';
import {ClientHost} from './client';
import './globals.css';
export const metadata:Metadata={title:'Showcase · Library examples',description:'Fictional, local examples of the Pepbits frontend library.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body><ClientHost>{children}</ClientHost></body></html>;}
