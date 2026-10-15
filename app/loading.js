import PageLoader from '@/components/PageLoader';

// Shown instantly while any page is being prepared, so a tap never feels dead.
export default function Loading() {
  return <PageLoader />;
}
