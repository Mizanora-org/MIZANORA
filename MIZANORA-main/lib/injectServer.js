import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from './firebase-admin';
import { quotaTripped } from './quota';
import { INJECT_DOC, cleanInject, injectForViewer } from './inject';

// Studio settings (animations + snippets), cached and cleared when the admin saves (tag "inject").
const read = unstable_cache(async () => {
  try {
    if (!adminReady() || quotaTripped()) return { effects: [], items: [] };
    const d = await adminDb().collection(INJECT_DOC.collection).doc(INJECT_DOC.id).get();
    return injectForViewer(d.exists ? d.data() : {});
  } catch (e) { console.error('inject read failed:', e.message); return { effects: [], items: [] }; }
}, ['mz-inject-v1'], { revalidate: 600, tags: ['inject'] });
export const getInject = () => read();

// For the AI manager / admin tools: the full saved document (including switched-off snippets).
export async function readInjectDoc() {
  const d = await adminDb().collection(INJECT_DOC.collection).doc(INJECT_DOC.id).get();
  return cleanInject(d.exists ? d.data() : {});
}
export async function writeInjectDoc(doc) {
  const clean = cleanInject(doc);
  await adminDb().collection(INJECT_DOC.collection).doc(INJECT_DOC.id).set({ ...clean, updatedAtMs: Date.now() });
  return clean;
}
