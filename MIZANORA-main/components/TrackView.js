'use client';
import { useEffect } from 'react';
import { viewContent } from '@/lib/metaPixel';
import { pushRecent } from '@/lib/recent';

export default function TrackView({ product }) {
  useEffect(() => { viewContent(product); pushRecent(product.id); }, [product]);
  return null;
}
