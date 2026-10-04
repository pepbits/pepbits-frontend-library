/**
 * The search leaves the browser as a POST body, never as a query string.
 *
 * The unit tests assert what `searchWorklist` builds. This asserts what the
 * browser actually sends, which is the only place the difference is real: a GET
 * would put a patient name in the request line, and the request line is what
 * nginx, the gateway, APM and every cloud log record.
 */
import { BASE, loadPlaywright, reporter, requireShell, signIn } from "./harness.mjs";

const NAME = "Atlas";
const { chromium } = loadPlaywright();
await requireShell(BASE);
const browser = await chromium.launch({ chromiumSandbox: false });
const { page, errors } = await signIn(browser, `${BASE}/finance/customer-master`);
const t = reporter("the search is a POST, and the URL stays clean");

const searches = [];
page.on("request", (request) => {
  if (request.url().includes("/worklists/search")) {
    searches.push({ method: request.method(), url: request.url(), body: request.postData() ?? "" });
  }
});

/* Type into the worklist's own keyword filter, then Apply. Confirm the page first, and keep
   evidence if it is not the one requested: the failure used to be a bare 30 s locator timeout. */
const field = page.locator('main input[placeholder*="keyword" i]').first();
try {
  await page.locator("header h1", { hasText: "Customer Master" }).first().waitFor({ timeout: 30000 });
  await field.waitFor({ timeout: 30000 });
} catch (error) {
  const shot = `${process.env.E2E_ARTIFACTS ?? "/tmp"}/search-post-not-ready.png`;
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  const heading = await page.locator("header h1").first().innerText().catch(() => "(none)");
  console.error(`  search-post: worklist not ready at ${page.url()} (heading ${JSON.stringify(heading)}); screenshot ${shot}`);
  throw error;
}
await field.fill(NAME);
await page.waitForTimeout(600);
const apply = page.getByRole("button", { name: /^apply$/i }).first();
t.say("the filter bar offers Apply", (await apply.count()) === 1);
await apply.click();
await page.waitForTimeout(2500);

t.say(`the search was sent (${searches.length})`, searches.length >= 1);
const sent = searches.at(-1);
if (sent) {
  t.say(`it is a POST (${sent.method})`, sent.method === "POST");
  t.say(`the URL carries no filter at all (${new URL(sent.url).search || "no query"})`, !new URL(sent.url).search);
  t.say("and no name in the URL", !sent.url.includes(NAME));
  t.say("the name is in the body instead", sent.body.includes(NAME));
  /* The two halves the server needs to log one and redact the other. */
  const body = JSON.parse(sent.body || "{}");
  t.say(`the body is split by classification (safe=${JSON.stringify(body.safeFilters)})`,
    body.sensitiveFilters !== undefined && body.safeFilters !== undefined);
  t.say("the free-text search is in the sensitive half", JSON.stringify(body.sensitiveFilters).includes(NAME));
  /* The drift that returned zero for a visible customer. */
  t.say(`it carries what the table rendered with (${body.title} / ${body.entity})`, Boolean(body.title && body.entity));
}

/* And the browser's own address bar is untouched. */
t.say(`the page URL is unchanged (${new URL(page.url()).search || "no query"})`, !new URL(page.url()).search);

await browser.close();
process.exit(t.finish(errors) ? 0 : 1);
