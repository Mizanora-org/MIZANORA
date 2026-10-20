'use client';
import { useEffect, useRef } from 'react';
import { useAuth } from './AuthProvider';
import { getWish, setWish } from '@/lib/wish';

// When a shopper is signed in, the wishlist is merged with the one saved on the account (Firestore users/{uid}.wishlist) and every
// change is saved back after a short pause. Signed out: nothing happens, the list stays on the device.
export default function WishSync() {
  const { user } = useAuth();
  const uid = user ? user.uid : '';
  const ready = useRef('');
  useEffect(() => {
    if (!uid) { ready.current = ''; return undefined; }
    let dead = false, timer = 0;
    const save = async () => {
      try {
        const [{ doc, setDoc }, { dbClient }] = await Promise.all([import('firebase/firestore'), import('@/lib/firebase-client')]);
        await setDoc(doc(dbClient(), 'users', uid), { wishlist: getWish(), wishlistAtMs: Date.now() }, { merge: true });
      } catch { /* the device copy is still safe */ }
    };
    const later = () => { clearTimeout(timer); timer = setTimeout(save, 900); };
    (async () => {
      try {
        const [{ doc, getDoc }, { dbClient }] = await Promise.all([import('firebase/firestore'), import('@/lib/firebase-client')]);
        const s = await getDoc(doc(dbClient(), 'users', uid));
        if (dead) return;
        const cloud = s.exists() && Array.isArray(s.data().wishlist) ? s.data().wishlist : [];
        const merged = [...new Set([...getWish(), ...cloud.map(String)])];
        setWish(merged);
        ready.current = uid;
        if (merged.length !== cloud.length) later();
      } catch { /* offline: try again on the next change */ ready.current = uid; }
    })();
    const onChange = () => { if (ready.current === uid) later(); };
    window.addEventListener('mz-wish', onChange);
    return () => { dead = true; clearTimeout(timer); window.removeEventListener('mz-wish', onChange); };
  }, [uid]);
  return null;
}
