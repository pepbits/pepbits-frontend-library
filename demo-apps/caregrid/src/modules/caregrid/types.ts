/** Wire shapes of the unchanged CareGrid scheduling API (fictional demonstration data). */
export interface Department {id: number; code: string; name: string; color: string}
export interface Category {id: number; name: string; icon: string; department_id: number; color: string; type_count: number; department_name: string}
export interface Role {code: string; label: string; kind: string; department_id: number; turnover_min: number; resource_count: number}
export interface Meta {today: string; now: string; departments: Department[]; categories: Category[]; roles: Role[]; kinds: string[]; exceptionTypes: string[]}
export type NoticeLevel = 'info' | 'success' | 'warning' | 'critical';
export interface Notice {id: number; created_at: string; level: NoticeLevel; category: string; title: string; body?: string | null; link?: string | null; read: number}
export interface Assignment {requirement_id: number; resource_id: number; resource_name: string; role_code: string; kind: string; start: string; end: string; hold_start: string; hold_end: string}
export interface Slot {start: string; end: string; assignments: Assignment[]; reserved?: string; score?: number}
export interface Requirement {roles: string[]; label: string; kind: string; offset: number; duration: number | null; primary?: number}
export interface ServiceType {
  id: number; name: string; category_id: number; category_name: string; category_icon: string; dept_color: string; duration_min: number; slot_step_min: number;
  min_notice_min: number; max_advance_days: number; window_start: number | null; window_end: number | null; prep_instructions: string | null; pattern: string;
  slot_model: string; setting?: string; mode?: string; recurring?: number; requires_consent?: number; travel_min?: number; notes?: string | null; active?: number;
  requirements: Requirement[];
}
export interface Availability {
  type: unknown; days: {date: string; slots: Slot[]; total: number}[]; firstAvailable: Slot | null;
  blockers: {role: string; label: string; count: number}[]; requirements: unknown[];
}
export interface Patient {
  id: number; mrn: string; full_name: string; gender?: string; dob?: string | null; phone?: string | null; email?: string | null; language?: string;
  interpreter_needed?: number; mobility?: string; allergies?: string | null; payer?: string; preferred_channel?: string; upcoming?: number; next_at?: string | null;
}
/** Day-list row (`GET /appointments`). */
export interface AppointmentRow {
  id: number; ref: string; start_at: string; end_at: string; status: string; priority: string; at_risk: number; checked_in_at: string | null; actual_start: string | null;
  actual_end: string | null; patient_id: number; patient_name: string; mrn: string; interpreter_needed: number; mobility: string | null; allergies: string | null;
  type_id: number; type_name: string; duration_min: number; category_icon: string; dept_color: string; primary_resource: string | null; department_name?: string;
}
export interface Reminder {id: number; channel: string; send_at: string; message: string; status: string; ref?: string; patient_name?: string}
export interface HeldResource {resource_id: number; resource_name: string; role_label: string; kind: string; start_at: string; end_at: string}
export interface AppointmentDetail extends AppointmentRow {
  type_id: number; phone?: string | null; language?: string; prep_instructions?: string | null; requires_consent?: number; notes?: string | null; cancel_reason?: string | null;
  resources: HeldResource[]; reminders: Reminder[]; queue?: {reason: string}[]; category_name?: string;
}
export interface QueueItem {id: number; appointment_id: number; reason: string; start_at: string; priority: string; patient_name: string; type_name: string; category_icon: string; planned: number}
export interface ScheduleWindow {start: string; end: string; tag: string}
export interface ScheduleHold {id: number; appointment_id: number; start_at: string; end_at: string; hold_start: string; hold_end: string; status: string; priority: string; at_risk: number; patient_name: string; type_name: string; color: string}
export interface ScheduleException {id: number; type: string; reason?: string | null; start: string; end: string}
export interface ScheduleResource {id: number; name: string; kind: string; role_code: string; role_label: string; department: string; color: string; capacity: number; windows: ScheduleWindow[]; exceptions: ScheduleException[]; holds: ScheduleHold[]}
export interface Schedule {date: string; holiday?: {name: string} | null; resources: ScheduleResource[]}
export interface ResourceRow {id: number; name: string; kind: string; role_label: string; department: string; department_id: number; exception_count: number; current_exception: string | null}
export interface Summary {
  total: number; counts: Record<string, number>; noShowRate: number; medianWait: number; queuePending: number; waitlist: number;
  hours: {hour: number; count: number}[]; mix: {name: string; icon: string; color: string; c: number}[];
  utilization: {kind: string; pct: number}[]; busiest: {id: number; name: string; kind: string; role_label: string; pct: number}[];
  next: {id: number; start_at: string; patient_name: string; type_name: string; icon: string; color: string; status: string; at_risk: number}[];
  exceptionsToday: {id: number; resource_name: string; type: string; start_at: string; end_at: string}[];
}
