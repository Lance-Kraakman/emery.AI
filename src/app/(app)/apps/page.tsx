import { redirect } from 'next/navigation';
import { getApps } from '@/app/actions/puck-apps';

// AIDEV-NOTE: Apps list now shown in sidebar
// This page redirects to first app or mission-control

export default async function AppsPage() {
  const result = await getApps();

  // Redirect to first app if exists, otherwise to mission-control
  if (result.success && result.data && result.data.length > 0) {
    redirect(`/apps/${result.data[0].id}`);
  }

  redirect("/mission-control/dashboard");
}
