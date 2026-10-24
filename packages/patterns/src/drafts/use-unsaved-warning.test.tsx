import {renderHook} from '@testing-library/react';
import {expect, test} from 'vitest';
import {useUnsavedWarning} from './use-unsaved-warning';

test('only dirty mounted forms warn on browser close; clearing and unmounting detach the guard', () => {
  const warning = () => {const event = new Event('beforeunload', {cancelable: true});window.dispatchEvent(event);return event.defaultPrevented;};
  const view = renderHook(({dirty}) => useUnsavedWarning(dirty), {initialProps: {dirty: false}});
  expect(warning()).toBe(false);view.rerender({dirty: true});expect(warning()).toBe(true);
  view.rerender({dirty: false});expect(warning()).toBe(false);view.rerender({dirty: true});view.unmount();expect(warning()).toBe(false);
});
