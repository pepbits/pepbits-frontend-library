import React from "react";
import {expect, test, vi} from "vitest";
import {render, screen, fireEvent} from "./test/render";
import {DEFAULT_PREFERENCES} from "@pepbits/preferences";
import {PreferenceHost, usePreferences} from "@pepbits/preferences/react";
import {PresentationProvider, presentationFromPreferences, usePresentationPreferences, Table, Pagination} from "@pepbits/components";

test("projects only table presentation from effective preferences without changing the snapshot", () => {
  const preferences = {...DEFAULT_PREFERENCES, density: "spacious" as const,
    zebraStripes: false, stickyTableHeader: false, wrapCellText: true, pageSize: 50 as const};
  expect(presentationFromPreferences(Object.freeze(preferences))).toEqual({
    density: "spacious", zebraStripes: false, stickyTableHeader: false, wrapCellText: true, pageSize: 50,
  });
});

test("live managed values override table props and drive the host's pagination controller", () => {
  const update = vi.fn();
  function Content() {
    const {preferences, isLocked, update} = usePreferences();
    return <PresentationProvider value={presentationFromPreferences(preferences)}>
      <Table aria-label="Records" density="compact" striped={false} stickyHeader={false}/>
      <Pagination page={1} total={100} pageSize={preferences.pageSize} pageSizeDisabled={isLocked('pageSize')}
        onPageChange={() => {}} onPageSizeChange={pageSize => update({pageSize})}/>
    </PresentationProvider>;
  }
  const view = render(<PreferenceHost preferences={{density:'compact',pageSize:10}}
    preferencePolicy={{revision:1,rules:{density:{locked:true,value:'spacious'},pageSize:{locked:true,value:50},
      zebraStripes:{locked:true,value:true},stickyTableHeader:{locked:true,value:true},wrapCellText:{locked:true,value:true}}}}
    update={update}><Content/></PreferenceHost>);
  expect(screen.getByRole('table')).toHaveAttribute('data-density','spacious');
  expect(screen.getByRole('table')).toHaveAttribute('data-striped','true');
  expect(screen.getByRole('table')).toHaveAttribute('data-sticky','true');
  expect(screen.getByRole('table')).toHaveAttribute('data-wrap','true');
  expect(screen.getByRole('combobox')).toHaveValue('50');
  expect(screen.getByRole('combobox')).toBeDisabled();
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'20'}});
  expect(update).not.toHaveBeenCalled();
  view.rerender(<PreferenceHost preferences={{density:'compact',pageSize:10}}
    preferencePolicy={{revision:1,rules:{density:{locked:true,value:'comfortable'},pageSize:{locked:true,value:20},
      zebraStripes:{locked:true,value:false},stickyTableHeader:{locked:true,value:false},wrapCellText:{locked:true,value:false}}}}
    update={update}><Content/></PreferenceHost>);
  expect(screen.getByRole('table')).toHaveAttribute('data-density','comfortable');
  expect(screen.getByRole('table')).toHaveAttribute('data-striped','false');
  expect(screen.getByRole('table')).toHaveAttribute('data-sticky','false');
  expect(screen.getByRole('table')).toHaveAttribute('data-wrap','false');
  expect(screen.getByRole('combobox')).toHaveValue('20');
});

test("standalone tables retain local props and an absent presentation context", () => {
  function Probe() { return <output>{String(usePresentationPreferences())}</output>; }
  render(<><Probe/><Table aria-label="Records" density="compact" striped/></>);
  expect(screen.getByRole('status')).toHaveTextContent('null');
  expect(screen.getByRole('table')).toHaveAttribute('data-density','compact');
  expect(screen.getByRole('table')).toHaveAttribute('data-striped','true');
  expect(screen.getByRole('table')).not.toHaveAttribute('data-managed-table');
});
