/** Shapes of the source demo backend's /meta and /dashboard responses. Identifiers and business values are never translated. */
export interface User { id: string; name: string; role: string; initials: string }
export interface Meta {
  settings: Record<string, string>;
  /** The authenticated host user plus the trusted source actor directory rows the history and ledger refer to. */
  users: User[];
  /** The signed-in host user, as the server maps them onto a source actor. */
  currentUser?: User;
  payers: { id: string; name: string; code: string; workflow: string }[];
  doctors: { id: string; name: string; specialty: string; facility: string }[];
}

export interface Dashboard {
  queues: Record<string, number>;
  kpi: { rx_received: number; rx_handed_over: number; turnaround_min: number; sales_today: number; collected_today: number; otc_today: number; orders_open: number; orders_new: number; auth_pending: number; returns_today: number };
  rcm: { drafts: { n: number; v: number }; rejected: { n: number; v: number }; outstanding: { n: number; v: number }; unposted_ra: { n: number; v: number }; denial_rate: number; collected_30d: number };
  stock: { low: number; near_expiry: { n: number; v: number }; expired: { n: number; v: number }; quarantined: number; value: number };
  hours: { hour: number; received: number; handed_over: number }[];
  trend: { day: string; rx: number; otc: number }[];
  activity: { id: number; entity: string; entity_id: string; ref: string; from_status: string | null; to_status: string; note: string | null; actor: string; actor_name: string | null; at: string }[];
  urgent: { id: string; rx_no: string; priority: string; received_at: string; status: string; patient_name: string }[];
}
