'use client';

// AIDEV-NOTE: Client wrapper for NewAgentDetailsView to handle routing
// Provides onBack navigation to /agents

import { useRouter } from 'next/navigation';
import { NewAgentDetailsView } from './NewAgentDetailsView';
import type { AgentDTO } from '@/app/mappers/agent-mapper';

interface AgentDetailsWrapperProps {
  agent: AgentDTO;
}

export function AgentDetailsWrapper({ agent }: AgentDetailsWrapperProps) {
  const router = useRouter();

  const handleBack = () => {
    router.push('/agents');
  };

  const handleUpdate = () => {
    router.refresh(); // Refresh server data
  };

  return (
    <NewAgentDetailsView
      agent={agent}
      onBack={handleBack}
      onUpdate={handleUpdate}
    />
  );
}
