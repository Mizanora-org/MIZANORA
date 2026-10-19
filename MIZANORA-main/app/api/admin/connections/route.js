import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady, adminRtdb, rtdbUrl } from '@/lib/firebase-admin';
import { rtdbOn, rtdbPublicGet } from '@/lib/rtdb';
import { restReady, restListPage } from '@/lib/firestore-rest';
import { ghReady, ghInfo, ghTest } from '@/lib/github';
import { quotaTripped } from '@/lib/quota';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Admin only. THE REAL CONNECTION TEST for the whole back office (Admin > Connections).
// Every test actually talks to the service and says in plain words what to fix when it fails.
// Read-only except for one tiny document that is written and deleted again immediately (_health/conn):
//   firestoreSdk   Firestore through the service account (orders, admin saves)
//   firestoreRest  Firestore through the browser key (public reads when the server key is missing)
//   rtdbSdk        Realtime Database through the service account (visitors, counters, order backup)
//   rtdbRest       Realtime Database through its REST API (the copy the shut-down switch is read from)
//   github         repository + branch + push permission (needed for CSV -> archive and Admin > Archive)
const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

const timed = async (fn) => {
  const t = Date.now();
  try { const value = await fn(); return { ok: true, ms: Date.now() - t, ...(value && typeof value === 'object' ? value : { value }) }; }
  catch (e) { return { ok: false, ms: Date.now() - t, error: String((e && e.message) || e).slice(0, 220) }; }
};

