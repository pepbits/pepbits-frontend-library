import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadPlaywright } from "./harness.mjs";
import { audit } from "./a11y.mjs";
const browser = await loadPlaywright().chromium.launch({
  chromiumSandbox: false,
});
try {
  const context = await browser.newContext({
      viewport: { width: 1800, height: 1100 },
      acceptDownloads: true,
    }),
    page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors: string[] = [],
    actions: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const preferences: Record<string, unknown> = {
    sidebarPinned: true,
    reducedMotion: true,
    floatingWindows: false,
    formNavigation: "tabs",
    language: "en",
  };
  await context.route("**/preferences", async (r) => {
    if (r.request().method() === "PUT")
      Object.assign(
        preferences,
        r.request().postDataJSON().preferences ?? r.request().postDataJSON(),
      );
    await r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ preferences }),
    });
  });
  let failSave = true;
  await context.route("**/clinical-templates", async (r) => {
    const input = r.request().postDataJSON();
    actions.push(input.action);
    if (input.action === "save" && failSave) {
      failSave = false;
      await r.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "temporary" }),
      });
    } else await r.continue();
  });
  await page.goto(process.env.E2E_DESKTOP ?? "http://127.0.0.1:3109");
  await page.getByPlaceholder("user1").fill("admin");
  await page.locator("input[type=password]").fill("admin");
  await page.locator("button[type=submit]").click();
  await page.locator("header").first().waitFor();
  async function open(id: string) {
    await page.keyboard.press("Control+k");
    const d = page.getByRole("dialog");
    await d.locator("input").first().fill(id);
    await d.locator("button.group").first().click();
    await page.locator(`[data-clinical-library="${id}"]`).waitFor();
  }
  async function changeQueryPreference(label: string, value: string) {
    await page.keyboard.press("Control+k");
    const picker = page.getByRole("dialog");
    await picker.locator("input").first().fill("preferences");
    await picker.locator("button.group").first().click();
    if(label === "Worklist result view") await page.getByRole("radiogroup", {name:label}).getByRole("radio", {name:value === "cards" ? "Card grid" : "Table",exact:true}).click();
    else await page.getByRole("combobox", {name: label, exact: true}).selectOption(value);
    await open("allyvora-patient-query");
  }
  await open("allyvora-patient-query");
  let query = page.locator("[data-clinical-query]");
  await query
    .getByRole("heading", { name: "Search the patient registry", exact: true })
    .waitFor();
  assert.equal(actions.filter((a) => a === "search").length, 0);
  assert.equal(
    await query
      .getByRole("button", { name: "Search", exact: true })
      .isDisabled(),
    true,
  );
  await query
    .getByRole("textbox", { name: "First name", exact: true })
    .fill("Alex");
  await query.getByRole("button", { name: "Search", exact: true }).click();
  await query.getByText("1 patient found", { exact: true }).waitFor();
  await query.getByRole("button", { name: "Save preset", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: "Search name", exact: true })
    .fill("My demo search");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save search", exact: true })
    .click();
  await query
    .getByRole("combobox", { name: "Saved searches", exact: true })
    .getByRole("option", { name: "My demo search", exact: true })
    .waitFor({ state: "attached" });
  await query.getByRole("button", { name: "Alex Morgan", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("Alex Morgan", { exact: true })
    .waitFor();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .last()
    .click();
  await query
    .getByRole("button", { name: "More filters", exact: true })
    .click();
  await query
    .getByRole("combobox", { name: "Residing country", exact: true })
    .selectOption("Demo Country");
  await query.getByRole("button", { name: "Search", exact: true }).click();
  await query.getByText("1 patient found", { exact: true }).waitFor();
  await query.getByRole("button", { name: /More filters/ }).click();
  await changeQueryPreference("Quick view style", "inline");
  await query.getByRole("button", { name: "Alex Morgan", exact: true }).click();
  await query
    .locator("[data-query-detail]")
    .getByRole("heading", { name: "Alex Morgan", exact: true })
    .waitFor();
  assert.equal(
    await query
      .locator("[data-query-detail]")
      .evaluate((e) => !!e.closest("tr")),
    true,
  );
  await query
    .locator("[data-query-detail]")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await changeQueryPreference("Quick view style", "center-modal");
  await query.getByRole("button", { name: "Alex Morgan", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("heading", { name: "Alex Morgan", exact: true })
    .waitFor();
  await page.screenshot({ path: "/tmp/query-modal.png" });
  assert.deepEqual(
    (await audit(page, { include: '[role="dialog"]' })).filter((v) =>
      ["critical", "serious"].includes(v.impact),
    ),
    [],
  );
  await page.keyboard.press("Escape");
  await changeQueryPreference("Worklist result view", "cards");
  await query
    .getByRole("button", { name: "Alex Morgan", exact: true })
    .waitFor();
  await page.screenshot({ path: "/tmp/query-cards.png" });
  await changeQueryPreference("Worklist result view", "table");
  await changeQueryPreference("Quick view style", "right-drawer");
  await page
    .locator("[data-clinical-library]")
    .first()
    .evaluate((e) => {
      let p = e.parentElement;
      while (p) {
        if (p.scrollHeight > p.clientHeight) p.scrollTop = 0;
        p = p.parentElement;
      }
    });
  await page.screenshot({ path: "/tmp/clinical-patient-query.png" });
  assert.deepEqual(
    (await audit(page, { include: "[data-clinical-query]" })).filter((v) =>
      ["critical", "serious"].includes(v.impact),
    ),
    [],
  );
  // The record follows the shared "Record form style" preference (its own layout buttons were removed when the
  // Library adopted managed preferences), so choose the rail layout there.
  await changeQueryPreference("Record form style", "rail");
  await query.getByRole("button", { name: "New patient", exact: true }).click();
  let record = page.locator("[data-clinical-record]");
  await record.waitFor();
  await record.locator('[data-layout="rail"]').waitFor();
  assert.equal(await record.locator("[data-record-section]").count(), 9);
  assert.equal(
    await record.getByRole("textbox", { name: "MRN", exact: true }).count(),
    0,
  );
  assert.equal(await record.locator("progress").getAttribute("value"), "2");
  await page.screenshot({ path: "/tmp/record-parity-rail.png" });
  const footer = await record.locator("footer").boundingBox();
  assert.ok(footer && footer.y + footer.height <= 1100);
  // A release/documentation notice may appear above this reusable template.
  await record.evaluate((element) => {
    const notice = document.createElement("div");
    notice.id = "record-notice-regression";
    notice.style.height = "90px";
    element.before(notice);
  });
  await page.waitForFunction(() => {
    const footer = document.querySelector("[data-clinical-record] footer");
    return (
      footer && footer.getBoundingClientRect().bottom <= window.innerHeight - 40
    );
  });
  await page
    .locator("#record-notice-regression")
    .evaluate((element) => element.remove());
  assert.deepEqual(
    (await audit(page, { include: "[data-clinical-record]" })).filter((v) =>
      ["critical", "serious"].includes(v.impact),
    ),
    [],
  );
  await record.getByRole("tab", { name: "MRN", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  assert.equal(
    await record
      .getByRole("tab", { name: "Personal", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  // Layout is a preference: switch it there and reopen a new (still blank) record.
  await changeQueryPreference("Record form style", "wizard");
  await query.getByRole("button", { name: "New patient", exact: true }).click();
  await record.locator('[data-layout="wizard"]').waitFor();
  assert.equal(await record.locator("[data-record-section]").count(), 1);
  assert.equal(
    await record
      .getByRole("button", { name: "Create patient", exact: true })
      .count(),
    0,
  );
  await changeQueryPreference("Record form style", "tabs");
  await query.getByRole("button", { name: "New patient", exact: true }).click();
  await record.locator('[data-layout="tabs"]').waitFor();
  assert.equal(await record.locator("[data-record-section]").count(), 1);

  await record.getByRole("tab", { name: /Personal/ }).click();
  await record
    .getByRole("textbox", { name: "First name", exact: true })
    .fill("Browser");
  await record
    .getByRole("textbox", { name: "Last name", exact: true })
    .fill("Clinical Demo");
  await record.getByLabel("Date of birth", { exact: true }).fill("2001-01-02");
  await record
    .getByRole("combobox", { name: "Gender", exact: true })
    .selectOption("female");
  await record.getByRole("tab", { name: /Personal/ }).click();
  assert.equal(
    await record
      .getByRole("textbox", { name: "First name", exact: true })
      .inputValue(),
    "Browser",
  );
  await record
    .getByRole("button", { name: "Create patient", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create patient", exact: true })
    .click();
  await record.getByRole("alert").waitFor();
  assert.equal(
    await record
      .getByRole("textbox", { name: "First name", exact: true })
      .inputValue(),
    "Browser",
  );
  await record.getByRole("button", { name: "Retry", exact: true }).click();
  await record.getByText("Patient record saved.", { exact: true }).waitFor();
  await page.screenshot({ path: "/tmp/clinical-patient-record.png" });
  await open("allyvora-patient-360");
  await page
    .locator("[data-clinical-overview]")
    .getByRole("combobox", { name: "Select patient", exact: true })
    .selectOption({ label: "DEMO-000013 · Browser Clinical Demo" });
  const overview = page.locator("[data-clinical-overview]");
  await overview
    .getByRole("heading", { name: "Browser Clinical Demo", exact: true })
    .waitFor();
  await overview
    .getByRole("button", { name: "Expand all", exact: true })
    .click();
  assert.equal(
    await overview.getByRole("button", { expanded: true }).count(),
    13,
  );
  await overview
    .getByRole("button", { name: "Book", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Date", { exact: true }).fill("2027-03-20");
  await dialog.getByLabel("Time", { exact: true }).fill("14:30");
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await overview.getByText("Follow up", { exact: true }).first().waitFor();
  await page.screenshot({ path: "/tmp/clinical-patient-360.png" });
  await open("allyvora-patient-query");
  query = page.locator("[data-clinical-query]");
  if (
    await query.getByRole("button", { name: "Clear all", exact: true }).count()
  )
    await query.getByRole("button", { name: "Clear all", exact: true }).click();
  await query
    .getByRole("textbox", { name: "MRN / UHID", exact: true })
    .fill("DEMO-");
  await query.getByRole("button", { name: "Search", exact: true }).click();
  await query.getByText("13 patients found", { exact: true }).waitFor();
  await query.getByRole("button", { name: "Export", exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Export", exact: true })
    .click();
  assert.ok((await download).suggestedFilename().endsWith(".csv"));
  for (const language of ["ar", "hi", "ml", "en"]) {
    await page.keyboard.press("Control+k");
    let d = page.getByRole("dialog");
    await d.locator("input").first().fill("My Preferences");
    await d.locator("button.group").first().click();
    await page
      .getByRole("tab")
      .filter({
        hasText:
          /Language & help|اللغة والمساعدة|भाषा और सहायता|ഭാഷയും സഹായവും/,
      })
      .click();
    await page
      .locator('[data-tour="prefs-lang"] select')
      .selectOption(language);
    await page.waitForFunction(
      (l) => document.documentElement.lang === l,
      language,
    );
    await page.keyboard.press("Control+k");
    d = page.getByRole("dialog");
    await d.locator("input").first().fill("allyvora-patient-query");
    await d.locator("button.group").first().click();
    const catalog = JSON.parse(
      readFileSync(
        new URL(
          `../../dummy-api/config/localization/shared/${language}.json`,
          import.meta.url,
        ),
        "utf8",
      ),
    ).messages;
    await page
      .locator("[data-clinical-query]")
      .getByRole("heading", {
        name: catalog["template.clinical.findPatient"],
        exact: true,
      })
      .waitFor();
    await page
      .locator("[data-clinical-query]")
      .getByRole("button", {
        name: catalog["template.clinical.newPatient"],
        exact: true,
      })
      .waitFor();
    await open("allyvora-patient-record");
    await page
      .locator("[data-clinical-record]")
      .getByRole("tab", {
        name: catalog["template.clinical.personal"],
        exact: true,
      })
      .click();
    await page
      .locator("[data-clinical-record]")
      .getByRole("heading", {
        name: catalog["template.clinical.recordTitlePersonal"],
        exact: true,
      })
      .waitFor();
    await page
      .locator("[data-clinical-record]")
      .getByLabel(catalog["template.clinical.salutation"], { exact: true })
      .waitFor();
    assert.equal(
      await page.locator("html").getAttribute("dir"),
      language === "ar" ? "rtl" : "ltr",
    );
    assert.ok(
      await page.locator("body").evaluate((e) => e.scrollWidth <= innerWidth),
    );
  }
  assert.ok(
    actions.includes("search") &&
      actions.includes("load") &&
      actions.includes("save") &&
      actions.includes("overview") &&
      actions.includes("schedule") &&
      actions.includes("export"),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS clinical API-backed search, quick view, saved search, atomic registration, retained values/retry, patient navigation, 13 overview panels, appointment and audited CSV",
  );
} finally {
  await browser.close();
}
