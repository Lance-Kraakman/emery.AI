'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FolderOpen, Zap, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TaskListItem } from '../tasks/TaskListItem';
import { AutomationsSection } from '../automations/AutomationsSection';
import { WorkspaceSection } from '../workspace/WorkspaceSection';
import type { TaskDTO } from '@/app/mappers/task-mapper';
import type { AutomationConfigurationDTO } from '@/app/dtos/automation.dto';

// AIDEV-NOTE: Left panel of split view
// Contains: Tasks list (primary) + collapsible Workspace & Automations sections

interface LeftPanelProps {
  agentId: number;
  tasks: TaskDTO[];
  automations: AutomationConfigurationDTO[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string | null) => void;
}

export function LeftPanel({
  agentId,
  tasks,
  automations,
  selectedTaskId,
  onSelectTask,
}: LeftPanelProps) {
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [automationsOpen, setAutomationsOpen] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Tasks Section - Primary */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <h3 className="text-sm font-medium">Tasks</h3>
          <span className="text-xs text-muted-foreground">{tasks.length}</span>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No tasks yet
              </div>
            ) : (
              tasks.map((task) => (
                <TaskListItem
                  key={task.id}
                  task={task}
                  isSelected={task.id === selectedTaskId}
                  onSelect={() => onSelectTask(task.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Collapsible Sections */}
      <div className="border-t border-border">
        {/* Workspace Section */}
        <Collapsible open={workspaceOpen} onOpenChange={setWorkspaceOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-accent transition-colors">
              <div className="flex items-center gap-2">
                {workspaceOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <FolderOpen className="h-4 w-4" />
                <span>Workspace</span>
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <WorkspaceSection agentId={agentId} />
          </CollapsibleContent>
        </Collapsible>

        {/* Automations Section */}
        <Collapsible open={automationsOpen} onOpenChange={setAutomationsOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-accent transition-colors border-t border-border">
              <div className="flex items-center gap-2">
                {automationsOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Zap className="h-4 w-4" />
                <span>Automations</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {automations.filter(a => a.enabled).length}
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <AutomationsSection automations={automations} />
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
