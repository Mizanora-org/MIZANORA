// Syntax + import sanity check (no install needed except typescript). Usage: node scripts/check.js
const fs = require('fs'), path = require('path');
let ts; try { ts = require('typescript'); } catch { console.error('TypeScript not found. Run `npm ci` before `npm run check`.'); process.exit(1); }
const root = path.join(__dirname, '..');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { if (['node_modules', '.next', 'scripts', 'public'].includes(f)) continue; const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : /\.js$/.test(f) && files.push(p); } })(root);
let bad = 0;
const exportsOf = {};
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const out = ts.transpileModule(src, { fileName: f + 'x', reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, allowJs: true } });
  for (const d of out.diagnostics || []) { bad++; const { line } = d.file.getLineAndCharacterOfPosition(d.start); console.log('SYNTAX', path.relative(root, f) + ':' + (line + 1), ts.flattenDiagnosticMessageText(d.messageText, '\n')); }
  const ex = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) ex.add(m[1]);
  if (/export\s+default/.test(src)) ex.add('default');
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) m[1].split(',').forEach((x) => ex.add(x.trim().split(/\s+as\s+/).pop()));
  exportsOf[f] = ex;
}
const resolve = (from, spec) => {
  const base = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(from), spec);
  return [base + '.js', path.join(base, 'index.js'), base].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
};
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    const spec = m[2]; if (!spec.startsWith('@/') && !spec.startsWith('.')) continue;
    const target = resolve(f, spec);
    if (!target) { bad++; console.log('MISSING FILE', path.relative(root, f), spec); continue; }
    const named = (m[1].match(/\{([^}]*)\}/) || [, ''])[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    for (const n of named) if (!exportsOf[target].has(n)) { bad++; console.log('MISSING EXPORT', path.relative(root, f), n, 'from', spec); }
    if (/^[A-Za-z_$]/.test(m[1]) && !exportsOf[target].has('default')) { bad++; console.log('NO DEFAULT EXPORT', path.relative(root, f), spec); }
  }
  // client hooks used in a file without 'use client'
  const isClient = /^\s*['"]use client['"]/.test(src);
  if (!isClient && /\b(useState|useEffect|useRef|useMemo|useCallback)\(/.test(src) && !/lib\//.test(path.relative(root, f))) { bad++; console.log("HOOK WITHOUT 'use client'", path.relative(root, f)); }
}
// v38: every internal /blog/<slug> link in the content must point at a post that exists.
// A guide that links to a guide that was never written is a 404 waiting to be crawled, and
// nothing else in the chain catches it.
{
  const blogDir = path.join(root, 'content', 'blog');
  if (fs.existsSync(blogDir)) {
    const slugs = new Set();
    for (const f of fs.readdirSync(blogDir)) {
      if (!f.endsWith('.md')) continue;
      const m = fs.readFileSync(path.join(blogDir, f), 'utf8').match(/^slug:\s*(\S+)\s*$/m);
      if (m) slugs.add(m[1]);
    }
    for (const f of fs.readdirSync(blogDir)) {
      if (!f.endsWith('.md')) continue;
      const text = fs.readFileSync(path.join(blogDir, f), 'utf8');
      for (const m of text.matchAll(/\]\((\/blog\/[a-z0-9\-\/]+)\)/g)) {
        const target = m[1].replace(/^\/blog\//, '').replace(/\/$/, '');
        if (target.startsWith('category/')) continue; // /blog/category/<slug> is a route, not a post
        if (!slugs.has(target)) { bad++; console.log('BROKEN BLOG LINK', 'content/blog/' + f, '->', m[1]); }
      }
    }
  }
}

// v38.1: a self-hosted font the layout points at but that is not in the repo makes the build
// fail with a message that points nowhere near the real cause. Catch the missing file instead.
{
  const layout = path.join(root, 'app', 'layout.js');
  if (fs.existsSync(layout)) {
    const text = fs.readFileSync(layout, 'utf8');
    for (const m of text.matchAll(/path: '([^']+\.woff2)'/g)) {
      const rel = m[1].replace(/^\.\.\//, ''); // paths are relative to app/
      if (!fs.existsSync(path.join(root, rel))) { bad++; console.log('MISSING FONT FILE', 'app/layout.js ->', m[1]); }
    }
    // next/font needs plain string literals: a variable or a template literal compiles to
    // "Font loader values must be explicitly written literals", which is easy to misread.
    for (const m of text.matchAll(/path: (`|\$\{)/g)) { bad++; console.log('FONT PATH MUST BE A PLAIN STRING', 'app/layout.js'); break; }
  }
}

console.log(files.length + ' files checked, problems: ' + bad);
process.exit(bad ? 1 : 0);
