/**
 * What the panel shows is what the request carries.
 *
 * The unit tests check each half: that the Data tab renders `context.fields`
 * and has no other source, and that dispatch sends label/value pairs and a
 * prompt id. Neither can check them AGAINST each other — that needs the panel
 * on screen and the request on the wire at the same moment, which is this file.
 *
 * The transparency claim is the whole feature. A panel that describes a request
 * the browser does not actually make is worse than no panel: it is a screen
 * people would learn to trust.
 */
import { BASE, loadPlaywright, openViaPalette, reporter, requireShell, signIn } from "./harness.mjs";

const { chromium } = loadPlaywright();
await requireShell(BASE);
const browser = await chromium.launch({ chromiumSandbox: false });
// This suite verifies UI-to-request equality, not a live provider. Supply a
// credential-status fixture and intercept dispatch so it needs no secret or
// network access to an AI provider. Backend credential gates have API/unit tests.
const context = await browser.newContext();
// Suffix match: a deployed shell may reach the API under a same-origin prefix such as /api.
await context.route(url => url.pathname.endsWith("/ai/config"), async route => {
  const response = await route.fetch();
  const config = await response.json();
  await route.fulfill({response, body:JSON.stringify({...config, credential:{...config.credential, configured:true, hint:"test-fixture"}})});
});
await context.route("**/ai/dispatch", route => route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({text:"Deterministic browser-test reply"})}));
const { page, errors } = await signIn(browser, `${BASE}/finance/customer-master`, undefined, context);
const t = reporter("the assistant sends what it showed");

/* Every AI request the page makes, captured before it leaves. */
const dispatched = [];
page.on("request", (request) => {
  if (!request.url().includes("/ai/dispatch")) return;
  try { dispatched.push(JSON.parse(request.postData() ?? "{}")); } catch { dispatched.push({ unparseable: true }); }
});

const panel = page.locator('[role="dialog"][aria-label="AI assistant"]');
const openAssistant = async () => {
  await page.getByRole("button", { name: "Open the AI assistant" }).click();
  await page.waitForTimeout(900);
};

/* Gate 1 is the one an administrator cannot reach: a page whose build block is
   disabled never renders the assistant, whatever the policy says. */
await openViaPalette(page, "preferences");
t.say("a page with the assistant switched off does not offer it",
  (await page.getByRole("button", { name: "Open the AI assistant" }).count()) === 0);

await openViaPalette(page, "customer master");
await page.waitForTimeout(1500);
t.say("a page that allows it does", (await page.getByRole("button", { name: "Open the AI assistant" }).count()) === 1);

/* A selection to summarise. Without one the use case has nothing to read, which
   is a different screen and a different test. */
const boxes = page.locator("main tbody input[type=checkbox]");
await boxes.first().check();
await boxes.nth(1).check();
await page.waitForTimeout(600);

await openAssistant();
await panel.getByRole("button", { name: /Summarise selection/ }).click();
await page.waitForTimeout(900);

/* What the user is being shown, read off the screen. */
const shown = await panel.locator("ul > li").evaluateAll((items) =>
  items.map((item) => {
    const spans = item.querySelectorAll("span > span");
    return { label: spans[0]?.textContent ?? "", value: spans[1]?.textContent ?? "" };
  }).filter((field) => field.label));

t.say(`the panel lists what it captured (${shown.length} fields)`, shown.length > 0);
t.say("and the button offers to send exactly that many",
  (await panel.getByRole("button", { name: /^Send \d+ field/ }).textContent() ?? "").includes(String(shown.length)));

t.say("nothing has been sent yet", dispatched.length === 0);

await panel.getByRole("button", { name: /^Send \d+ field/ }).click();
await page.waitForTimeout(2500);

t.say(`the request went out once (${dispatched.length})`, dispatched.length === 1);
const body = dispatched[0] ?? {};

/* The assertion this file exists for. */
const sent = (body.fields ?? []).map((field) => ({ label: field.label, value: field.value }));
t.say(`it carries the same fields the panel showed (${sent.length})`, JSON.stringify(sent) === JSON.stringify(shown));

