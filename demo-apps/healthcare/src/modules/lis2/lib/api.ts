export {ApiError,qs,useDiagnosticClient} from '../../diagnostics';
export const API_URL='/api';
export interface Paged<T=any>{data:T[];total:number;page:number;pageSize:number;[key:string]:any}
