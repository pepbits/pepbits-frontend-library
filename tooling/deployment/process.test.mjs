import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { waitForShell } from "./process.mjs";

async function fixture(t, { id = "candidate", assetStatus = 200, assetType = "text/javascript" } = {}) {
  const server = createServer((req, res) => {
    if (req.url === "/__nexora-release.json") {
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ id }));
    } else if (req.url === "/assets/app.js") {
      res.writeHead(assetStatus, { "Content-Type": assetType }); res.end("asset");
    } else {
      res.setHeader("Content-Type", "text/html"); res.end('<script src="/assets/app.js"></script>');
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}/`;
}
const options = { releaseId: "candidate", attempts: 1, retryMs: 1 };

test("health requires the selected release, not merely any process answering 200", async (t) => {
  await waitForShell(await fixture(t), options);
  await assert.rejects(waitForShell(await fixture(t, { id: "old" }), options), /different release/);
});

test("healthy HTML with a missing script is not a healthy deployment", async (t) => {
  await assert.rejects(waitForShell(await fixture(t, { assetStatus: 404 }), options), /Missing application asset/);
});

test("an SPA fallback returning HTML for a script cannot pass health", async (t) => {
  await assert.rejects(waitForShell(await fixture(t, { assetType: "text/html" }), options), /Missing application asset/);
});
