import { Row } from '../../lib/types';

export interface Slot { start: string; end: string; status: 'free' | 'booked' | 'blocked' | 'past'; reason: string; appointment: Row | null }
export interface ResourceDay {
  id: string; name: string; resourceType: string; providerId: string; departmentId: string; departmentName: string;
  slotMinutes: number; free: number; booked: number; slots: Slot[];
}
export interface SlotBoardData { date: string; dayStart: string; dayEnd: string; resources: ResourceDay[] }
export interface PickedSlot { resource: ResourceDay; slot: Slot; date: string }

export const APPT_TONE: Record<string, string> = {
  Booked: 'border-hc-petrol-300 bg-hc-petrol-50 text-hc-petrol-800',
  Confirmed: 'border-hc-info-100 bg-hc-info-50 text-hc-info-700',
  Arrived: 'border-hc-ok-100 bg-hc-ok-50 text-hc-ok-700',
  'In Consultation': 'border-hc-petrol-500 bg-hc-petrol-100 text-hc-petrol-900',
  Completed: 'border-hc-line bg-hc-canvas text-hc-ink-mute',
  'No-show': 'border-hc-danger-100 bg-hc-danger-50 text-hc-danger-700',
};
