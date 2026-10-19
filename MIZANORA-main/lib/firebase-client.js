import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseCfg, firebaseConfigured } from './firebase-config';

export { firebaseConfigured };
export const firebaseApp = () => (getApps().length ? getApp() : initializeApp(firebaseCfg));
export const authClient = () => getAuth(firebaseApp());
export const dbClient = () => getFirestore(firebaseApp());
