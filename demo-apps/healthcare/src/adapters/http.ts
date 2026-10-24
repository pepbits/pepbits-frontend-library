import {createRequest as configuredRequest} from '@pepbits/platform/http';
export {readJson,ApiFailure,RequestContext,useRequest,type Request} from '@pepbits/platform/http';
export const API_PRODUCT = 'nexora';
export const createRequest = (apiBaseUrl:string) => configuredRequest(apiBaseUrl,API_PRODUCT);