/* Spec D6: the browser holds no prompt text and no credential, so neither can
   be read out of it, replayed, or edited by whoever is sitting at it. */
t.say(`it carries a prompt id (${body.promptId ?? "none"})`, typeof body.promptId === "string" && body.promptId.length > 0);
t.say("and no prompt text", !("prompt" in body));
t.say("and nothing shaped like a credential", !/sk-[A-Za-z0-9_-]{8}|Bearer /.test(JSON.stringify(body)));
t.say("and says which use case and page it came from", body.useCaseId === "worklist.summarise-selection" && body.pageId === "customer-master");

/* Every value in the request is one the user could read on the panel. */
const shownValues = new Set(shown.map((field) => field.value));
t.say("no value reaches the request that the panel did not show",
  sent.every((field) => shownValues.has(field.value)));

/* Terminal mode is not a bypass, and :fields is the inspection command. */
const before = dispatched.length;
await panel.getByRole("button", { name: "Terminal mode" }).click();
await page.waitForTimeout(600);
const command = panel.getByLabel("Assistant command");
await command.fill(":fields summarise-selection");
await command.press("Enter");
await page.waitForTimeout(1500);
t.say("`:fields` shows what would be captured and sends nothing", dispatched.length === before);
t.say("and it did show something", /captured|Id|Name|Owner|Status/i.test(await panel.innerText()));

await command.fill(":nonsense");
await command.press("Enter");
await page.waitForTimeout(800);
const refusal = await panel.innerText();
t.say("an unknown command is refused", /No such command here/.test(refusal));
t.say("without saying whether it exists elsewhere", !/disabled|your tenant|not permitted/i.test(refusal));

/**
 * Gate 6, the page gate, on a real page.
 *
 * The healthcare MODULE is allowed for this tenant and several of its pages are
 * not: the ones that hold a patient record. Spec D2 — clinical modules and PHI
 * entities gated separately from the rest — is a claim about the shipped build,
 * and this is where it either holds or does not.
 */
await page.goto(`${BASE}/healthcare/encounter-worklist`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
t.say("a page the tenant denied does not offer the assistant",
  (await page.getByRole("button", { name: "Open the AI assistant" }).count()) === 0);
t.say("and the page itself still works", (await page.locator("main tbody tr").count()) > 0);

/**
 * A clinical use case needs a second, explicit acknowledgement naming the
 * record. One button for both categories makes the careful case cost nothing,
 * which is the same as not having one — so the thing to check is that the
 * request genuinely cannot leave until it is given.
 */
await page.goto(`${BASE}/healthcare/clinical-notes`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.locator("main tbody input[type=checkbox]").first().check();
await page.waitForTimeout(600);
await openAssistant();

const clinicalChoice = panel.getByRole("button", { name: /Summarise selected records/ }).first();
t.say("a clinical use case is offered, and marked as one",
  (await clinicalChoice.count()) === 1 && /clinical/i.test(await clinicalChoice.innerText()));

await clinicalChoice.click();
await page.waitForTimeout(900);

const send = panel.getByRole("button", { name: /^Send \d+ field/ });
const acknowledgement = panel.locator('input[type="checkbox"]');
t.say("the acknowledgement is asked for", (await acknowledgement.count()) === 1);
t.say("and names the record it concerns", /clinical-notes/.test(await panel.innerText()));
t.say("the send is held until it is given", await send.isDisabled());

const beforeClinical = dispatched.length;
await send.click({ force: true }).catch(() => undefined);
await page.waitForTimeout(1200);
t.say("and clicking it anyway sends nothing", dispatched.length === beforeClinical);

await acknowledgement.check();
await page.waitForTimeout(400);
t.say("giving it releases the send", await send.isEnabled());

await send.click();
await page.waitForTimeout(2500);
t.say(`and then the request goes (${dispatched.length - beforeClinical})`, dispatched.length === beforeClinical + 1);
t.say("under the clinical use case it was confirmed for",
  /^(encounter|documentation|cohort|coding|orders)\./.test(dispatched.at(-1)?.useCaseId ?? ""));

await browser.close();
process.exit(t.finish(errors) ? 0 : 1);
