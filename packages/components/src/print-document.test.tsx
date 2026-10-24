import React from 'react';
import {render} from './test/render';
import {expect,test} from 'vitest';
import {PrintDocument} from './print-document';
test('print surface preserves host geometry and cleans its portal on unmount',()=>{
 const view=render(<PrintDocument className="invoice-page" style={{direction:'rtl'}}><p>Fictional document</p></PrintDocument>);
 expect(document.body.querySelector('.ops-print-document.invoice-page')).toHaveStyle({direction:'rtl'});expect(document.body.querySelector('.ops-print-document')).toHaveTextContent('Fictional document');view.unmount();expect(document.body.querySelector('.ops-print-document')).toBeNull();
});

test('captures the current source region only at print time and removes its clone afterwards',()=>{
 const sourceRef=React.createRef<HTMLDivElement>();
 const view=render(<><div ref={sourceRef}><input defaultValue="Initial"/><p>Fictional record</p></div><PrintDocument sourceRef={sourceRef}/></>);
 const input=sourceRef.current!.querySelector('input')!;input.value='Unsaved visible value';
 expect(document.querySelector('[data-print-snapshot]')!.childNodes).toHaveLength(0);
 window.dispatchEvent(new Event('beforeprint'));expect(document.querySelector('[data-print-snapshot] input')).toHaveValue('Unsaved visible value');
 expect(document.querySelector('[data-print-snapshot]')).toHaveTextContent('Fictional record');
 window.dispatchEvent(new Event('afterprint'));expect(document.querySelector('[data-print-snapshot]')!.childNodes).toHaveLength(0);
 view.unmount();expect(document.querySelector('[data-print-snapshot]')).toBeNull();
});
