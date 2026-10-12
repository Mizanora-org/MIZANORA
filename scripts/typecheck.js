// Deeper static check without installing anything: finds misspelled / undefined variables, missing exports, missing local files and duplicate names.
// Usage: node scripts/typecheck.js   (needs the global "typescript" package, same as scripts/check.js)
const fs = require('fs'), path = require('path');
let ts; try { ts = require('typescript'); } catch { ts = require('/home/claude/.npm-global/lib/node_modules/typescript'); }
const root = path.join(__dirname, '..');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { if (['node_modules', '.next', 'public', 'content', 'scripts'].includes(f)) continue; const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : /\.js$/.test(f) && files.push(p); } })(root);
const program = ts.createProgram(files, {
  allowJs: true, checkJs: true, noEmit: true, jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Node10, baseUrl: root, paths: { '@/*': ['./*'] }, skipLibCheck: true, strict: false, noImplicitAny: false, types: [], lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
});
const KEEP = new Set([2304, 2552, 2305, 2724, 2614, 2451, 2300, 2448, 2686, 2749, 2393, 2323, 2528]);
let bad = 0;
for (const sf of program.getSourceFiles()) {
  if (!files.includes(sf.fileName)) continue;
  for (const d of program.getSemanticDiagnostics(sf)) {
    const msg = ts.flattenDiagnosticMessageText(d.messageText, ' ');
    const localModule = d.code === 2307 && /['"](@\/|\.)/.test(msg);
    if (!KEEP.has(d.code) && !localModule) continue;
    if (d.code === 2686) continue; // 'React' refers to a UMD global: fine, Next injects it
    bad++;
    const { line } = sf.getLineAndCharacterOfPosition(d.start);
    console.log(`${path.relative(root, sf.fileName)}:${line + 1}  TS${d.code}  ${msg}`);
  }
}
console.log(bad ? `${bad} problem(s)` : 'typecheck: no undefined names, missing exports or missing files');
process.exit(bad ? 1 : 0);
