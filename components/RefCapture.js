'use client';
import { useEffect } from 'react';
import { captureRef } from '@/lib/refClient';

export default function RefCapture() {
  useEffect(() => { captureRef(); }, []);
  return null;
}
