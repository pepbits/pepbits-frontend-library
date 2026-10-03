export {ApiError,qs,useDiagnosticClient} from '@pepbits/reference-diagnostics';
export const API_URL='/api';
export interface Paged<T=any>{data:T[];total:number;page:number;pageSize:number;[key:string]:any}
