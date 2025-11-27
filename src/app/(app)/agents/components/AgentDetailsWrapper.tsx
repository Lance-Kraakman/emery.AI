'use client';

// AIDEV-NOTE: Client wrapper for NewAgentDetailsView to handle routing
// Provides refresh on update

import { useRouter } from 'next/navigation';
import { NewAgentDetailsView } from './NewAgentDetailsView';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { TaskDTO } from '@/app/mappers/task-mapper';
import type { SkillDTO } from '@/app/mappers/skill-mapper';
import type { ConnectionDTO } from '@/app/mappers/connection-mapper';

interface AgentDetailsWrapperProps {
  agent: AgentDTO;
  tasks: TaskDTO[];
  skills: SkillDTO[];
  connections: ConnectionDTO[];
}

export function AgentDetailsWrapper({ agent, tasks, skills, connections }: AgentDetailsWrapperProps) {
  const router = useRouter();

  const handleUpdate = () => {
    router.refresh(); // Refresh server data
  };

  return (
    <NewAgentDetailsView
      agent={agent}
      tasks={tasks}
      skills={skills}
      connections={connections}
      onUpdate={handleUpdate}
    />
  );
}
