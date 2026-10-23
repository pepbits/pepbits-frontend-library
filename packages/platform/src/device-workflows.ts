import type {IntegrationAdapter, IntegrationCommand, IntegrationJob} from '@pepbits/data/device-integrations';
import type {IdentityAdapter, IdentityCommand, IdentityAttempt} from '@pepbits/data/identity-devices';
import type {DeviceConnector, DeviceTicket, DeviceAcknowledgement, IdentityDeviceConnector, IdentityCaptureTicket, IdentityCaptureResult} from './devices';

/** The authenticated host issues tickets and records acknowledgements. No device URL or driver lives here. */
export function withDeviceConnector(adapter:IntegrationAdapter, host:{
 connector:DeviceConnector;
 ticket(job:IntegrationJob,command:IntegrationCommand):Promise<DeviceTicket|null>;
 acknowledge(job:IntegrationJob,result:DeviceAcknowledgement,command:IntegrationCommand):Promise<IntegrationJob>;
}):IntegrationAdapter {
 return {library:station=>adapter.library(station),async command<T>(command:IntegrationCommand):Promise<T>{
  const value=await adapter.command<T>(command);
  if(command.action!=='dispatch')return value;
  const job=value as IntegrationJob,ticket=await host.ticket(job,command);
  if(!ticket)return value;
  if(ticket.jobId!==job.id||ticket.deviceId!==job.deviceId)throw new Error('Device ticket does not match the job');
  return await host.acknowledge(job,await host.connector.submit(ticket),command) as T;
 }};
}

/** Capture is an opaque assertion; the backend verifies identity, expiry, consent and provider signatures. */
export function withIdentityConnector(adapter:IdentityAdapter,host:{
 connector:IdentityDeviceConnector;
 ticket(attempt:IdentityAttempt,command:IdentityCommand):Promise<IdentityCaptureTicket|null>;
 verify(attempt:IdentityAttempt,result:IdentityCaptureResult,command:IdentityCommand):Promise<IdentityAttempt>;
}):IdentityAdapter {
 return {library:station=>adapter.library(station),async command<T>(command:IdentityCommand):Promise<T>{
  const value=await adapter.command<T>(command);
  if(command.action!=='start')return value;
  const attempt=value as IdentityAttempt,ticket=await host.ticket(attempt,command);
  if(!ticket)return value;
  if(ticket.challengeId!==attempt.id||ticket.subjectReference!==attempt.subjectId||ticket.deviceId!==attempt.deviceId)throw new Error('Identity ticket does not match the request');
  return await host.verify(attempt,await host.connector.capture(ticket),command) as T;
 }};
}
