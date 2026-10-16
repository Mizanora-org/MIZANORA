import { redirect } from 'next/navigation';

// The panel opens on the dashboard (numbers first), not on the orders list.
export default function AdminIndex() {
  redirect('/admin/dashboard');
}
