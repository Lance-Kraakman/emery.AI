import { Suspense } from 'react';
import { Loading } from '@/components/ui/loading';
import OrganizationChart from './components/OrganizationChart';

// AIDEV-NOTE: Organization page refactored to use consistent design patterns and improved loading states
// AIDEV-NOTE: Page is dynamic due to session/organization context requirements

export const dynamic = 'force-dynamic';

export default async function OrganizationPage() {
  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<Loading text="Loading organization chart..." />}>
          <OrganizationChart />
        </Suspense>
      </div>
    </div>
  );
}