// Same plain-language mapping the health endpoint uses, so both screens agree.
const plainFirestore = (m) => {
  if (/private key|PEM|DECODER|asn1|parse/i.test(m)) return 'The private key is pasted wrongly. Use FIREBASE_SERVICE_ACCOUNT with the whole JSON file instead.';
  if (/UNAUTHENTICATED|invalid_grant|16 /i.test(m)) return 'Firebase rejected the key. Generate a new private key (Project settings > Service accounts) and paste it again.';
  if (/PERMISSION_DENIED|7 /i.test(m)) return 'This service account has no permission. Use the key from the same Firebase project.';
  if (/NOT_FOUND|5 /i.test(m)) return 'Firestore database is not created yet. Firebase Console > Firestore Database > Create database.';
  if (/RESOURCE_EXHAUSTED|quota|8 /i.test(m)) return 'The free Firestore quota for today is used up. It resets about midnight Pacific time; move old products to the archive to stop this happening.';
  return `Firebase error: ${m.slice(0, 160)}`;
};

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);

  // ---- Firestore through the service account (write + read + delete one tiny doc) ----
  const firestoreSdk = adminReady()
    ? await timed(async () => {
      const ref = adminDb().collection('_health').doc('conn');
      await ref.set({ at: Date.now(), by: a.uid || '' });
      const snap = await ref.get();
      await ref.delete();
      let products = null;
      try { products = Number((await adminDb().collection('products').count().get()).data().count) || 0; } catch { /* count is a bonus */ }
      return { docs: snap.exists ? 1 : 0, products, project: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '' };
    })
    : { ok: false, ms: 0, error: 'FIREBASE_SERVICE_ACCOUNT (or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY) is missing in Vercel.' };
  if (!firestoreSdk.ok && !/missing in Vercel/.test(firestoreSdk.error || '')) firestoreSdk.fix = plainFirestore(firestoreSdk.error || '');

  // ---- Firestore through the public/browser key (the fallback path for public reads) ----
  const firestoreRest = restReady()
    ? await timed(async () => {
      const r = await restListPage('products', 1, '');
      return { docs: r.docs.length, next: Boolean(r.next), project: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '' };
    })
    : { ok: false, ms: 0, error: 'NEXT_PUBLIC_FIREBASE_API_KEY or NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing in Vercel.' };
  if (!firestoreRest.ok && restReady()) {
    firestoreRest.fix = /403|permission/i.test(firestoreRest.error || '')
      ? 'The browser key cannot read products. Check firestore.rules (products must be readable by anyone) and that the key belongs to this project.'
      : 'Check the API key and your network. This path is only the fallback for public reads; orders and the admin panel use the service account.';
  }

  // ---- Realtime Database through the service account ----
  const rtdbSdk = rtdbOn()
    ? await timed(async () => {
      const ref = adminRtdb().ref('_health/conn');
      await ref.set({ at: Date.now() });
      const v = (await ref.get()).val();
      await ref.remove();
      return { url: rtdbUrl(), read: Boolean(v), seen: Boolean(v && v.at) };
    })
    : { ok: false, ms: 0, error: 'The Realtime Database is not configured. Create it in Firebase Console > Build > Realtime Database, then set FIREBASE_DATABASE_URL if its address is not https://PROJECT-default-rtdb.firebaseio.com and redeploy.' };

  // ---- Realtime Database over its REST API (this is the copy the shop reads first) ----
  const rtdbRest = rtdbUrl()
    ? await timed(async () => {
      const v = await rtdbPublicGet('siteStatus', 4000);
      return { url: rtdbUrl(), hasStatus: Boolean(v), mode: (v && v.mode) || '' };
    })
    : { ok: false, ms: 0, error: 'No Realtime Database address (FIREBASE_DATABASE_URL / NEXT_PUBLIC_FIREBASE_DATABASE_URL or a project id to derive it from).' };
  if (!rtdbRest.ok && rtdbUrl()) {
    rtdbRest.fix = /401|403|permission/i.test(rtdbRest.error || '')
      ? 'Publish database.rules.json in Firebase Console > Realtime Database > Rules (the shop must be allowed to read siteStatus, stats, presence).'
      : 'If the database address is not https://PROJECT-default-rtdb.firebaseio.com, put the real one in FIREBASE_DATABASE_URL and NEXT_PUBLIC_FIREBASE_DATABASE_URL and redeploy.';
  }

  // ---- GitHub (CSV to archive + Admin > Archive) ----
  const github = ghReady()
    ? await timed(async () => {
      const t = await ghTest();
      if (!t.ok) throw new Error(t.error);
      return { repo: t.repo, branch: t.branch, defaultBranch: t.defaultBranch, private: t.private, canPush: t.canPush, head: t.head };
    })
    : { ok: false, ms: 0, error: 'GITHUB_TOKEN and GITHUB_REPO are not set in Vercel. Without them the CSV import can still save to Firebase, and Admin > Archive can only download files for you to upload by hand (data/catalog).' };
  if (github.ok && github.canPush === false) github.fix = 'The token can read but not write. Make it Contents: Read and write for this repository, otherwise the archive commit will fail.';

  // ---- Summary ----
  const p = process.env;
  const config = {
    project: p.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    webKey: Boolean(p.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: Boolean(p.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    appId: Boolean(p.NEXT_PUBLIC_FIREBASE_APP_ID),
    adminKey: adminReady(),
    databaseUrl: rtdbUrl(),
    databaseUrlFromEnv: Boolean(p.FIREBASE_DATABASE_URL || p.NEXT_PUBLIC_FIREBASE_DATABASE_URL),
    github: { ...ghInfo(), ready: ghReady() },
    imgbb: Boolean(p.IMGBB_API_KEY),
    gemini: Boolean(p.GEMINI_API_KEY),
    metaPixel: Boolean(p.NEXT_PUBLIC_META_PIXEL_ID),
    metaCapi: Boolean(p.META_CAPI_TOKEN),
    siteUrl: p.NEXT_PUBLIC_SITE_URL || '',
    storeWindow: Number(p.STORE_WINDOW) || 2500,
    adminEmails: (p.NEXT_PUBLIC_ADMIN_EMAIL || '') ? String(p.NEXT_PUBLIC_ADMIN_EMAIL).split(',').map((s) => s.trim()).filter(Boolean).length : 0,
  };

  // CSV import: what can it actually do right now? (this is what "link the product CSV" depends on)
  const csv = github.ok
    ? { mode: 'archive', text: 'Big CSV files can be committed straight into data/catalog of your repository (500 products per part), so the free Firestore quota is never touched. Small files can still go to Firebase.', link: '/admin/import' }
    : { mode: 'firebase', text: stillOnFirestore(firestoreSdk), link: '/admin/import' };

  const critical = { firestore: firestoreSdk.ok || firestoreRest.ok, rtdb: rtdbSdk.ok, github: github.ok };
  return json({
    ok: true,
    at: Date.now(),
    verdict: critical.firestore ? (critical.rtdb ? 'healthy' : 'partial') : 'broken',
    critical,
    quotaTripped: quotaTripped(),
    firestoreSdk, firestoreRest, rtdbSdk, rtdbRest, github, config, csv,
  });
}

// One honest sentence about the Firestore path when GitHub is not connected.
function stillOnFirestore(f) {
  return f.ok
    ? 'The CSV import saves into Firebase (Firestore). That is fine up to about 1,000-2,500 live products. Connect GITHUB_TOKEN + GITHUB_REPO to also use the archive for 50,000+ products.'
    : 'The CSV import needs Firestore: add FIREBASE_SERVICE_ACCOUNT in Vercel first. (GITHUB_TOKEN + GITHUB_REPO additionally unlock the archive.)';
}
