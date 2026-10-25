/** Whitelisted master tables and editable columns for the generic master-data API. */
export const MASTERS: Record<string, { table: string; columns: string[]; required: string[]; order: string }> = {
  modalities: { table: 'modalities', columns: ['code', 'name', 'ae_title', 'room', 'manufacturer', 'daily_capacity', 'active'], required: ['code', 'name'], order: 'code' },
  procedures: { table: 'procedures', columns: ['code', 'name', 'modality_code', 'body_part', 'cpt', 'price', 'duration_min', 'contrast', 'prep', 'active'], required: ['code', 'name', 'modality_code'], order: 'modality_code, name' },
  templates: { table: 'templates', columns: ['name', 'modality_code', 'body_part', 'kind', 'technique', 'findings', 'impression', 'active'], required: ['name'], order: 'kind DESC, modality_code, name' },
  tat_rules: { table: 'tat_rules', columns: ['priority', 'modality_code', 'target_minutes', 'warn_percent'], required: ['priority', 'target_minutes'], order: "CASE priority WHEN 'STAT' THEN 0 WHEN 'URGENT' THEN 1 ELSE 2 END, modality_code" },
  referrers: { table: 'referrers', columns: ['code', 'name', 'specialty', 'facility', 'phone', 'email', 'active'], required: ['name'], order: 'name' },
  users: { table: 'users', columns: ['username', 'name', 'role', 'title', 'license_no', 'modalities', 'signature', 'phone', 'active'], required: ['username', 'name', 'role'], order: 'role, name' },
  interfaces: { table: 'interfaces', columns: ['name', 'type', 'direction', 'host', 'port', 'url', 'ae_title', 'events', 'facility', 'active'], required: ['name', 'type'], order: 'direction, name' },
};
