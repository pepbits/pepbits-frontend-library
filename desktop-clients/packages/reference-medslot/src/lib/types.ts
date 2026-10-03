"use client";
export type Role = "admin" | "scheduler" | "provider";
export interface User { id: number; name: string; email: string; role: Role; resource_id: number | null }

export type Status = "requested" | "scheduled" | "confirmed" | "checked_in" | "in_progress" | "completed" | "cancelled" | "no_show" | "rescheduled";
export type Category = "consultation" | "lab" | "radiology" | "dental" | "surgery" | "pharmacy" | "therapy" | "procedure" | "vaccination" | "telehealth" | "admission";
export type Channel = "email" | "sms" | "whatsapp";

export interface Specialty { id: number; department_id: number; name: string; active: boolean; department_name?: string }
export interface Department {
  id: number; name: string; code: string; description: string | null; color: string; location: string | null; active: boolean;
  resource_count: number; service_count: number; specialties: Specialty[];
}
export interface ResourceType { id: number; name: string; category: "person" | "room" | "bed" | "chair" | "equipment" | "other"; default_slot_minutes: number; icon: string; resource_count: number }
export interface Resource {
  id: number; name: string; title: string | null; resource_type_id: number; department_id: number; specialty_id: number | null;
  slot_minutes: number; capacity: number; location: string | null; description: string | null; color: string | null;
  online_booking: boolean; active: boolean; type_name: string; category: ResourceType["category"]; department_name: string;
  department_color: string; specialty_name: string | null; schedule_count: number;
}
export interface ScheduleRow { id?: number; weekday: number; start_time: string; end_time: string; slot_minutes?: number | null; effective_from?: string | null; effective_to?: string | null }
export interface Block { id: number; resource_id: number; start_at: string; end_at: string; kind: "leave" | "maintenance" | "meeting" | "blocked"; reason: string | null }
export interface ResourceDetail extends Resource {
  schedules: ScheduleRow[]; blocks: Block[]; services: { id: number; name: string; category: Category; duration_minutes: number }[];
}
export interface Service {
  id: number; name: string; code: string; category: Category; department_id: number; specialty_id: number | null;
  duration_minutes: number; buffer_minutes: number; prep_instructions: string | null; requires_order: boolean; requires_referral: boolean;
  online_booking: boolean; price: number | null; active: boolean; department_name: string; department_color: string;
  specialty_name: string | null; resource_count: number; needs: string | null;
}
export interface ServiceDetail extends Service {
  requirements: { resource_type_id: number; role: string; is_primary: boolean; type_name: string }[];
  resources: { id: number; name: string; title: string | null; resource_type_id: number; type_name: string }[];
}
export interface Patient {
  id: number; mrn: string; first_name: string; last_name: string; dob: string | null; sex: "female" | "male" | "other" | "unknown" | null;
  phone: string; phone_masked?: string; email: string | null; is_provisional: boolean; sms_opt_in: boolean; email_opt_in: boolean; whatsapp_opt_in: boolean;
  address?: string | null; city?: string | null; postal_code?: string | null; preferred_language?: string | null;
  insurance_provider?: string | null; insurance_member_id?: string | null; emergency_contact_name?: string | null; emergency_contact_phone?: string | null;
  last_visit?: string | null; next_visit?: string | null; created_at: string; consent_at?: string | null;
}
export interface AppointmentResource { id: number; name: string; role: string; type_name: string }
export interface Appointment {
  id: number; ref_code: string; patient_id: number; service_id: number; department_id: number; start_at: string; end_at: string;
  status: Status; patient_kind: "new" | "existing"; visit_type: string; priority: "routine" | "urgent" | "emergency"; source: string;
  reason: string; notes: string | null; referral_source: string | null; order_ref: string | null; requested_at: string; preferred_at: string | null;
  confirmed_at: string | null; checked_in_at: string | null; started_at: string | null; completed_at: string | null; cancelled_at: string | null;
  cancel_reason: string | null; no_show_at: string | null; rescheduled_from_id: number | null; rescheduled_to_id: number | null; notify_channels: string;
  first_name: string; last_name: string; mrn: string; phone: string; is_provisional: boolean; dob: string | null; sex: string | null;
  service_name: string; service_category: Category; department_name: string; department_color: string; booked_by_name: string | null;
  resources: AppointmentResource[]; allowed: Status[];
}
export interface AppointmentDetail extends Appointment {
  events: { id: number; from_status: Status | null; to_status: Status; note: string | null; user_name: string | null; created_at: string }[];
  notifications: { id: number; event: string; channel: Channel; status: string; error: string | null; created_at: string; sent_at: string | null }[];
}
export interface Slot { start: string; end: string; occupied_until: string; resources: AppointmentResource[] }
export interface Availability {
  service: { id: number; name: string; duration_minutes: number; buffer_minutes: number; department_name: string };
  duration_minutes: number; now: string;
  requirements: { resource_type_id: number; role: string; type_name: string; is_primary: number; candidates: { id: number; name: string; slot_minutes: number }[] }[];
  days: { date: string; closed: string | null; slots: Slot[] }[];
}
export interface Template {
  id: number; event: string; channel: Channel; scope_type: "global" | "department" | "specialty" | "resource_type" | "resource";
  scope_id: number; scope_name: string; subject: string | null; body: string; active: boolean; updated_at: string;
}
