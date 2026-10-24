import {Children,Fragment,isValidElement,type CSSProperties,type ReactNode,type ReactElement} from 'react';
type Option={value:string;label:string};
const SPACE = (n: string) => `${Number(n) * 0.25}rem`;
export function splitFieldClasses(className?: string): { wrapper: string; style: CSSProperties } {
  const style: CSSProperties = {};
  const keep: string[] = [];
  for (const c of (className ?? '').split(/\s+/).filter(Boolean)) {
    let m: RegExpMatchArray | null;
    if ((m = c.match(/^h-(\d+(?:\.\d+)?)$/))) style.height = SPACE(m[1]!);
    else if ((m = c.match(/^min-h-\[(\d+px)\]$/))) style.minHeight = m[1];
    else if ((m = c.match(/^p([lrxy])-(\d+(?:\.\d+)?)$/))) {
      const v = SPACE(m[2]!);
      if (m[1] === 'l' || m[1] === 'x') style.paddingInlineStart = v;
      if (m[1] === 'r' || m[1] === 'x') style.paddingInlineEnd = v;
      if (m[1] === 'y') { style.paddingTop = v; style.paddingBottom = v; }
    }
    else if ((m = c.match(/^text-(right|center|left)$/))) style.textAlign = m[1] as CSSProperties['textAlign'];
    else if (c === 'tnum') style.fontVariantNumeric = 'tabular-nums';
    else if (c === 'font-mono') style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';
    else if ((m = c.match(/^text-\[length:calc\((\d+(?:\.\d+)?)px\*var\(--fs-scale\)\)\]$/))) style.fontSize = `calc(${m[1]}px * var(--fs-form))`;
    else if (/^text-\[\d+(?:\.\d+)?px\]$/.test(c)) continue;
    else keep.push(c);
  }
  return { wrapper: keep.join(' '), style };
}

type OptionElementProps = { value?: string | number; children?: ReactNode; disabled?: boolean };
const textOf = (node: ReactNode): string => {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode; message?: string }>(node)) return typeof node.props.message === 'string' ? node.props.message : textOf(node.props.children);
  return '';
};
/** Flattens source `<option>` children (including fragments, arrays and optgroups) into shared options. */
export function optionsFromChildren(children: ReactNode): { options: Option[]; placeholder: string } {
  const options: Option[] = [];
  let placeholder = '';
  const walk = (nodes: ReactNode) => Children.forEach(nodes, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<OptionElementProps>;
    if (el.type === Fragment || el.type === 'optgroup') { walk(el.props.children); return; }
    if (el.type !== 'option') return;
    const label = textOf(el.props.children);
    const value = el.props.value === undefined ? label : String(el.props.value);
    if (value === '' && !options.length && !placeholder) { placeholder = label || ' '; return; }
    options.push({ value, label });
  });
  walk(children);
  return { options, placeholder };
}
