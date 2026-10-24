import {render} from './test/render';
import {expect,test} from 'vitest';
import {PrintDocument} from './print-document';
test('print surface preserves host geometry and cleans its portal on unmount',()=>{
 const view=render(<PrintDocument className="invoice-page" style={{direction:'rtl'}}><p>Fictional document</p></PrintDocument>);
 expect(document.body.querySelector('.ops-print-document.invoice-page')).toHaveStyle({direction:'rtl'});expect(document.body.querySelector('.ops-print-document')).toHaveTextContent('Fictional document');view.unmount();expect(document.body.querySelector('.ops-print-document')).toBeNull();
});
