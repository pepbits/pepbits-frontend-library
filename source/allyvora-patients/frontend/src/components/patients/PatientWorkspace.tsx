'use client';

import { useSearchParams } from 'next/navigation';
import { SECTION_IDS, type SectionId } from '@allyvora/shared';
import { useApp } from '@/lib/app-context';
import { EditorSkeleton, PatientEditor } from './PatientEditor';
import { PatientList } from './PatientList';
import { PatientView } from './PatientView';

/** One page, four modes: register (list), new, edit and view. */
export function PatientWorkspace() {
  const params = useSearchParams();
  const { ready } = useApp();
  const mode = params.get('mode');
  const id = Number(params.get('id'));
  const sectionParam = params.get('section') as SectionId | null;
  const section = sectionParam && SECTION_IDS.includes(sectionParam) ? sectionParam : undefined;
  const validId = Number.isInteger(id) && id > 0;

  if (!ready) return <EditorSkeleton />;
  if (mode === 'new') return <PatientEditor key="new" mode="new" section={section} />;
  if (mode === 'edit' && validId) return <PatientEditor key={`edit-${id}`} mode="edit" id={id} section={section} />;
  if (mode === 'view' && validId) return <PatientView key={id} id={id} />;
  return <PatientList />;
}
