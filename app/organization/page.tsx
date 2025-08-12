import dynamic from 'next/dynamic';
import { Loading } from '@/components/ui/loading';

// AIDEV-NOTE: Organization page refactored to use dynamic imports for ReactFlow component
// AIDEV-NOTE: This prevents hydration issues with client-only ReactFlow components
// AIDEV-NOTE: Page is dynamic due to session/organization context requirements

const OrganizationChart = dynamic(() => import('./components/OrganizationChartClient'), {
  ssr: false, // ReactFlow needs to run client-side only
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <Loading text="Loading organization chart..." />
    </div>
  )
});

export const dynamic = 'force-dynamic';

export default async function OrganizationPage() {
  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 overflow-hidden">
        <OrganizationChart />
      </div>
    </div>
  );
}
