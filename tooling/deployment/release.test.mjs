import {demos} from "../services.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activateRelease, currentRelease, packageRelease, selectRelease, snapshotWorkspace, validateConfig, verifyBuild } from "./release.mjs";
import { createDesktopServer } from "./desktop-server.mjs";

const config = { webApiUrl: "https://api.example.test", desktopApiUrl: "/api" };
async function temporary(t) {
  const root = await mkdtemp(join(tmpdir(), "nexora-deployment-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
async function file(path, content = "fixture") {
  const { dirname } = await import("node:path");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}
async function release(root, id) {
  const path = join(root, "releases", id);
  await file(join(path, "release.json"), JSON.stringify({ id, ...config }));
  for(const demo of Object.keys(demos).filter(d=>d!=="desktop"))await file(join(path,"demos",demo,"demo-apps",demo,"server.js"));
  await file(join(path,"start-demo.mjs"));
  await file(join(path, "desktop/index.html"));
  await file(join(path, "desktop-server.mjs"));
  return path;
}

test("deployment requires explicit API URLs and rejects accidental loopback builds", () => {
  assert.throws(() => validateConfig({}), /explicitly/);
  for (const api of ["http://localhost:3200", "http://127.0.0.1:3200", "http://127.12.0.1:3200", "http://[::1]:3200", "http://0.0.0.0:3200"]) {
    assert.throws(() => validateConfig({ ...config, webApiUrl: api }), /visitor/);
    assert.equal(validateConfig({ ...config, webApiUrl: api, allowLocalApi: true }).webApiUrl, api);
  }
  for (const api of ["file:///tmp/api", "//remote.test", "https://user:secret@api.test", "https://api.test?query=1", "/api?query=1", "/api#hash"]) {
    assert.throws(() => validateConfig({ ...config, webApiUrl: api }));
  }
  assert.equal(validateConfig(config).desktopApiUrl, "/api");
});

test("build verification refuses missing stamps, mismatches, and incomplete artifacts", async (t) => {
  const root = await temporary(t);
  await assert.rejects(verifyBuild(root, config), /BUILD_API/);
  await file(join(root, "demo-apps/showcase/.next/BUILD_API"), "http://localhost:3200");
  await assert.rejects(verifyBuild(root, config), /mismatched/);
  await file(join(root, "demo-apps/showcase/.next/BUILD_API"), config.webApiUrl);
  await file(join(root, "demo-apps/desktop/dist/BUILD_API"), config.desktopApiUrl);
  await assert.rejects(verifyBuild(root, config), /ENOENT/);
});

test("source snapshots exclude secrets, build output, dependency trees, and references", async (t) => {
  const root = await temporary(t), source = join(root, "source"), target = join(root, "snapshot");
  for (const name of ["package.json", "demo-apps/showcase/src/app/page.tsx", "demo-apps/showcase/.env.local", "deploy.config.json", "demo-apps/showcase/.next/server.js", "node_modules/runtime.js", "source/reference/src.ts", "demo-apps/desktop/src-tauri/target/binary"]) await file(join(source, name));
  await snapshotWorkspace(source, target);
  assert.equal(await readFile(join(target, "demo-apps/showcase/src/app/page.tsx"), "utf8"), "fixture");
  for (const name of ["demo-apps/showcase/.env.local", "deploy.config.json", "demo-apps/showcase/.next", "node_modules", "source", "demo-apps/desktop/src-tauri/target"]) {
    await assert.rejects(stat(join(target, name)), { code: "ENOENT" });
  }
});

test("packaging survives deletion of its build tree and includes static/public assets", async (t) => {
  const root = await temporary(t), build = join(root, "build"), output = join(root, "release");
  await file(join(build, "demo-apps/showcase/.next/BUILD_API"), config.webApiUrl);
  await file(join(build, "demo-apps/desktop/dist/BUILD_API"), config.desktopApiUrl);
  await file(join(build, "demo-apps/showcase/.next/standalone/demo-apps/showcase/server.js"));
  await file(join(build, "demo-apps/showcase/.next/standalone/demo-apps/showcase/.env.production"), "PRIVATE=fixture");
  await file(join(build, "demo-apps/showcase/.next/static/chunk.js"), "compiled");
  await file(join(build, "demo-apps/showcase/public/logo.svg"), "logo");
  await file(join(build, "demo-apps/desktop/dist/index.html"), "desktop");
  await file(join(build, "tooling/deployment/desktop-server.mjs"), "server");
  await file(join(build, "dependency.js"), "dependency");
  await symlink(join(build, "dependency.js"), join(build, "demo-apps/showcase/.next/standalone/dependency.js"));
  await file(join(build, "tooling/deployment/start-demo.mjs"), "server");
  for(const demo of Object.keys(demos).filter(d=>!['desktop','showcase'].includes(d))){
    await file(join(build,`demo-apps/${demo}/.next/BUILD_API`),config.webApiUrl);
    await file(join(build,`demo-apps/${demo}/.next/standalone/demo-apps/${demo}/server.js`));
    await file(join(build,`demo-apps/${demo}/.next/static/chunk.js`));
  }
  await packageRelease(build, output, config, "test");
  await assert.rejects(packageRelease(build,output,config,"test"),/EEXIST/);
  await rm(build, { recursive: true });
  assert.equal(await readFile(join(output, "demos/showcase/dependency.js"), "utf8"), "dependency");
  assert.equal(await readFile(join(output, "demos/showcase/demo-apps/showcase/.next/static/chunk.js"), "utf8"), "compiled");
  assert.equal(await readFile(join(output, "demos/showcase/demo-apps/showcase/public/logo.svg"), "utf8"), "logo");
  assert.equal(await readFile(join(output, "desktop/index.html"), "utf8"), "desktop");
  await assert.rejects(stat(join(output, "demos/showcase/demo-apps/showcase/.env.production")), { code: "ENOENT" });
});

test("activation selects a release only after stop and checks it after start", async (t) => {
  const root = await temporary(t), old = await release(root, "old"), next = await release(root, "next");
  await selectRelease(root, old);
  const events = [];
  const previous = await activateRelease(root, next, {
    stop: async () => { assert.equal(await currentRelease(root), old); events.push("stop"); },
    start: async () => { assert.equal(await currentRelease(root), next); events.push("start"); },
    health: async () => { events.push("health"); },
  });
  assert.equal(previous, old);
  assert.deepEqual(events, ["stop", "start", "health"]);
});

for (const failure of ["start", "health"]) test(`failed ${failure} restores and checks the previous release`, async (t) => {
  const root = await temporary(t), old = await release(root, "old"), next = await release(root, "next");
  await selectRelease(root, old);
  const events = [];
  const hooks = Object.fromEntries(["stop", "start", "health"].map((action) => [action, async () => {
    const current = await currentRelease(root);
    events.push([action, current]);
    if (current === next && action === failure) throw new Error("simulated failure");
  }]));
  await assert.rejects(activateRelease(root, next, hooks), /previous release was restored/);
  assert.equal(await currentRelease(root), old);
  assert.deepEqual(events.slice(-2), [["start", old], ["health", old]]);
});

test("failed first deployment removes its pointer and does not pretend to roll back", async (t) => {
  const root = await temporary(t), next = await release(root, "next");
  let starts = 0;
  await assert.rejects(activateRelease(root, next, { stop: async () => {}, start: async () => { starts++; throw new Error("bad start"); }, health: async () => {} }), /First activation failed/);
  assert.equal(await currentRelease(root), null);
  assert.equal(starts, 1);
});

test("desktop server serves SPA routes and assets without leaking files or hiding missing chunks", async (t) => {
  const root = await temporary(t), dist = join(root, "dist");
  await file(join(dist, "index.html"), "<html>application</html>");
  await file(join(dist, "assets/app-123.js"), "console.log('app')");
  await file(join(root, "private.txt"), "secret");
  await symlink(join(root, "private.txt"), join(dist, "escape.txt"));
  const server = await createDesktopServer(dist);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal(await (await fetch(base + "/finance/customer/1")).text(), "<html>application</html>");
  const asset = await fetch(base + "/assets/app-123.js");
  assert.match(asset.headers.get("content-type"), /javascript/);
  assert.match(asset.headers.get("cache-control"), /immutable/);
  assert.equal(await (await fetch(base + "/assets/app-123.js", { method: "HEAD" })).text(), "");
  for (const url of ["/assets/missing.js", "/escape.txt", "/%2e%2e%2fprivate.txt", "/.env"]) assert.equal((await fetch(base + url)).status, 404);
  assert.equal((await fetch(base + "/", { method: "POST" })).status, 405);
});

test("an interruption after start rolls back before reporting success", async (t) => {
  const root = await temporary(t), old = await release(root, "old"), next = await release(root, "next");
  await selectRelease(root, old);
  let interrupted = false;
  await assert.rejects(activateRelease(root, next, {
    stop: async () => {},
    start: async () => { if (await currentRelease(root) === next) interrupted = true; },
    check: () => { if (interrupted) throw new Error("interrupted"); },
    health: async () => {},
  }), /previous release was restored/);
  assert.equal(await currentRelease(root), old);
});

test("a partial stop failure attempts to restart the previous release", async (t) => {
  const root = await temporary(t), old = await release(root, "old"), next = await release(root, "next");
  await selectRelease(root, old);
  let stops = 0, starts = 0;
  await assert.rejects(activateRelease(root, next, {
    stop: async () => { if (++stops === 1) throw new Error("partial stop"); },
    start: async () => { starts++; },
    health: async () => {},
  }), /previous release was restored/);
  assert.equal(await currentRelease(root), old);
  assert.equal(starts, 1);
});
