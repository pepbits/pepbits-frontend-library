'use client';
import React from 'react';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import {PAGE, type AllyVoraTarget} from '../../navigation';
import {PatientList} from './patients/PatientList';
import {PatientEditor} from './patients/PatientEditor';
import {PatientView} from './patients/PatientView';
import {LayoutSetup} from './settings/LayoutSetup';

/** Patients page: one route, four source modes (register, new, edit, view), selected by the target. */
export function PatientsPage({page, target}: PageRenderContext) {
  const current = (target ?? {pageId: page.id}) as AllyVoraTarget;
  const id = Number(current.recordId);
  if (page.id === PAGE.create || current.mode === 'new') return <PatientEditor key="new" mode="new" section={current.section}/>;
  if (current.mode === 'edit' && id > 0) return <PatientEditor key={`edit-${id}`} mode="edit" id={id} section={current.section}/>;
  if (current.mode === 'view' && id > 0) return <PatientView key={id} id={id}/>;
  return <PatientList query={current.query ?? ''}/>;
}
export function FormLayoutPage(_: PageRenderContext) {return <LayoutSetup/>;}
