import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {PreferencePreview} from '@pepbits/page-engines/worklist';
test('inline preview stays in page flow and closes through its host',()=>{
 const close=vi.fn();const view=render(<PreferencePreview mode="inline" open onClose={close} title="Preview"><p>Selected record</p></PreferencePreview>);
 expect(screen.getByText('Selected record')).toBeVisible();
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Close'}));expect(close).toHaveBeenCalledOnce();
 view.rerender(<PreferencePreview mode="inline" open={false} onClose={close} title="Preview"><p>Selected record</p></PreferencePreview>);
 expect(screen.queryByText('Selected record')).not.toBeInTheDocument();
});
