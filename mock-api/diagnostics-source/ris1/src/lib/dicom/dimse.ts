/* eslint-disable @typescript-eslint/no-var-requires */
import { instanceFilePath } from './ingest';

type Dest = { host: string; port: number; aeTitle: string; callingAe?: string };

function lib() {
  return require('dcmjs-dimse');
}

export function cEcho(dest: Dest): Promise<{ ok: boolean; message: string }> {
  if (process.env.DIAGNOSTICS_EMBEDDED === '1') throw new Error('External transport is disabled in the reference host; configure a reviewed provider adapter.');
  const { Client, requests, constants } = lib();
  return new Promise((resolve) => {
    const client = new Client();
    const req = new requests.CEchoRequest();
    let done = false;
    const finish = (ok: boolean, message: string) => {
      if (!done) { done = true; resolve({ ok, message }); }
    };
    req.on('response', (res: any) => finish(res.getStatus() === constants.Status.Success, `C-ECHO status 0x${res.getStatus().toString(16)}`));
    client.on('networkError', (e: Error) => finish(false, `Network error: ${e.message}`));
    client.on('associationRejected', () => finish(false, 'Association rejected'));
    client.on('closed', () => finish(false, 'Connection closed without response'));
    client.addRequest(req);
    client.send(dest.host, dest.port, dest.callingAe || 'RADIANT_RIS', dest.aeTitle, { connectTimeout: 5000, associationTimeout: 5000 });
  });
}

/** Sends every instance (relative paths from the archive) to a remote Storage SCP. */
export function cStore(dest: Dest, relPaths: string[]): Promise<{ sent: number; failed: number; message: string }> {
  if (process.env.DIAGNOSTICS_EMBEDDED === '1') throw new Error('External transport is disabled in the reference host; configure a reviewed provider adapter.');
  const { Client, requests, constants } = lib();
  return new Promise((resolve) => {
    const client = new Client();
    let sent = 0, failed = 0, done = false;
    const finish = (message: string) => {
      if (!done) { done = true; resolve({ sent, failed, message }); }
    };
    for (const rel of relPaths) {
      const req = new requests.CStoreRequest(instanceFilePath(rel));
      req.on('response', (res: any) => (res.getStatus() === constants.Status.Success ? sent++ : failed++));
      client.addRequest(req);
    }
    client.on('networkError', (e: Error) => finish(`Network error: ${e.message}`));
    client.on('associationRejected', () => finish('Association rejected by remote AE'));
    client.on('closed', () => finish(failed ? `${failed} instance(s) rejected` : 'Completed'));
    client.send(dest.host, dest.port, dest.callingAe || 'RADIANT_RIS', dest.aeTitle, { connectTimeout: 8000, associationTimeout: 8000 });
  });
}
