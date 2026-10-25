import {createRequest as configuredRequest} from '@pepbits/platform/http';
export {readJson,ApiFailure,RequestContext,useRequest,type Request} from '@pepbits/platform/http';
/** Session, preferences and localization use the shared demo API product. */
export const API_PRODUCT = 'nexora';
export const createRequest = (apiBaseUrl:string) => configuredRequest(apiBaseUrl,API_PRODUCT);
