// Source copy of lumen-reports src/lib/engine/expression.ts. Pure parser used for builder validation in the browser;
// the server re-validates every formula (dummy-api/reference-reports-engine.mjs).
/*
 * Safe arithmetic expressions for computed columns, e.g. "(actual - target) / target * 100".
 * Supports numbers, column identifiers, + - * /, parentheses and round(x[, digits]), abs, min, max, coalesce.
 * Never uses eval. Division by zero and missing values produce null.
 */

type Node =
  | { k: 'num'; v: number }
  | { k: 'id'; v: string }
  | { k: 'neg'; a: Node }
  | { k: 'bin'; op: '+' | '-' | '*' | '/'; l: Node; r: Node }
  | { k: 'call'; fn: string; args: Node[] };

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string } | { t: '(' } | { t: ')' } | { t: ',' };

export class ExpressionError extends Error {}

const FUNCS: Record<string, { min: number; max: number }> = {
  round: { min: 1, max: 2 },
  abs: { min: 1, max: 1 },
  min: { min: 2, max: 8 },
  max: { min: 2, max: 8 },
  coalesce: { min: 2, max: 8 },
};

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const v = Number(src.slice(i, j));
      if (Number.isNaN(v)) throw new ExpressionError(`"${src.slice(i, j)}" is not a number.`);
      out.push({ t: 'num', v });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if ('+-*/'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    if (c === '(') { out.push({ t: '(' }); i++; continue; }
    if (c === ')') { out.push({ t: ')' }); i++; continue; }
    if (c === ',') { out.push({ t: ',' }); i++; continue; }
    throw new ExpressionError(`"${c}" is not allowed. Use column names, numbers, + - * / and parentheses.`);
  }
  if (out.length > 200) throw new ExpressionError('Expression is too long.');
  return out;
}

function parse(src: string): Node {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const expect = (t: Tok['t']) => {
    const tok = toks[p];
    if (!tok || tok.t !== t) throw new ExpressionError(`Expected "${t}" at position ${p + 1}.`);
    p++;
    return tok;
  };
  function expr(): Node {
    let l = term();
    while (peek()?.t === 'op' && ((peek() as { v: string }).v === '+' || (peek() as { v: string }).v === '-')) {
      const op = (toks[p++] as { v: '+' | '-' }).v;
      l = { k: 'bin', op, l, r: term() };
    }
    return l;
  }
  function term(): Node {
    let l = unary();
    while (peek()?.t === 'op' && ((peek() as { v: string }).v === '*' || (peek() as { v: string }).v === '/')) {
      const op = (toks[p++] as { v: '*' | '/' }).v;
      l = { k: 'bin', op, l, r: unary() };
    }
    return l;
  }
  function unary(): Node {
    const t = peek();
    if (t?.t === 'op' && t.v === '-') { p++; return { k: 'neg', a: unary() }; }
    if (t?.t === 'op' && t.v === '+') { p++; return unary(); }
    return primary();
  }
  function primary(): Node {
    const t = peek();
    if (!t) throw new ExpressionError('Expression ends unexpectedly.');
    if (t.t === 'num') { p++; return { k: 'num', v: t.v }; }
    if (t.t === '(') { p++; const e = expr(); expect(')'); return e; }
    if (t.t === 'id') {
      p++;
      if (peek()?.t === '(') {
        const fn = t.v.toLowerCase();
        const spec = FUNCS[fn];
        if (!spec) throw new ExpressionError(`Unknown function "${t.v}". Available: ${Object.keys(FUNCS).join(', ')}.`);
        p++;
        const args: Node[] = [];
        if (peek()?.t !== ')') {
          args.push(expr());
          while (peek()?.t === ',') { p++; args.push(expr()); }
        }
        expect(')');
        if (args.length < spec.min || args.length > spec.max) throw new ExpressionError(`${fn}() takes ${spec.min === spec.max ? spec.min : `${spec.min} to ${spec.max}`} arguments.`);
        return { k: 'call', fn, args };
      }
      return { k: 'id', v: t.v };
    }
    throw new ExpressionError(`Unexpected "${t.t === 'op' ? t.v : t.t}".`);
  }
  if (toks.length === 0) throw new ExpressionError('Expression is empty.');
  const node = expr();
  if (p < toks.length) throw new ExpressionError('Unexpected text after the end of the expression.');
  return node;
}

const compiled = new Map<string, Node>();

export function compile(src: string): Node {
  let n = compiled.get(src);
  if (!n) {
    n = parse(src);
    if (compiled.size > 500) compiled.clear();
    compiled.set(src, n);
  }
  return n;
}

export function identifiers(src: string): string[] {
  const out = new Set<string>();
  const walk = (n: Node) => {
    if (n.k === 'id') out.add(n.v);
    else if (n.k === 'neg') walk(n.a);
    else if (n.k === 'bin') { walk(n.l); walk(n.r); }
    else if (n.k === 'call') n.args.forEach(walk);
  };
  walk(compile(src));
  return [...out];
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function ev(n: Node, vars: Record<string, unknown>): number | null {
  switch (n.k) {
    case 'num': return n.v;
    case 'id': return num(vars[n.v]);
    case 'neg': { const a = ev(n.a, vars); return a === null ? null : -a; }
    case 'bin': {
      const l = ev(n.l, vars);
      const r = ev(n.r, vars);
      if (l === null || r === null) return null;
      if (n.op === '+') return l + r;
      if (n.op === '-') return l - r;
      if (n.op === '*') return l * r;
      return r === 0 ? null : l / r;
    }
    case 'call': {
      const args = n.args.map((a) => ev(a, vars));
      if (n.fn === 'coalesce') return args.find((a) => a !== null) ?? null;
      if (args.some((a) => a === null)) return null;
      const a = args as number[];
      if (n.fn === 'round') { const f = Math.pow(10, a[1] ?? 0); return Math.round(a[0] * f) / f; }
      if (n.fn === 'abs') return Math.abs(a[0]);
      if (n.fn === 'min') return Math.min(...a);
      if (n.fn === 'max') return Math.max(...a);
      return null;
    }
  }
}

export function evaluate(src: string, vars: Record<string, unknown>): number | null {
  const v = ev(compile(src), vars);
  return v === null || !Number.isFinite(v) ? null : Math.round(v * 10000) / 10000;
}

/** Returns an error message, or null when the expression is valid and only uses allowed identifiers. */
export function validateExpression(src: string, allowed: string[]): string | null {
  try {
    const ids = identifiers(src);
    const unknown = ids.filter((i) => !allowed.includes(i));
    if (unknown.length) return `Unknown column${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Use: ${allowed.join(', ')}.`;
    return null;
  } catch (e) {
    return e instanceof ExpressionError ? e.message : 'Invalid expression.';
  }
}
