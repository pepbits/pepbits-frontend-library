'use client';
import {DiagnosticButton} from '@pepbits/reference-diagnostics';
import { Copy } from 'lucide-react';
import { useState } from 'react';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';


/** Readable rendering of HL7 v2 / ASTM / JSON payloads with segment names emphasised. */
export function MessageView({ raw, className }: { raw?: string | null; className?: string }) {
  const [copied, setCopied] = useState(false);
  if (!raw) return <p className="text-sm text-ink-faint"><ReferenceText message="Empty" /></p>;
  let text = raw;
  let json = false;
  try { if (/^\s*[{[]/.test(raw)) { text = JSON.stringify(JSON.parse(raw), null, 2); json = true; } } catch { /* not JSON */ }
  const lines = json ? text.split('\n') : text.replace(/[\x02\x03\x04\x05\x17]/g, '').split(/\r\n|\r|\n/).filter((l) => l.length);
  return (
    <div className={`relative rounded-md border border-line bg-[#FBFBFA] ${className || ''}`}>
      <DiagnosticButton className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-2xs text-ink-soft shadow-sm hover:text-ink"
        onClick={() => { navigator.clipboard.writeText(raw); setCopied(true); setTimeout(() => setCopied(false), 1200); }}><Copy className="h-3 w-3" />{copied ? 'Copied' : 'Copy'}</DiagnosticButton>
      <pre className="max-h-[50vh] overflow-auto p-3 font-mono text-xs leading-relaxed">
        {lines.map((l, i) => {
          if (json) return <div key={i}>{l}</div>;
          const m = /^([A-Z0-9]{1,3})([|].*)$/.exec(l) || /^(\d?[A-Z])(\|.*)$/.exec(l);
          return (
            <div key={i} className="whitespace-pre-wrap break-all">
              {m ? <><span className="font-semibold text-hema-600">{m[1]}</span>{m[2].split('|').map((f, j) => <span key={j}>{j > 0 && <span className="text-eosin-400">|</span>}{f}</span>)}</> : l}
            </div>
          );
        })}
      </pre>
    </div>
  );
}
