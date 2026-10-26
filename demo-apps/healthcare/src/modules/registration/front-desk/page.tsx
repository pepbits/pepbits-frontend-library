'use client';
import React from 'react';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import {PAGE} from '../routes';
import {StartVisit} from './StartVisit';
import {EmergencyRegistration} from './EmergencyRegistration';

/**
 * Front desk pages copied from the AllyVora clinical workspace. `.allyvora-front-desk` scopes the
 * source's Tailwind theme (styles.css), so the copied markup keeps its classes unchanged.
 */
export function FrontDeskPage({page, target}: PageRenderContext) {
  return <div className="allyvora-front-desk" data-front-desk={page.id}>
    {page.id === PAGE.emergency ? <EmergencyRegistration/> : <StartVisit patient={target?.recordId}/>}
  </div>;
}
