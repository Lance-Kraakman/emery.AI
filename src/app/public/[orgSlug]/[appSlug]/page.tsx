import { redirect, notFound } from 'next/navigation';
import { getPublicApp } from '@/app/actions/public-pages';

interface PublicAppRootPageProps {
  params: Promise<{
    orgSlug: string;
    appSlug: string;
  }>;
}

export default async function PublicAppRootPage({ params }: PublicAppRootPageProps) {
  const { orgSlug, appSlug } = await params;

  // Fetch app data
  const appResult = await getPublicApp(orgSlug, appSlug);

  if (!appResult.success || !appResult.data) {
    notFound();
  }

  const app = appResult.data;

  // If app has a home page set, redirect to it
  if (app.homePageSlug) {
    redirect(`/public/${orgSlug}/${appSlug}/${app.homePageSlug}`);
  }

  // No home page set - show a friendly message
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md p-8">
        <h1 className="text-3xl font-bold mb-4 text-gray-900">{app.name}</h1>
        {app.description && (
          <p className="text-gray-600 mb-6">{app.description}</p>
        )}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            This app doesn't have a home page configured yet.
          </p>
        </div>
        <p className="text-sm text-gray-500">
          Contact the app administrator to set up a home page.
        </p>
      </div>
    </div>
  );
}
