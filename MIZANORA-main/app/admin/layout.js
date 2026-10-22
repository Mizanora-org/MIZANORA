import AdminGate from '@/components/AdminGate';

export const metadata = { title: 'Admin', robots: { index: false, follow: false } };

export default function AdminLayout({ children }) {
  return <AdminGate>{children}</AdminGate>;
}
