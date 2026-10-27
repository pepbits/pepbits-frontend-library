'use client';
import React from 'react';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import {PAGE} from '../routes';
import {StartVisit} from './StartVisit';
import {EmergencyRegistration} from './EmergencyRegistration';

/** Front desk pages (Start a visit, Emergency registration), built on the shared @pepbits components. */
export function FrontDeskPage({page, target}: PageRenderContext) {
  return <div data-front-desk={page.id}>
    {page.id === PAGE.emergency ? <EmergencyRegistration/> : <StartVisit patient={target?.recordId}/>}
  </div>;
}
