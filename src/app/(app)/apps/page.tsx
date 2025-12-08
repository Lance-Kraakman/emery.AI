import { redirect } from 'next/navigation';
import { getApps } from '@/app/actions/puck-apps';

// AIDEV-NOTE: Apps list now shown in sidebar
// This page redirects to first app or shows empty state

export default async function AppsPage() {
  const result = await getApps();

  // Redirect to first app if exists
  if (result.success && result.data && result.data.length > 0) {
    redirect(`/apps/${result.data[0].id}`);
  }

  // No apps - stay on /apps (will show empty state or prompt to create)
  return null;
}
