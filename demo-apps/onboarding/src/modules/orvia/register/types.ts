import type {WizardErrors} from '@pepbits/patterns/wizard';
import type {RegistrationData, StepId} from '../registration';

export type SetData = (fn: (data: RegistrationData) => RegistrationData) => void;
export interface StepProps {data: RegistrationData; errors: WizardErrors; setData: SetData; onJump?: (id: StepId) => void}
export function toggle<T>(list: T[], item: T): T[] {return list.includes(item) ? list.filter(value => value !== item) : [...list, item];}
