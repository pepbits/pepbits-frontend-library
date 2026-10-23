export const areas = [
 {id:'foundations',title:'Foundations',description:'Semantic tokens, typography, icons and localized values.'},
 {id:'ui',title:'UI primitives',description:'Controlled fields, choices, actions and loading states.'},
 {id:'components',title:'Components',description:'Presentation, data, editing, navigation and recovery.'},
 {id:'patterns',title:'Patterns',description:'Lifecycle, transfer, runtime fields, approvals, drafts and imports.'},
 {id:'page-engines',title:'Page engines',description:'Typed worklists, records, forms, templates and renderer registration.'},
 {id:'playground',title:'Preferences and policy',description:'Change effective settings and simulate tenant restrictions.'},
 {id:'shell',title:'Shell',description:'Pending phase 5 part 2 after merging with main.'},
 {id:'ai',title:'AI',description:'Pending phase 5b after merging with main. AI is disabled.'},
] as const;
export type AreaId = typeof areas[number]['id'];
