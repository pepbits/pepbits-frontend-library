import type {IconComponent} from "@pepbits/icons";
import type {ModuleKey, PageDefinition} from "@pepbits/page-engines/types";
export type {ModuleKey, PageDefinition, PageKind} from "@pepbits/page-engines/types";
export interface MenuItem {
  labelKey?: string;
  id: string;
  label: string;
  icon?: IconComponent;
  pageId?: string;
  badge?: string;
  children?: MenuItem[];
}

export interface MenuSection {
  labelKey?: string;
  id: string;
  label: string;
  items: MenuItem[];
}

export interface ModuleDefinition {
  labelKey?: string;
  shortLabelKey?: string;
  id: ModuleKey;
  label: string;
  shortLabel: string;
  description: string;
  accent: string;
  icon: IconComponent;
  navigation: MenuSection[];
}


export interface ShellNavigation {
 modules: Partial<Record<ModuleKey, ModuleDefinition>>;
 pages: Record<string, PageDefinition>;
 defaultModule: ModuleKey;
 quickPages?: Array<{id: string; label: string; icon?: IconComponent}>;
 /** Optional utility targets, supplied by the host. */
 preferencesPageId?: string;
}
