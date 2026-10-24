import type {SessionValue} from '@pepbits/platform/auth';
export const fixtureUser = {id: 'fixture-admin', name: 'Fictional Administrator', email: 'fixture@example.test', initials: 'FA', title: 'Administrator', role: 'enterprise-admin', branch: 'head-office', tenantId: 'fictional-tenant'};
export const fixtureSession: SessionValue = {status: 'authenticated', user: fixtureUser, login: async () => null, logout: async () => {}};
export const analystSession: SessionValue = {...fixtureSession, user: {...fixtureUser, id: 'fixture-analyst', name: 'Fictional Analyst', title: 'Operations', role: 'operations-analyst'}};
