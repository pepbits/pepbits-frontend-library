'use client';
import React, {useEffect, useMemo, useState} from 'react';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import {useNavigation} from '@pepbits/platform/navigation';
import {ClinicalProvider, IntakeForm, IntakeQueue, OUTPATIENT_INTAKE, type ClinicalActor} from '@pepbits/clinical';
import {useRequest} from '../../adapters/http';
import {allyVoraClinicalPort} from './adapter';
import {PAGE} from './routes';

/** AllyVora outpatient pages on the shared @pepbits/clinical components; the AllyVora workspace API supplies the data. */
export function OutpatientPage({page, target}: PageRenderContext) {
  const navigation = useNavigation();
  const request = useRequest();
  const {port, loadActor} = useMemo(() => allyVoraClinicalPort(request), [request]);
  const [actor, setActor] = useState<ClinicalActor | null>(null);
  useEffect(() => { let active = true; void loadActor().then(me => { if (active) setActor(me); }); return () => { active = false; }; }, [loadActor]);
  const toQueue = () => navigation.open({pageId: PAGE.intake});
  return <ClinicalProvider port={port} actor={actor}>
    <div data-outpatient={page.id}>
      {page.id === PAGE.intakeForm && target?.recordId
        ? <IntakeForm encounterId={target.recordId} profile={OUTPATIENT_INTAKE} onSaved={toQueue} onCancel={toQueue}/>
        : <IntakeQueue profile={OUTPATIENT_INTAKE} onOpenIntake={row => navigation.open({pageId: PAGE.intakeForm, recordId: row.id})}/>}
    </div>
  </ClinicalProvider>;
}
