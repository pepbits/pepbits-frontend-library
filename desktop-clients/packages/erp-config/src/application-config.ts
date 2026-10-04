import { MODULES, PAGE_REGISTRY } from './navigation.ts';
import type { ProductDefinition } from './product.ts';
import type { LanguageKey, MenuItem, ModuleDefinition, ModuleKey } from './types.ts';
import type { TranslationCatalog } from './i18n.ts';
export interface NavigationNode {
    id: string;
    kind: 'module' | 'section' | 'group' | 'page';
    parentId: string | null;
    labelKey: string;
    shortLabelKey?: string;
    moduleId?: string;
    pageId?: string;
    icon?: string;
    badge?: string;
    order: number;
}
export interface NavigationResponse {
    schemaVersion: 1;
    revision: string;
    productId: string;
    defaultModule: string;
    defaultPageId: string;
    nodes: NavigationNode[];
    pages: Array<{
        id: string;
        titleKey: string;
        subtitleKey: string;
    }>;
}
export interface LocalizationResponse {
    schemaVersion: 1;
    revision: string;
    productId: string;
    language: LanguageKey;
    direction: 'ltr' | 'rtl';
    fallbackLanguage: 'en';
    messages: Record<string, string>;
    fallbackMessages: Record<string, string>;
}
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function parseLocalization(value: unknown, productId: string, language: LanguageKey): LocalizationResponse {
    if (!isObject(value) || value.schemaVersion !== 1 || value.productId !== productId || value.language !== language || value.direction !== (language === 'ar' ? 'rtl' : 'ltr') || value.fallbackLanguage !== 'en' || typeof value.revision !== 'string')
        throw new Error('Invalid localization response');
    for (const dictionary of [value.messages, value.fallbackMessages])
        if (!isObject(dictionary) || Object.entries(dictionary).some(([key, text]) => !key || ['__proto__', 'constructor', 'prototype'].includes(key) || typeof text !== 'string'))
            throw new Error('Invalid translation dictionary');
    return value as unknown as LocalizationResponse;
}
export function parseNavigation(value: unknown, productId: string): NavigationResponse {
    if (!isObject(value) || value.schemaVersion !== 1 || value.productId !== productId || typeof value.revision !== 'string' || typeof value.defaultModule !== 'string' || typeof value.defaultPageId !== 'string' || !Array.isArray(value.nodes) || !Array.isArray(value.pages))
        throw new Error('Invalid navigation response');
    const ids = new Set<string>(), pages = new Set<string>();
    for (const page of value.pages) {
        if (!isObject(page) || typeof page.id !== 'string' || pages.has(page.id) || typeof page.titleKey !== 'string' || typeof page.subtitleKey !== 'string')
            throw new Error('Invalid navigation page');
        pages.add(page.id);
    }
    for (const node of value.nodes) {
        if (!isObject(node) || typeof node.id !== 'string' || ids.has(node.id) || !['module', 'section', 'group', 'page'].includes(String(node.kind)) || typeof node.labelKey !== 'string' || typeof node.order !== 'number' || !Number.isFinite(node.order) || node.parentId !== null && typeof node.parentId !== 'string')
            throw new Error('Invalid navigation node');
        ids.add(node.id);
    }
    const nodes = value.nodes as unknown as NavigationNode[], byId = new Map(nodes.map(node => [node.id, node]));
    for (const node of nodes) {
        if (node.pageId !== undefined && !pages.has(node.pageId))
            throw new Error('Unknown navigation page');
        if (node.kind === 'page' && !node.pageId)
            throw new Error('Missing page ID');
        if (node.kind === 'module' && (node.parentId !== null || typeof node.moduleId !== 'string' || typeof node.shortLabelKey !== 'string'))
            throw new Error('Invalid module');
        if (node.kind !== 'module') {
            const parent = byId.get(node.parentId!);
            if (!parent || node.kind === 'section' && parent.kind !== 'module' || ['group', 'page'].includes(node.kind) && !['section', 'group'].includes(parent.kind))
                throw new Error('Invalid navigation parent');
        }
        const seen = new Set([node.id]);
        let parent = byId.get(node.parentId!);
        while (parent) {
            if (seen.has(parent.id))
                throw new Error('Cyclic navigation');
            seen.add(parent.id);
            parent = byId.get(parent.parentId!);
        }
    }
    if (!pages.has(value.defaultPageId) || !nodes.some(node => node.moduleId === value.defaultModule))
        throw new Error('Invalid navigation defaults');
    return value as unknown as NavigationResponse;
}
/** Keep executable components in the frontend; API icon strings are allowlisted. */
const icons = new Map<string, ModuleDefinition['icon']>();
function register(icon?: ModuleDefinition['icon']) { if (icon?.displayName)
    icons.set(icon.displayName, icon); }
