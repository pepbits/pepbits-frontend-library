export const KIND_LABEL: Record<string, string> = { person: 'People', machine: 'Machines', room: 'Rooms', chair: 'Chairs', bed: 'Beds', vehicle: 'Vehicles' };
export const KIND_ONE: Record<string, string> = { person: 'Person', machine: 'Machine', room: 'Room', chair: 'Chair', bed: 'Bed', vehicle: 'Vehicle' };
export const KIND_COLOR: Record<string, string> = { person: '#3D7BD9', machine: '#8A5CD6', room: '#1F9E89', chair: '#D9822B', bed: '#C2508A', vehicle: '#5F6B7A' };
export const STATUS_LABEL: Record<string, string> = {
  booked: 'Booked', confirmed: 'Confirmed', checked_in: 'Arrived', in_progress: 'In session', completed: 'Completed', no_show: 'No-show', cancelled: 'Cancelled',
};
export const STATUS_STYLE: Record<string, string> = {
  booked: 'bg-ink-100 text-ink-700', confirmed: 'bg-teal-50 text-teal-700', checked_in: 'bg-marigold-50 text-marigold-700',
  in_progress: 'bg-[#E8EEFB] text-[#2C5FB0]', completed: 'bg-[#EEF2F2] text-muted', no_show: 'bg-crimson-50 text-crimson-700', cancelled: 'bg-[#F1F1F1] text-[#7A7A7A] line-through',
};
export const EXCEPTION_LABEL: Record<string, string> = {
  leave: 'Leave', sick: 'Sick', training: 'Training', conference: 'Conference', maintenance: 'Maintenance', breakdown: 'Breakdown',
  calibration: 'Calibration', cleaning: 'Deep cleaning', other: 'Other',
};
export const PATTERN_HINT: Record<string, string> = {
  'Single provider': 'Only the practitioner’s calendar decides',
  'Provider + equipment': 'Practitioner plus a device they need',
  'Machine-based': 'The machine’s calendar decides; staff are assigned to it',
  'Chair / bed / room-based': 'Capacity is the number of chairs, beds or rooms',
  'Team-based': 'Several people must be free at the same moment',
  'Team + machine': 'A room or machine plus a full team at once',
  'Multi-station (package)': 'A sequence of stops across departments',
};
export const SLOT_MODEL_LABEL: Record<string, string> = { fixed: 'Fixed slots', capacity: 'Capacity windows', block: 'Block booking', open: 'Open queue' };
