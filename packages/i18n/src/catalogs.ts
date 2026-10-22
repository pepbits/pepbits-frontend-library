import type {LanguageKey, Messages, TranslationCatalog} from "./types";

/** Accept a direct catalog or the module returned by a host's dynamic import. */
export type CatalogLoader = () => Promise<Messages | {default: Messages}>;
export type CatalogLoaders = Partial<Record<LanguageKey, CatalogLoader>>;

/** Each host owns its catalogs and pending requests; there is no global registry.
 * Populated catalogs skip loading, concurrent requests share a promise, and a
 * failed request can be retried. Register loaders when creating the store. */
export function createCatalogStore({catalogs = {}, loaders = {}}: {
  catalogs?: TranslationCatalog;
  loaders?: CatalogLoaders;
} = {}) {
  const pending = new Map<LanguageKey, Promise<void>>();
  function loadCatalog(language: LanguageKey): Promise<void> {
    if (Object.keys(catalogs[language] ?? {}).length) return Promise.resolve();
    const existing = pending.get(language);
    if (existing) return existing;
    const loader = Object.hasOwn(loaders, language) ? loaders[language] : undefined;
    if (!loader) return Promise.resolve();
    const request = Promise.resolve().then(loader).then(result => {
      catalogs[language] = typeof result.default === "object" ? result.default : result as Messages;
    }).catch(error => {
      pending.delete(language);
      throw error;
    });
    pending.set(language, request);
    return request;
  }
  return {catalogs, loadCatalog};
}
