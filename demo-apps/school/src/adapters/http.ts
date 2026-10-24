import {createRequest as configuredRequest} from '@pepbits/platform/http';
export {readJson,ApiFailure,RequestContext,useRequest,type Request} from '@pepbits/platform/http';
export const API_PRODUCT = 'nexora';
export const createRequest = (base:string) => configuredRequest(base,API_PRODUCT);
