import type {ReactNode} from 'react';
import type {DataColumn} from '../types';

/** Optional host-owned row editing. The engine still owns columns, criteria and paging. */
export interface WorklistTableComposition {
  /** Hide selection for single-row editors. Defaults to true. */
  selectable?: boolean;
  /** Insert a creation row, including when search returns no records. */
  beforeRows?: (columns: DataColumn[]) => ReactNode;
  /** Return undefined to retain the normal row. Supply a keyed table row otherwise. */
  renderRow?: (row: Record<string, string | number | boolean>, columns: DataColumn[]) => ReactNode;
  /** Replace the normal row actions without changing keyboard row activation. */
  renderActions?: (row: Record<string, string | number | boolean>) => ReactNode;
}