for (const module of Object.values(MODULES)) {
    register(module.icon);
    const visit = (items: MenuItem[]) => items.forEach(item => { register(item.icon); if (item.children)
        visit(item.children); });
    module.navigation.forEach(section => visit(section.items));
}
Object.values(PAGE_REGISTRY).forEach(page => register(page.icon));
export function applyApplicationConfig(product: ProductDefinition, nav: NavigationResponse, locales: LocalizationResponse[]): ProductDefinition {
    if (nav.productId !== product.id || !locales.length || new Set(locales.map(item => item.language)).size !== locales.length || locales.some(item => item.productId !== product.id))
        throw new Error('Incomplete product configuration');
    const translations: TranslationCatalog = { en: { ...locales[0].fallbackMessages, ...product.translations?.en } };
    for (const locale of locales)
        translations[locale.language] = { ...locale.fallbackMessages, ...locale.messages, ...product.translations?.[locale.language] };
    const english = translations.en!;
    const text = (key: string) => english[key] ?? key;
    const pages = Object.fromEntries(nav.pages.flatMap(meta => product.pages[meta.id] ? [[meta.id, { ...product.pages[meta.id], title: text(meta.titleKey), subtitle: text(meta.subtitleKey), titleKey: meta.titleKey, subtitleKey: meta.subtitleKey }]] : []));
    // Legacy screens and stored workspace titles continue to resolve English source
    // strings while their stable-key migration proceeds. An alias only fills a gap: many
    // pages share one legacy string (every reference page's subtitle is
    // "reference.modules.demoNotice"; several pages are titled "Dashboard"), so overwriting
    // would leave whichever page came last as the text of all of them.
    for (const locale of locales) {
        const catalog = translations[locale.language]!;
        for (const meta of nav.pages) {
            const old = product.pages[meta.id];
            if (old) {
                if (!(old.title in catalog)) catalog[old.title] = catalog[meta.titleKey] ?? old.title;
                if (!(old.subtitle in catalog)) catalog[old.subtitle] = catalog[meta.subtitleKey] ?? old.subtitle;
            }
        }
    }
    const children = (parent: string) => nav.nodes.filter(node => node.parentId === parent).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    const items = (parent: string): MenuItem[] => children(parent).flatMap(node => {
        if (node.pageId && !pages[node.pageId])
            return [];
        const nested = items(node.id);
        if (!node.pageId && !nested.length)
            return [];
        return [{ id: node.id, label: text(node.labelKey), labelKey: node.labelKey, pageId: node.pageId, icon: icons.get(node.icon ?? ''), badge: node.badge, ...(nested.length ? { children: nested } : {}) }];
    });
    const modules = Object.fromEntries(nav.nodes.filter(node => node.kind === 'module').sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)).flatMap(node => {
        const base = product.modules[node.moduleId as ModuleKey];
        if (!base)
            return [];
        const navigation = children(node.id).map(section => ({ id: section.id, label: text(section.labelKey), labelKey: section.labelKey, items: items(section.id) })).filter(section => section.items.length);
        if (!navigation.length)
            return [];
        return [[base.id, { ...base, label: text(node.labelKey), labelKey: node.labelKey, shortLabel: text(node.shortLabelKey!), shortLabelKey: node.shortLabelKey, icon: icons.get(node.icon ?? '') ?? base.icon, navigation }]];
    })) as ProductDefinition['modules'];
    const defaultModule = (modules[nav.defaultModule as ModuleKey] ? nav.defaultModule : Object.keys(modules)[0]) as ModuleKey;
    if (!defaultModule || !Object.keys(pages).length)
        throw new Error('No supported pages are available for this product');
    return { ...product, modules, pages, defaultModule, translations };
}
/** Annotate schema copy without changing field labels used by backend validators. */
export function withSchemaLocalization(schema: import('./types.ts').EntitySchema): import('./types.ts').EntitySchema {
    return { ...schema, sections: schema.sections.map(section => ({ ...section, titleKey: `section.${schema.id}.${section.id}.title`, descriptionKey: section.description ? `section.${schema.id}.${section.id}.description` : undefined, fields: section.fields.map(field => ({ ...field, labelKey: `field.${schema.id}.${field.id}.label`, helpKey: field.help ? `field.${schema.id}.${field.id}.help` : undefined, placeholderKey: field.placeholder ? `field.${schema.id}.${field.id}.placeholder` : undefined })) })) };
}
