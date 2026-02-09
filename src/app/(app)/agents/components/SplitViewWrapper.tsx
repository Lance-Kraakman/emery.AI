import { getTasks } from '@/app/actions/tasks';
import { AgentSplitView } from './AgentSplitView';
import type { AutomationConfigurationDTO } from '@/app/dtos/automation.dto';

// AIDEV-NOTE: Server component wrapper for AgentSplitView
// Fetches tasks asynchronously, enabling React streaming

interface SplitViewWrapperProps {
  agentId: number;
  automations: AutomationConfigurationDTO[];
}

export async function SplitViewWrapper({ agentId, automations }: SplitViewWrapperProps) {
  const tasksResult = await getTasks(agentId);
  const tasks = tasksResult.success ? (tasksResult.data || []) : [];

  return (
    <AgentSplitView
      agentId={agentId}
      tasks={tasks}
      automations={automations}
    />
  );
}
