import {createRequest as configuredRequest} from '@pepbits/platform/http';
export {readJson, ApiFailure, RequestContext, useRequest, type Request} from '@pepbits/platform/http';
/** The unchanged demo API's product id for the generic finance/HR worklists and record store. */
export const API_PRODUCT = 'nexora';
export const createRequest = (apiBaseUrl: string) => configuredRequest(apiBaseUrl, API_PRODUCT);
