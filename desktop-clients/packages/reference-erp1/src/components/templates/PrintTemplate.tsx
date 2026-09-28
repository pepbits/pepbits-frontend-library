'use client';
import { cx, useFormat, useMediaQuery, useEntityApi, APP, Button, Checkbox, Empty, IconButton, Segmented, PrintTable, lineTotals, WorkList, LogoMark, Card, Frame, type PageDef, type Row, type Line, KeystoneInvoice, CompanyGate, useCompanyProfile } from '@pepbits/reference-keystone-core';
import { useEffect, useRef, useState } from 'react';
import { Printer, ZoomIn, ZoomOut } from 'lucide-react';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const A4_W = 794;


/** Pick a document, see exactly what will print, then print or save as PDF. */
export default function PrintTemplate({ def }: { def: PageDef }) {
 const referenceT = useReferenceLocalization().t;

  // Printing waits for the server company profile (no invented identity on paper).
  const companyReady = useCompanyProfile().status === 'ready';
  const entityApi = useEntityApi();
  const isWide = useMediaQuery('(min-width: 1024px)');
  const [sel, setSel] = useState<Row | null>(null);
  const [customer, setCustomer] = useState<Row | null>(null);
  const [copy, setCopy] = useState<'Original' | 'Duplicate'>('Original');
  const [terms, setTerms] = useState(true);
  const [fit, setFit] = useState(1);
  const [zoom, setZoom] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFit(Math.min(1, (el.clientWidth - 40) / A4_W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [sel]);
  useEffect(() => {
    setCustomer(null);
    if (!sel?.customer) return;
    entityApi.list('customers', { q: String(sel.customer), size: 1 }).then((r) => setCustomer(r.rows[0] ?? null)).catch(() => {});
  }, [sel]);
  const scale = Math.max(0.3, fit + zoom);

  return (
    <Frame className={cx(isWide && 'flex-row')}>
      <Card className={cx('flex flex-col', isWide ? 'w-[340px] shrink-0' : 'h-[40vh]')}>
        <WorkList def={def} compact selectedId={sel?.id} onOpen={setSel} onLoaded={(res) => { if (!sel && res.rows[0]) setSel(res.rows[0]); }} />
      </Card>
      <Card className="flex min-h-[520px] min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          <Segmented size="sm" value={copy} onChange={setCopy} options={[{ value: 'Original', label: 'Original' }, { value: 'Duplicate', label: 'Duplicate' }]} />
          <Checkbox checked={terms} onChange={setTerms} label={referenceT("Show terms")} />
          <span className="flex-1" />
          <IconButton icon={ZoomOut} label={referenceT("Zoom out")} onClick={() => setZoom((z) => z - 0.1)} />
          <span className="w-10 text-center text-[length:calc(12px*var(--fs-scale))] text-ink-3 tnum">{Math.round(scale * 100)}%</span>
          <IconButton icon={ZoomIn} label={referenceT("Zoom in")} onClick={() => setZoom((z) => z + 0.1)} />
          <Button variant="primary" icon={Printer} disabled={!sel || !companyReady} onClick={() => window.print()}><ReferenceText message="Print or save PDF" /></Button>
        </div>
        <div ref={box} className="min-h-0 flex-1 overflow-auto bg-surface-3 p-5">
          {sel ? (
            <div style={{ width: A4_W * scale, height: 1123 * scale }} className="print-reset mx-auto">
              <div className="print-reset" style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                <CompanyGate>{(company) => <KeystoneInvoice row={sel} customer={customer} copy={copy} showTerms={terms} company={company} />}</CompanyGate>
              </div>
            </div>
          ) : (
            <Empty icon={Printer} title={referenceT("Pick a document to preview")} body="The preview updates as soon as you select an invoice." />
          )}
        </div>
      </Card>
    </Frame>
  );
}
