'use client';

import React, { useState, useEffect } from 'react';
import { LeftPanel } from './panels/LeftPanel';
import { RightPanel } from './panels/RightPanel';
import type { TaskDTO } from '@/app/mappers/task-mapper';
import type { AutomationConfigurationDTO } from '@/app/dtos/automation.dto';

// AIDEV-NOTE: Main split view layout for agent detail page
// Left panel: Tasks list + collapsible Workspace & Automations sections
// Right panel: Task detail with execution steps

interface AgentSplitViewProps {
  agentId: number;
  tasks: TaskDTO[];
  automations: AutomationConfigurationDTO[];
}

export function AgentSplitView({ agentId, tasks, automations }: AgentSplitViewProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    tasks.length > 0 ? tasks[0].id : null
  );

  // Validate selectedTaskId when tasks list changes
  // If the selected task is no longer in the list, select the first available task
  useEffect(() => {
    if (selectedTaskId) {
      const taskExists = tasks.some(t => t.id === selectedTaskId);
      if (!taskExists) {
        // Selected task was deleted or no longer available, select first task
        setSelectedTaskId(tasks.length > 0 ? tasks[0].id : null);
      }
    } else if (tasks.length > 0 && !selectedTaskId) {
      // No task selected but tasks exist, select the first one
      setSelectedTaskId(tasks[0].id);
    }
  }, [tasks, selectedTaskId]);

  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Panel - Tasks + collapsible sections */}
      <div className="w-80 min-w-80 border-r border-border flex flex-col overflow-hidden">
        <LeftPanel
          agentId={agentId}
          tasks={tasks}
          automations={automations}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
        />
      </div>

      {/* Right Panel - Task detail */}
      <div className="flex-1 overflow-hidden">
        <RightPanel
          task={selectedTask}
          agentId={agentId}
        />
      </div>
    </div>
  );
}
