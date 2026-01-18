import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getBuiltinTemplates, listTemplates } from '@/app/actions/templates';
import { TemplatesPageClient } from './components/TemplatesPageClient';

/**
 * Templates Page
 *
 * Browse and manage builtin and saved templates.
 */
export default async function TemplatesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  const organizationId = session.user.currentOrganizationId;

  if (!organizationId) {
    redirect('/organization/setup');
  }

  // Fetch templates in parallel
  const [builtinResult, savedResult] = await Promise.all([
    getBuiltinTemplates(),
    listTemplates(),
  ]);

  const builtinTemplates = builtinResult.success ? builtinResult.data || [] : [];
  const savedTemplates = savedResult.success ? savedResult.data || [] : [];

  return (
    <div className="container py-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Templates</h1>
        <p className="text-muted-foreground">
          Browse builtin templates or import your own .brain files
        </p>
      </div>

      <TemplatesPageClient
        initialBuiltinTemplates={builtinTemplates}
        initialSavedTemplates={savedTemplates}
      />
    </div>
  );
}
