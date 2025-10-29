import { getAgents } from '@/app/actions/agents';
import { Suspense } from 'react';
import { Loading } from '@/components/ui/loading';
import { CanvasBase } from '@/components/canvas/CanvasBase';
import { AgentsListView } from './components/AgentsListView';

// AIDEV-NOTE: Main agents page with list/detail view pattern
// Uses AgentsListView for agent management and NewAgentDetailsView for details

export default async function AgentsPage() {
  const agents = await getAgents();

  return (
    <CanvasBase>
      <Suspense fallback={<Loading text="Loading agents..." />}>
        <AgentsListView agents={agents || []} />
      </Suspense>
    </CanvasBase>
  );
}
