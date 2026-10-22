// Syntax + import sanity check (no install needed except typescript). Usage: node scripts/check.js
const fs = require('fs'), path = require('path');
let ts; try { ts = require('typescript'); } catch { ts = require('/home/claude/.npm-global/lib/node_modules/typescript'); }
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
console.log(files.length + ' files checked, problems: ' + bad);
process.exit(bad ? 1 : 0);
