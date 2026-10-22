import {expect, test, vi} from "vitest";
import {createCatalogStore, createTranslator} from "@pepbits/i18n";

test("host loaders share concurrent requests and update an existing translator", async () => {
  const loader = vi.fn(async () => ({default: {custom: "مرحبا"}}));
  const store = createCatalogStore({loaders: {ar: loader}});
  const t = createTranslator({language: "ar", catalogs: store.catalogs});
  expect(t("custom")).toBe("custom");
  const request = store.loadCatalog("ar");
  expect(store.loadCatalog("ar")).toBe(request);
  await request;
  expect(t("custom")).toBe("مرحبا");
  await store.loadCatalog("ar");
  expect(loader).toHaveBeenCalledTimes(1);
});

test("English can also be lazy-loaded and direct catalogs are supported", async () => {
  const store = createCatalogStore({loaders: {en: async () => ({default: "A message keyed default", custom: "Hello"})}});
  await store.loadCatalog("en");
  expect(store.catalogs.en).toEqual({default: "A message keyed default", custom: "Hello"});
});

test("preloaded and unregistered languages need no network request", async () => {
  const loader = vi.fn(async () => ({custom: "Unused"}));
  const store = createCatalogStore({catalogs: {en: {custom: "Immediate"}}, loaders: {en: loader}});
  await store.loadCatalog("en");
  await store.loadCatalog("ml");
  expect(loader).not.toHaveBeenCalled();
  expect(createTranslator({language: "ml", catalogs: store.catalogs})("custom")).toBe("Immediate");
});

test("failed loads reject and can be retried, including synchronous loader errors", async () => {
  const loader = vi.fn<() => Promise<Record<string, string>>>()
    .mockRejectedValueOnce(new Error("offline"))
    .mockImplementationOnce(() => {throw new Error("sync");})
    .mockResolvedValueOnce({custom: "Recovered"});
  const store = createCatalogStore({loaders: {hi: loader}});
  await expect(store.loadCatalog("hi")).rejects.toThrow("offline");
  await expect(store.loadCatalog("hi")).rejects.toThrow("sync");
  await store.loadCatalog("hi");
  expect(store.catalogs.hi).toEqual({custom: "Recovered"});
  expect(loader).toHaveBeenCalledTimes(3);
});

test("empty successful catalogs are loaded once and host instances remain isolated", async () => {
  const loader = vi.fn(async () => ({}));
  const first = createCatalogStore({loaders: {ar: loader}});
  const second = createCatalogStore({catalogs: {ar: {custom: "Second host"}}});
  await first.loadCatalog("ar");
  await first.loadCatalog("ar");
  expect(loader).toHaveBeenCalledTimes(1);
  expect(first.catalogs.ar).toEqual({});
  expect(second.catalogs.ar).toEqual({custom: "Second host"});
});
