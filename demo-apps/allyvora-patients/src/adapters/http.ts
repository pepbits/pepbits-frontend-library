import {createRequest as configuredRequest} from '@pepbits/platform/http';
export {readJson,ApiFailure,RequestContext,useRequest,type Request} from '@pepbits/platform/http';
/** The shared demo host API serves sign-in, preferences and catalogs under the existing product id. */
export const API_PRODUCT = 'nexora';
export const createRequest = (apiBaseUrl:string) => configuredRequest(apiBaseUrl,API_PRODUCT);
