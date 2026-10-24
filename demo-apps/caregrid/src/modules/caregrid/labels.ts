/** Source vocabulary. Values pass through the host translator; unmapped wording stays English. */
export const KIND_LABEL: Record<string, string> = {person: 'People', machine: 'Machines', room: 'Rooms', chair: 'Chairs', bed: 'Beds', vehicle: 'Vehicles'};
export const KIND_ONE: Record<string, string> = {person: 'Person', machine: 'Machine', room: 'Room', chair: 'Chair', bed: 'Bed', vehicle: 'Vehicle'};
/** Semantic fills replace the source's fixed kind colours, so themes apply and white labels keep contrast. */
export const KIND_TONE: Record<string, string> = {person: 'var(--primary-fill)', machine: 'color-mix(in srgb, var(--accent) 65%, black)', room: 'var(--success-fill)', chair: 'color-mix(in srgb, var(--warning) 55%, black)', bed: 'var(--danger-fill)', vehicle: 'color-mix(in srgb, var(--text-muted) 75%, black)'};
/** API department colours identify a service line; darkening keeps white event labels readable. */
export const shade = (color?: string | null) => color ? `color-mix(in srgb, ${color} 72%, black)` : 'var(--primary-fill)';
export const STATUS_LABEL: Record<string, string> = {booked: 'Booked', confirmed: 'Confirmed', checked_in: 'Arrived', in_progress: 'In session', completed: 'Completed', no_show: 'No-show', cancelled: 'Cancelled'};
export const STATUS_TONE: Record<string, 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'> = {booked: 'neutral', confirmed: 'success', checked_in: 'warning', in_progress: 'info', completed: 'neutral', no_show: 'danger', cancelled: 'neutral'};
export const EXCEPTION_LABEL: Record<string, string> = {leave: 'Leave', sick: 'Sick', training: 'Training', conference: 'Conference', maintenance: 'Maintenance', breakdown: 'Breakdown', calibration: 'Calibration', cleaning: 'Deep cleaning', other: 'Other'};
export const PATTERN_HINT: Record<string, string> = {
  'Single provider': 'Only the practitioner’s calendar decides',
  'Provider + equipment': 'Practitioner plus a device they need',
  'Machine-based': 'The machine’s calendar decides; staff are assigned to it',
  'Chair / bed / room-based': 'Capacity is the number of chairs, beds or rooms',
  'Team-based': 'Several people must be free at the same moment',
  'Team + machine': 'A room or machine plus a full team at once',
  'Multi-station (package)': 'A sequence of stops across departments',
};
export const SLOT_MODEL_LABEL: Record<string, string> = {fixed: 'Fixed slots', capacity: 'Capacity windows', block: 'Block booking', open: 'Open queue'};
export const OPEN_STATUSES = ['booked', 'confirmed'];
export const ACTION_LABEL: Record<string, string> = {confirm: 'Confirmed', check_in: 'Checked in', start: 'Session started', complete: 'Completed', no_show: 'Marked as no-show', undo: 'Status reset'};
