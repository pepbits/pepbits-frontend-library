'use client';
import React from 'react';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import {PAGE, type AllyVoraTarget} from './routes';
import {PatientList} from './patients/PatientList';
import {PatientEditor} from './patients/PatientEditor';
import {PatientView} from './patients/PatientView';

/** Patients pages: dedicated register, create, edit and view pages. */
export function PatientsPage({page, target}: PageRenderContext) {
  const current = (target ?? {pageId: page.id}) as AllyVoraTarget;
  const id = Number(current.recordId);
  if (page.id === PAGE.create || current.mode === 'new') return <PatientEditor key="new" mode="new" section={current.section}/>;
  if ((page.id === PAGE.edit || current.mode === 'edit') && id > 0) return <PatientEditor key={`edit-${id}`} mode="edit" id={id} section={current.section}/>;
  if ((page.id === PAGE.view || current.mode === 'view') && id > 0) return <PatientView key={id} id={id}/>;
  return <PatientList query={current.query ?? ''}/>;
}
