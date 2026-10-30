'use client';
import React, {useEffect, useMemo, useState} from 'react';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import {useNavigation} from '@pepbits/platform/navigation';
import {ClinicalProvider, EMERGENCY_TRIAGE, IntakeForm, TriageQueue, type ClinicalActor} from '@pepbits/healthcare/clinical';
import {useRequest} from '../../adapters/http';
import {allyVoraClinicalPort} from '../outpatient/adapter';
import {PAGE} from './routes';

/** AllyVora emergency triage on the shared @pepbits/healthcare/clinical components; the AllyVora workspace API supplies the data. */
export function EmergencyPage({page, target}: PageRenderContext) {
  const navigation = useNavigation();
  const request = useRequest();
  const {port, loadActor} = useMemo(() => allyVoraClinicalPort(request), [request]);
  const [actor, setActor] = useState<ClinicalActor | null>(null);
  useEffect(() => { let active = true; void loadActor().then(me => { if (active) setActor(me); }); return () => { active = false; }; }, [loadActor]);
  const toQueue = () => navigation.open({pageId: PAGE.triage});
  return <ClinicalProvider port={port} actor={actor}>
    <div data-emergency={page.id}>
      {page.id === PAGE.triageForm && target?.recordId
        ? <IntakeForm encounterId={target.recordId} profile={EMERGENCY_TRIAGE} onSaved={toQueue} onCancel={toQueue}/>
        : <TriageQueue profile={EMERGENCY_TRIAGE} onTriage={row => navigation.open({pageId: PAGE.triageForm, recordId: row.id})}/>}
    </div>
  </ClinicalProvider>;
}
