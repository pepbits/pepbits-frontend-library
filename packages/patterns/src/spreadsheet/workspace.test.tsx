import React from 'react';
import {test,expect,vi} from 'vitest';
import {screen,fireEvent,waitFor} from '@testing-library/react';
import {render,TestHost} from '../test';
import {SpreadsheetPage} from './index';
vi.mock('xlsx',()=>({utils:{aoa_to_sheet:vi.fn(()=>({})),book_new:vi.fn(()=>({})),book_append_sheet:vi.fn()},writeFile:vi.fn()}));
import * as XLSX from 'xlsx';
test('export awaits the host audit, preserves edited values on failure, and uses effective format',async()=>{
 const audit=vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(undefined),notify=vi.fn();
 render(<TestHost preferences={{exportFormat:'csv'}} screenHost={{can:()=>true,notify}}><SpreadsheetPage initialRows={[["A","Item",2,10,0,5,21,"Supplier"]]} audit={audit}/></TestHost>);
 fireEvent.change(screen.getByLabelText('Row 1, column Description'),{target:{value:'Edited'}});const button=screen.getByRole('button',{name:/export/i});fireEvent.click(button);
 await waitFor(()=>expect(notify).toHaveBeenCalled());await waitFor(()=>{expect(XLSX.writeFile).not.toHaveBeenCalled();});expect(screen.getByLabelText('Row 1, column Description')).toHaveValue('Edited');
 fireEvent.click(button);await waitFor(()=>expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(),'pepbits-costing-workbook.csv',{bookType:'csv'}));await waitFor(()=>{expect(JSON.stringify(audit.mock.calls)).not.toContain('Edited');});
});
test('absent export capability fails closed',()=>{render(<SpreadsheetPage audit={vi.fn()}/>);expect(screen.getByRole('button',{name:/export/i})).toBeDisabled();});
