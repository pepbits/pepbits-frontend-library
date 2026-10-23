import {Pagination as SharedPagination} from '@pepbits/components';
import {CollectionView, type CollectionViewProps, type CollectionColumn} from '@pepbits/components/collection-view';
import {usePreferences} from '@pepbits/preferences/react';
export type Column<T> = CollectionColumn<T>;
export function DataTable<T>(props: CollectionViewProps<T>) {
  const {preferences} = usePreferences();
  return <CollectionView {...props} view={preferences.resultView}/>;
}
export function Pagination({page, total, onPage}: {page: number; pageSize: number; total: number; onPage: (page: number) => void; onPageSize?: (size: number) => void}) {
  const host = usePreferences();
  return <SharedPagination page={page} total={total} pageSize={host.preferences.pageSize} onPageChange={onPage}
    pageSizeDisabled={!host.preferencesAvailable || host.isLocked('pageSize')} allowedPageSizes={host.allowedValues('pageSize')}
    onPageSizeChange={size => {void host.update({pageSize: size}); onPage(1);}}/>;
}
