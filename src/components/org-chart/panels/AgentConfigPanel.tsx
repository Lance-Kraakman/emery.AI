'use client';

/**
 * AgentConfigPanel Component
 *
 * Configuration panel for agent nodes in the org chart.
 * Shows agent details and provides "Open Agent" action.
 */

import React from 'react';
import { Bot, ExternalLink, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AgentConfigPanelProps {
  agent: {
    id: number;
    name: string;
    role?: string;
    status?: string;
  };
  skillCount: number;
  databaseCount: number;
  onOpenAgent: () => void;
}

export function AgentConfigPanel({
  agent,
  skillCount,
  databaseCount,
  onOpenAgent,
}: AgentConfigPanelProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
          <Bot className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate">{agent.name}</h3>
          {agent.role && (
            <p className="text-sm text-muted-foreground truncate">{agent.role}</p>
          )}
        </div>
      </div>

      {/* Status */}
      {agent.status && (
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Status
          </label>
          <div className="mt-1">
            <Badge
              variant="outline"
              className={cn(
                agent.status === 'active' && 'border-green-500 text-green-600',
                agent.status === 'inactive' && 'border-gray-400 text-gray-500',
                agent.status === 'error' && 'border-red-500 text-red-600'
              )}
            >
              {agent.status}
            </Badge>
          </div>
        </div>
      )}

      {/* Resource counts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 rounded-lg bg-muted/50">
          <div className="text-2xl font-bold">{skillCount}</div>
          <div className="text-xs text-muted-foreground">
            {skillCount === 1 ? 'Skill' : 'Skills'}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-muted/50">
          <div className="text-2xl font-bold">{databaseCount}</div>
          <div className="text-xs text-muted-foreground">
            {databaseCount === 1 ? 'Database' : 'Databases'}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-2 space-y-2">
        <Button onClick={onOpenAgent} className="w-full" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Configure Agent
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onOpenAgent}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in New Tab
        </Button>
      </div>
    </div>
  );
}

export default AgentConfigPanel;
