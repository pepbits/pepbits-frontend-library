import {createAiClientWithRequest} from '../client';
import {classificationFor} from './catalog';
const client=createAiClientWithRequest(async()=>{throw new Error('No test transport configured');},classificationFor);
export const {assembleContext,redactField,unredactedFields}=client;
export {contextSources} from '../client/assemble';
