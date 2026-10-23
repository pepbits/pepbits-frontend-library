export {ApiError,qs,useDiagnosticClient} from '../../diagnostics';
export const API_URL='/api';
export type Role = 'ADMIN'|'RECEPTION'|'PHLEBOTOMIST'|'TECHNOLOGIST'|'PATHOLOGIST';
export type {DiagnosticUser as SessionUser} from '../../diagnostics';
