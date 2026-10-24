import React from 'react';
import {Accessibility, Armchair, BedDouble, Building2, CalendarClock, FlaskConical, HeartPulse, Home, Hospital, Network, Pill, ScanLine, Scissors, Siren, Stethoscope, Store, TestTube, Video, type IconComponent} from '@pepbits/icons';
import type {IconName} from '../catalog';

const MAP: Record<IconName, IconComponent> = {
  hospital: Hospital, clinic: Stethoscope, pharmacy: Pill, lab: FlaskConical, radiology: ScanLine, homecare: Home, telehealth: Video, network: Network, single: Building2,
  opd: Stethoscope, ipd: BedDouble, er: Siren, daycare: CalendarClock, icu: HeartPulse, ot: Scissors, ltc: Armchair, rehab: Accessibility, retail: Store, collection: TestTube,
};
export function CatalogIcon({name, className = 'h-5 w-5'}: {name: IconName; className?: string}) {
  const Icon = MAP[name];
  return <Icon className={className} aria-hidden="true" strokeWidth={1.8}/>;
}
