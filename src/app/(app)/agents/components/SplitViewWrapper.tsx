import { getTasks } from '@/app/actions/tasks';
import { AgentSplitView } from './AgentSplitView';
import type { AgentDTO } from '@/app/mappers/agent-mapper';

// AIDEV-NOTE: Server component wrapper for AgentSplitView
// Fetches tasks asynchronously, enabling React streaming

interface SplitViewWrapperProps {
  agent: AgentDTO;
}

export async function SplitViewWrapper({ agent }: SplitViewWrapperProps) {
  const tasksResult = await getTasks(agent.id);
  const tasks = tasksResult.success ? (tasksResult.data || []) : [];

  return (
    <AgentSplitView
      agent={agent}
      tasks={tasks}
    />
  );
}
