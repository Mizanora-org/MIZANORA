'use client';
import { useEffect } from 'react';
import { readAttribution, saveAttribution } from '@/lib/attribution';

// Remembers where a visitor came from (Facebook ad, Instagram bio, Google, WhatsApp ...) so each order shows its source.
export default function Attribution() {
  useEffect(() => { try { saveAttribution(window.location.search, document.referrer); readAttribution(); } catch (_) {} }, []);
  return null;
}
