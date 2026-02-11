'use client';

// AIDEV-NOTE: Client wrapper for NewAgentDetailsView to handle routing
// Provides refresh on update
// NOTE: This component is no longer used - replaced by streaming architecture in page.tsx

import { useRouter } from 'next/navigation';
import { NewAgentDetailsView } from './NewAgentDetailsView';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { TaskDTO } from '@/app/mappers/task-mapper';
import type { SkillDTO } from '@/app/mappers/skill-mapper';

interface AgentDetailsWrapperProps {
  agent: AgentDTO;
  tasks: TaskDTO[];
  skills: SkillDTO[];
  connectionCount: number;
}

export function AgentDetailsWrapper({ agent, tasks, skills, connectionCount }: AgentDetailsWrapperProps) {
  const router = useRouter();

  const handleUpdate = () => {
    router.refresh(); // Refresh server data
  };

  return (
    <NewAgentDetailsView
      agent={agent}
      tasks={tasks}
      skills={skills}
      connectionCount={connectionCount}
      onUpdate={handleUpdate}
    />
  );
}
