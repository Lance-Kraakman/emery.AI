import { getTasks } from '@/app/actions/tasks';
import { AgentExecutionTimeline } from '@/components/timeline/AgentExecutionTimeline';
import type { AutomationConfigurationDTO } from '@/app/dtos/automation.dto';

// AIDEV-NOTE: Server component wrapper for AgentExecutionTimeline
// Fetches tasks asynchronously, enabling React streaming

interface TimelineWrapperProps {
  agentId: number;
  schedules?: AutomationConfigurationDTO[];
}

export async function TimelineWrapper({ agentId, schedules = [] }: TimelineWrapperProps) {
  const tasksResult = await getTasks(agentId);
  const tasks = tasksResult.success ? (tasksResult.data || []) : [];

  return (
    <div className="flex-1 overflow-hidden">
      <AgentExecutionTimeline
        tasks={tasks}
        schedules={schedules}
      />
    </div>
  );
}
