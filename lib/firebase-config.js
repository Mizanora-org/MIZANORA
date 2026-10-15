// Plain settings only (no Firebase SDK is imported here), so shop pages can check "is Firebase set up?" without loading it.
export const firebaseCfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
export const firebaseConfigured = Boolean(firebaseCfg.apiKey && firebaseCfg.projectId);
