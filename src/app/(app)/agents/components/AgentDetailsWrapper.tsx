'use client';

// AIDEV-NOTE: Client wrapper for NewAgentDetailsView to handle routing
// Provides refresh on update

import { useRouter } from 'next/navigation';
import { NewAgentDetailsView } from './NewAgentDetailsView';
import type { AgentDTO } from '@/app/mappers/agent-mapper';

interface AgentDetailsWrapperProps {
  agent: AgentDTO;
}

export function AgentDetailsWrapper({ agent }: AgentDetailsWrapperProps) {
  const router = useRouter();

  const handleUpdate = () => {
    router.refresh(); // Refresh server data
  };

  return (
    <NewAgentDetailsView
      agent={agent}
      onUpdate={handleUpdate}
    />
  );
}
