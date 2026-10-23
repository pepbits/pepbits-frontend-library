import {createAuthedFetch, type SessionOptions} from '@pepbits/platform';
import {createAiAdmin} from './admin';
import {createAiPolicyClient} from './policy';
import {createAiTransport} from './transport';
import {assembleContext, type AiSources} from './assemble';
import {redactField, mustRedact, type AiClassification} from './redact';
import {unredactedFields} from './guard';
import type {AiContext, AiUseCase} from '../config';

export type AiRequest = (path: string, init?: RequestInit) => Promise<Response>;
export interface AiClientOptions extends SessionOptions {classificationFor: AiClassification}
/** One instance per host/session boundary. Endpoints and authentication come from platform. */
export function createAiClient(options: AiClientOptions) {
  return createAiClientWithRequest(createAuthedFetch(options), options.classificationFor);
}
/** For hosts with an existing authenticated server transport. */
export function createAiClientWithRequest(request: AiRequest, classificationFor: AiClassification) {
  return {
    ...createAiAdmin(request), ...createAiPolicyClient(request),
    dispatchAi: createAiTransport(request, classificationFor),
    assembleContext: (useCase: AiUseCase, pageId: string, sources: AiSources, userInput?: string) =>
      assembleContext(useCase, pageId, sources, userInput, classificationFor),
    redactField: (key: string, value: string) => redactField(key, value, classificationFor),
    mustRedact: (key: string) => mustRedact(key, classificationFor),
    unredactedFields: (context: AiContext) => unredactedFields(context, classificationFor),
  };
}
export type AiClient = ReturnType<typeof createAiClientWithRequest>;
