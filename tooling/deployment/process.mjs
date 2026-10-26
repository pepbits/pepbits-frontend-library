import {smokeAllyVoraProxy} from './allyvora-smoke.mjs';
import {demos,hostApiVariable} from "../services.mjs";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

export function run(command, args, { signal, ...options } = {}) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", detached: process.platform !== "win32", ...options });
    const abort = () => {
      try { process.platform === "win32" ? child.kill("SIGTERM") : process.kill(-child.pid, "SIGTERM"); } catch { /* already exited */ }
    };
    signal?.addEventListener("abort", abort, { once: true });
    child.on("error", reject);
    child.on("close", (code) => {
      signal?.removeEventListener("abort", abort);
      if (signal?.aborted) reject(signal.reason);
      else if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}.`));
    });
  });
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export async function waitForShell(base, { signal, alive = () => true, releaseId, attempts = 80, retryMs = 250 } = {}) {
  let last;
  for (let attempt = 0; attempt < attempts; attempt++) {
    signal?.throwIfAborted();
    if (!alive()) throw new Error(`${base}: server exited before becoming healthy.`);
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(1500) });
      if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      if(/<p[^>]*role="alert"[^>]*>Set (?:NEXT_PUBLIC|VITE)_/.test(html))throw Error("The demo is missing its build-time API configuration.");
      if (releaseId) {
        const identity = await fetch(new URL("/__nexora-release.json", base), { signal: AbortSignal.timeout(1500), cache: "no-store" });
        if (identity.status !== 200 || (await identity.json()).id !== releaseId) throw new Error("The port is answering from a different release.");
      }
      const assets = [...html.matchAll(/(?:src|href)="(\/(?:_next\/static|assets)\/[^"<>]+)"/g)].map((match) => match[1].replaceAll("&amp;", "&"));
      if (!assets.length) throw new Error("HTML has no application assets.");
      for (const asset of new Set(assets)) {
        const file = await fetch(new URL(asset, base), { signal: AbortSignal.timeout(3000) });
        if (file.status !== 200 || file.headers.get("content-type")?.includes("text/html")) throw new Error(`Missing application asset: ${asset}`);
        await file.arrayBuffer();
      }
      return;
    } catch (error) { last = error; }
    await delay(retryMs, undefined, { signal });
  }
  throw new Error(`${base}: health check failed (${last?.message}).`);
}

export async function smokeRelease(release, signal, apiUrl, allyvoraUrl) {
  const { id: releaseId } = JSON.parse(await readFile(join(release, "release.json"), "utf8"));
  for (const service of Object.keys(demos)) {
    const port = await freePort();
    const args = [join(release,"start-demo.mjs"),service];
    const child = spawn(process.execPath, args, {
      cwd: release,
      detached: true,
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: String(port), NODE_PATH: "", NODE_OPTIONS: "", ...(allyvoraUrl?{ALLYVORA_API_URL:allyvoraUrl}:{}), ...(apiUrl?{[hostApiVariable(service)]:apiUrl}:{}) },
    });
    let exited = false;
    const closed = new Promise((resolve) => {
      child.once("error", () => { exited = true; resolve(); });
      child.once("close", () => { exited = true; resolve(); });
    });
    try {
      await waitForShell(`http://127.0.0.1:${port}/`, { signal, alive: () => !exited, releaseId });
      if(apiUrl&&!['showcase','desktop'].includes(service)){
        const response=await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(3000)});
        if(!response.ok||(await response.json()).ok!==true)throw Error(`${service}: packaged host API proxy failed`);
      }
      if(allyvoraUrl&&['healthcare','allyvora-patients'].includes(service))await smokeAllyVoraProxy(`http://127.0.0.1:${port}`);
      console.log(`  ${service}: packaged HTML and assets passed on an isolated port.`);
    } finally {
      const kill=signal=>{try{process.kill(-child.pid,signal);}catch{}};
      kill("SIGTERM");
      const timer = setTimeout(() => kill("SIGKILL"), 3000);
      await closed;
      clearTimeout(timer);
      kill("SIGKILL");
    }
  }
}
