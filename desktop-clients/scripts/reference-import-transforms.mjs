import ts from 'typescript';
const MASTER = ['PAYERS', 'TPAS', 'NETWORKS', 'PLANS', 'DEPARTMENTS', 'PRACTITIONERS', 'WARDS', 'SERVICES', 'PACKAGES', 'COMPLAINTS', 'COUNTERS',
  'payer', 'tpa', 'network', 'plan', 'department', 'practitioner', 'ward', 'healthPackage', 'complaint', 'counter',
  'networksFor', 'plansFor', 'tpasFor', 'practitionersFor', 'wardsForCategory'];
const FORMAT = ['fmtDate', 'fmtDateTime', 'fmtTime', 'ageOf', 'relativeDay'];
const CONTROLS = {button: 'SourceButton', input: 'SourceInput', textarea: 'SourceTextarea', select: 'SourceSelect', table: 'Table', thead: 'TableHeader', tbody: 'TableBody', tr: 'TableRow', th: 'TableHead', td: 'TableCell'};
/** Property names that hold an English enum value shown to the reader (statuses, priorities...). */
const ENUM_PROPS = new Set(['status', 'urgency', 'priority', 'authStatus', 'kind', 'gender', 'bedCategory', 'triage', 'billingMode', 'isolation', 'relationship', 'teleChannel', 'label', 'short']);
const COPY_ATTRS = new Set(['title', 'placeholder', 'aria-label', 'alt', 'label', 'hint', 'body', 'sub', 'error', 'description', 'subtitle', 'confirmLabel', 'message', 'emptyMessage']);
const NATIVE_LOCALIZE = new Set(['title', 'aria-label', 'alt']);
const COPY_KEYS = new Set(['title', 'body', 'label', 'sub', 'msg', 'note', 'hint', 'message', 'description']);
const ENTITIES = {'&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&nbsp;': '\u00a0', '&middot;': '·', '&mdash;': '—', '&ndash;': '–', '&rarr;': '→', '&hellip;': '…', '&ldquo;': '“', '&rdquo;': '”'};
const decode = s => s.replace(/&[a-z#0-9]+;/gi, m => ENTITIES[m] ?? m);
const hasWords = s => /[A-Za-z]{2,}/.test(s);

const kindOf = (name, sf) => ts.createSourceFile(name, '', ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const parse = (text, name) => ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const quote = s => JSON.stringify(s);

/** React's JSX whitespace rule for one text node. */
function jsxText(raw) {
  const lines = decode(raw).split(/\r\n|\n|\r/);
  const out = [];
  lines.forEach((line, i) => {
    let l = line.replace(/\t/g, ' ');
    if (i !== 0) l = l.replace(/^ +/, '');
    if (i !== lines.length - 1) l = l.replace(/ +$/, '');
    if (l) out.push(l);
  });
  return out.join(' ');
}

const simple = n => {
  while (ts.isParenthesizedExpression(n) || ts.isNonNullExpression(n) || ts.isAsExpression(n)) n = n.expression;
  return ts.isIdentifier(n) || ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)
    || (ts.isCallExpression(n) && (ts.isIdentifier(n.expression) || ts.isPropertyAccessExpression(n.expression)) && !n.arguments.some(a => ts.isArrowFunction(a) || ts.isFunctionExpression(a)))
    || ts.isNumericLiteral(n);
};

export function localizeFile(text, dest) {
  const sf = parse(text, dest);
  const edits = [];
  const flags = {tr: false, lt: false};
  const src = n => text.slice(n.getStart(sf), n.getEnd());
  const edit = (node, replacement) => edits.push({start: node.getStart(sf), end: node.getEnd(), text: replacement});
  const claimed = [];
  const inside = n => claimed.some(c => n.getStart(sf) >= c[0] && n.getEnd() <= c[1]);
  const claim = (s, e) => claimed.push([s, e]);

  /** Source of an expression with copy leaves wrapped in tr(). Returns null when nothing is copy. */
  function copyExpr(n) {
    if (ts.isParenthesizedExpression(n)) { const r = copyExpr(n.expression); return r && `(${r})`; }
    if (ts.isNoSubstitutionTemplateLiteral(n) || ts.isStringLiteral(n)) { flags.tr = true; return hasWords(n.text) ? `tr(${quote(n.text)})` : null; }
    if (ts.isTemplateExpression(n)) {
      const statics = [n.head.text, ...n.templateSpans.map(s => s.literal.text)];
      const values = [];
      let msg = statics[0];
      n.templateSpans.forEach((span, i) => {
        msg += `{value${i}}` + statics[i + 1];
        values.push(`value${i}: ${valueExpr(span.expression)}`);
      });
      if (!hasWords(statics.join('')) && !values.some(v => /^value\d+: tr\(/.test(v))) return null;
      flags.tr = true;
      return `tr(${quote(msg)}, { ${values.join(', ')} })`;
    }
    if (ts.isConditionalExpression(n)) {
      const a = copyExpr(n.whenTrue), b = copyExpr(n.whenFalse);
      if (a === null && b === null) return null;
      return `${src(n.condition)} ? ${a ?? src(n.whenTrue)} : ${b ?? src(n.whenFalse)}`;
    }
    if (ts.isBinaryExpression(n) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind)) {
      const r = copyExpr(n.right);
      const l = n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ? null : copyExpr(n.left);
      if (r === null && l === null) return null;
      return `${l ?? src(n.left)} ${n.operatorToken.getText(sf)} ${r ?? src(n.right)}`;
    }
    return null;
  }
  /** A template/run value: enum-like values and string leaves are translated, everything else is passed through. */
  function valueExpr(n) {
    let inner = n;
    while (ts.isParenthesizedExpression(inner)) inner = inner.expression;
    if (ts.isStringLiteral(inner)) { flags.tr = true; return hasWords(inner.text) ? `tr(${quote(inner.text)})` : src(inner); }
    if (ts.isConditionalExpression(inner)) {
      const a = valueExpr(inner.whenTrue), b = valueExpr(inner.whenFalse);
      return `${src(inner.condition)} ? ${a} : ${b}`;
    }
    if (ts.isCallExpression(inner) && ts.isPropertyAccessExpression(inner.expression) && inner.expression.name.text === 'toLowerCase' && inner.arguments.length === 0) {
      const base = inner.expression.expression;
      if (ts.isIdentifier(base) || (ts.isPropertyAccessExpression(base) && !/^(code|name|title|id)$/.test(base.name.text))) { flags.tr = true; return `tr(${src(base)} ?? "").toLowerCase()`; }
    }
    if (ts.isPropertyAccessExpression(inner) && ENUM_PROPS.has(inner.name.text)) { flags.tr = true; return `tr(${src(inner)} ?? "")`; }
    return `(${src(n)}) ?? ""`;
  }

  function jsxChildren(el, children) {
    const runs = [];
    let cur = [];
    const flush = () => { while (cur.length && ts.isJsxText(cur[0]) && !/\S/.test(cur[0].text) && cur[0].text.includes('\n')) cur.shift(); while (cur.length && ts.isJsxText(cur[cur.length - 1]) && !/\S/.test(cur[cur.length - 1].text) && cur[cur.length - 1].text.includes('\n')) cur.pop(); if (cur.length) runs.push(cur); cur = []; };
    for (const c of children) {
      if (ts.isJsxText(c)) { cur.push(c); continue; }
      if (ts.isJsxExpression(c) && c.expression) {
        const e = c.expression;
        if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) { cur.push(c); continue; }
        if (simple(e)) { cur.push(c); continue; }
      }
      flush();
    }
    flush();
    for (const run of runs) {
      const parts = [];
      const values = [];
      let msg = '';
      let leading = false, trailing = false;
      run.forEach((c, i) => {
        if (ts.isJsxText(c)) {
          const raw = c.text;
          const t = jsxText(raw);
          if (!t && !/\S/.test(raw) && !raw.includes('\n')) { msg += raw; return; }
          msg += t;
        } else if (ts.isStringLiteral(c.expression) || ts.isNoSubstitutionTemplateLiteral(c.expression)) msg += c.expression.text;
        else { msg += `{value${values.length}}`; values.push(valueExpr(c.expression)); }
      });
      if (!hasWords(msg.replace(/\{value\d+\}/g, ''))) {
        // Expression-only run with an enum-like value (`{r.urgency}`): still copy.
        if (run.length === 1 && ts.isJsxExpression(run[0]) && run[0].expression && ts.isPropertyAccessExpression(run[0].expression) && ENUM_PROPS.has(run[0].expression.name.text)) {
          flags.lt = true;
          edit(run[0], `<LocalizedText message={${src(run[0].expression)} ?? ""} />`);
          claim(run[0].getStart(sf), run[0].getEnd());
        }
        continue;
      }
      leading = /^\s/.test(msg); trailing = /\s$/.test(msg);
      const message = msg.trim().replace(/\s+/g, ' ');
      const attr = /["\\{}&<>\n]/.test(message) ? `{${quote(message)}}` : quote(message);
      const element = `<LocalizedText message=${attr}${values.length ? ` values={{ ${values.map((v, i) => `value${i}: ${v}`).join(', ')} }}` : ''} />`;
      flags.lt = true;
      const hasLeft = children.indexOf(run[0]) > 0, hasRight = children.indexOf(run[run.length - 1]) < children.length - 1;
      const out = `${leading && hasLeft ? '{" "}' : ''}${element}${trailing && hasRight ? '{" "}' : ''}`;
      const first = run[0], last = run[run.length - 1];
      edits.push({start: first.getStart(sf), end: last.getEnd(), text: out});
      claim(first.getStart(sf), last.getEnd());
    }
  }

  function visit(node) {
    if (ts.isJsxElement(node)) jsxChildren(node, [...node.children]);
    else if (ts.isJsxFragment(node)) jsxChildren(node, [...node.children]);

    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sf);
      const tag = node.parent.parent.tagName?.getText(sf) ?? '';
      const native = /^[a-z]/.test(tag);
      const init = node.initializer;
      if (COPY_ATTRS.has(name)) {
        if (ts.isStringLiteral(init)) {
          if (native && NATIVE_LOCALIZE.has(name) && hasWords(init.text)) { flags.tr = true; edit(init, `{tr(${quote(init.text)})}`); }
        } else if (ts.isJsxExpression(init) && init.expression) {
          const e = init.expression;
          const plain = ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e);
          const r = plain && !(native && NATIVE_LOCALIZE.has(name)) ? null : copyExpr(e);
          if (r !== null) { edit(e, r); claim(e.getStart(sf), e.getEnd()); }
        }
      }
    }
    if (ts.isPropertyAssignment(node)) {
      const key = node.name.getText(sf).replace(/^['"]|['"]$/g, '');
      if (COPY_KEYS.has(key) && !inside(node.initializer) && (ts.isTemplateExpression(node.initializer) || ts.isConditionalExpression(node.initializer) || ts.isParenthesizedExpression(node.initializer))) {
        const r = copyExpr(node.initializer);
        if (r !== null && ts.isTemplateExpression(node.initializer) || (r !== null && /tr\(/.test(r) && !ts.isStringLiteral(node.initializer))) { edit(node.initializer, r); claim(node.initializer.getStart(sf), node.initializer.getEnd()); }
      }
    }
    // {cond ? "A" : `B ${x}`} and {cond && "text"} as a JSX child outside a text run
    if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) && !inside(node)
        && (ts.isConditionalExpression(node.expression) || ts.isBinaryExpression(node.expression) || ts.isTemplateExpression(node.expression))) {
      const r = copyExpr(node.expression);
      if (r !== null) { edit(node.expression, r); claim(node.getStart(sf), node.getEnd()); }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);

  // Drop edits fully contained in an earlier (outer) edit, then apply from the end.
  edits.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = [];
  for (const e of edits) if (!kept.some(k => e.start >= k.start && e.end <= k.end)) kept.push(e);
  let out = text;
  for (const e of kept.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return {text: out, flags};
}

/** Top-level components (and the identifiers each uses), for hook injection. */
export function injectHooks(text, dest, wanted, hooks = {}) {
  const sf = parse(text, dest);
  const edits = [];
  const orphans = [];
  const callsIn = (node, names) => {
    const found = new Set();
    const v = n => {
      if (ts.isIdentifier(n) && names.includes(n.text) && !ts.isImportSpecifier(n.parent) && !ts.isImportClause(n.parent)
        && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n) && !(ts.isPropertyAssignment(n.parent) && n.parent.name === n)
        && !(ts.isJsxAttribute(n.parent)) && !(ts.isBindingElement(n.parent) && n.parent.propertyName === n) && !ts.isTypeReferenceNode(n.parent)) found.add(n.text);
      ts.forEachChild(n, v);
    };
    v(node);
    return found;
  };
  const declared = (body, name) => {
    let hit = false;
    const v = n => { if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name) hit = true; if (ts.isParameter(n) && ts.isIdentifier(n.name) && n.name.text === name) hit = true; ts.forEachChild(n, v); };
    v(body);
    return hit;
  };
  const targets = [];
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name && st.body) targets.push({name: st.name.text, body: st.body, fn: st});
    else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (!d.initializer || !ts.isIdentifier(d.name)) continue;
        let init = d.initializer;
        if (ts.isCallExpression(init) && ts.isIdentifier(init.expression) && init.expression.text === 'forwardRef') init = init.arguments[0];
        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) targets.push({name: d.name.text, body: init.body, fn: init, block: ts.isBlock(init.body)});
      }
    }
  }
  for (const t of targets) {
    const mentioned = {};
    for (const [hook, names] of Object.entries(wanted)) {
      const used = callsIn(t.body, names);
      for (const n of used) if (declared(t.body, n) && !(hook === 'tr')) used.delete(n);
      if (used.size) mentioned[hook] = used;
    }
    if (!Object.keys(mentioned).length) continue;
    const isBlock = t.block ?? ts.isBlock(t.body);
    if (!/^([A-Z]|use[A-Z])/.test(t.name) || !isBlock) { orphans.push(`${t.name}: ${Object.entries(mentioned).map(([h, s]) => `${h}:${[...s].join(',')}`).join(' ')}`); continue; }
    let lines = '';
    if (mentioned.master) lines += `\n  const { ${[...mentioned.master].sort().join(', ')} } = useMaster();`;
    if (mentioned.format) lines += `\n  const { ${[...mentioned.format].sort().join(', ')} } = ${hooks.format ?? "useMedbandFormat"}();`;
    if (mentioned.api) lines += `\n  const api = ${hooks.api ?? "useMedbandApi"}();`;
    if (mentioned.tr) lines += `\n  const { t: tr } = useLocalization();`;
    edits.push({at: t.body.getStart(sf) + 1, text: lines});
  }
  for (const e of edits.sort((a, b) => b.at - a.at)) text = text.slice(0, e.at) + e.text + text.slice(e.at);
  return {text, orphans};
}

