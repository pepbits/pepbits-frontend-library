"use client";
import React from 'react';
import {useRouter,usePathname} from 'next/navigation';
import {DemoProviders} from '../providers';
import {AppFrame} from '../app-frame';
export function ClientHost({children}:{children:React.ReactNode}){const router=useRouter(),path=usePathname(),area=path.slice(1)||'foundations';return <DemoProviders area={area} navigate={router.push}><AppFrame area={area} navigate={router.push}>{children}</AppFrame></DemoProviders>;}
