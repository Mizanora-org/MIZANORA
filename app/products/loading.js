import { ListSkeleton } from '@/components/PageLoader';
// Instant, branded skeleton while the shop pages are prepared - never a blank screen.
export default function Loading() {
  return <ListSkeleton />;
}
