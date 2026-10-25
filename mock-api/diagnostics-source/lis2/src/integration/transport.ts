import * as net from 'net';
import { Logger } from '@nestjs/common';
import { ACK, ENQ, EOT, ETB, ETX, LF, MLLP_END, MLLP_START, NAK, STX, astmChecksum, frameASTM, frameMLLP } from './codecs';

const log = new Logger('Transport');

/* ─────────────── MLLP (HL7 over TCP) ─────────────── */
export function startMllpServer(port: number, handler: (raw: string, remote: string) => Promise<string>) {
  const server = net.createServer((socket) => {
    const remote = `${socket.remoteAddress}:${socket.remotePort}`;
    let buf = '';
    socket.setEncoding('utf8');
    socket.on('data', async (chunk: string) => {
      buf += chunk;
      let end: number;
      while ((end = buf.indexOf(MLLP_END)) >= 0) {
        const start = buf.indexOf(MLLP_START);
        const msg = buf.slice(start >= 0 && start < end ? start + 1 : 0, end);
        buf = buf.slice(end + MLLP_END.length);
        try {
          socket.write(frameMLLP(await handler(msg, remote)));
        } catch (e: any) {
          log.error(`MLLP handler failed: ${e.message}`);
        }
      }
    });
    socket.on('error', (e) => log.warn(`MLLP ${remote}: ${e.message}`));
  });
  server.on('error', (e) => log.error(`MLLP listener on ${port} failed: ${e.message}`));
  server.listen(port, () => log.log(`HL7 MLLP listener on tcp/${port}`));
  return server;
}

export function sendMLLP(host: string, port: number, message: string, timeoutMs = 15000): Promise<string> {
  if (process.env.DIAGNOSTICS_EMBEDDED === '1') throw new Error('External transport is disabled in the reference host; configure a reviewed provider adapter.');
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    let buf = '';
    const timer = setTimeout(() => { socket.destroy(); reject(new Error(`No ACK from ${host}:${port} within ${timeoutMs} ms`)); }, timeoutMs);
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.write(frameMLLP(message)));
    socket.on('data', (d: string) => {
      buf += d;
      const end = buf.indexOf(MLLP_END);
      if (end >= 0) {
        clearTimeout(timer);
        socket.end();
        resolve(buf.slice(buf.indexOf(MLLP_START) + 1, end));
      }
    });
    socket.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

/* ─────────────── ASTM E1381 low-level protocol ─────────────── */
class ByteWaiter {
  private queue: string[] = [];
  private waiters: ((c: string) => void)[] = [];
  push(c: string) { const w = this.waiters.shift(); if (w) w(c); else this.queue.push(c); }
  next(timeoutMs = 15000): Promise<string> {
    const q = this.queue.shift();
    if (q !== undefined) return Promise.resolve(q);
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('ASTM peer did not respond')), timeoutMs);
      this.waiters.push((c) => { clearTimeout(t); res(c); });
    });
  }
}

async function astmTransmit(socket: net.Socket, waiter: ByteWaiter, message: string) {
  socket.write(ENQ);
  if ((await waiter.next()) !== ACK) throw new Error('ASTM peer refused ENQ');
  for (const frame of frameASTM(message)) {
    let ok = false;
    for (let attempt = 0; attempt < 6 && !ok; attempt++) {
      socket.write(frame);
      const r = await waiter.next();
      if (r === ACK) ok = true;
      else if (r === EOT) break;
    }
    if (!ok) { socket.write(EOT); throw new Error('ASTM frame not acknowledged'); }
  }
  socket.write(EOT);
}

export function startAstmServer(port: number, handler: (raw: string, remote: string) => Promise<string | null>) {
  const server = net.createServer((socket) => {
    const remote = `${socket.remoteAddress}:${socket.remotePort}`;
    const waiter = new ByteWaiter();
    let receiving = false;
    let sending = false;
    let frameBuf = '';
    let message = '';
    socket.setEncoding('latin1');
    socket.on('data', async (chunk: string) => {
      for (const ch of chunk) {
        if (sending) { waiter.push(ch); continue; }
        if (!receiving) {
          if (ch === ENQ) { receiving = true; message = ''; socket.write(ACK); }
          continue;
        }
        if (ch === EOT && !frameBuf) {
          receiving = false;
          const text = message;
          try {
            const reply = await handler(text, remote);
            if (reply) { sending = true; await astmTransmit(socket, waiter, reply).catch((e) => log.warn(`ASTM reply failed: ${e.message}`)); sending = false; }
          } catch (e: any) { log.error(`ASTM handler failed: ${e.message}`); }
          continue;
        }
        frameBuf += ch;
        if (frameBuf.startsWith(STX) && frameBuf.endsWith(LF)) {
          const end = Math.max(frameBuf.indexOf(ETX), frameBuf.indexOf(ETB));
          const body = frameBuf.slice(1, end + 1);
          const given = frameBuf.slice(end + 1, end + 3);
          if (end > 0 && astmChecksum(body) === given.toUpperCase()) {
            message += body.slice(1, -1).replace(/\r$/, frameBuf.includes(ETX) ? '\r' : '');
            socket.write(ACK);
          } else socket.write(NAK);
          frameBuf = '';
        } else if (!frameBuf.startsWith(STX)) frameBuf = '';
      }
    });
    socket.on('error', (e) => log.warn(`ASTM ${remote}: ${e.message}`));
  });
  server.on('error', (e) => log.error(`ASTM listener on ${port} failed: ${e.message}`));
  server.listen(port, () => log.log(`ASTM E1381 listener on tcp/${port}`));
  return server;
}

export function sendASTM(host: string, port: number, message: string): Promise<void> {
  if (process.env.DIAGNOSTICS_EMBEDDED === '1') throw new Error('External transport is disabled in the reference host; configure a reviewed provider adapter.');
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    const waiter = new ByteWaiter();
    socket.setEncoding('latin1');
    socket.on('data', (d: string) => { for (const c of d) waiter.push(c); });
    socket.on('error', reject);
    socket.on('connect', () => astmTransmit(socket, waiter, message).then(() => { socket.end(); resolve(); }, (e) => { socket.destroy(); reject(e); }));
  });
}

/* ─────────────── HTTPS push ─────────────── */
export async function httpPost(url: string, body: string, contentType: string, authType?: string | null, secret?: string | null) {
  if (process.env.DIAGNOSTICS_EMBEDDED === '1') throw new Error('External transport is disabled in the reference host; configure a reviewed provider adapter.');
  const headers: Record<string, string> = { 'Content-Type': contentType };
  if (authType === 'API_KEY' && secret) headers['x-api-key'] = secret;
  if (authType === 'BEARER' && secret) headers.Authorization = `Bearer ${secret}`;
  if (authType === 'BASIC' && secret) headers.Authorization = `Basic ${Buffer.from(secret).toString('base64')}`;
  const res = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(20000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  return text;
}
