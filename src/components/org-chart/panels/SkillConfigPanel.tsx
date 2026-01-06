'use client';

/**
 * SkillConfigPanel Component
 *
 * Configuration panel for skill nodes in the org chart.
 * Shows skill details and provides "Open Editor" action.
 */

import React from 'react';
import { Sparkles, ExternalLink, Bot, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SkillConfigPanelProps {
  skill: {
    id: number;
    name: string;
    executionType?: string;
    agentId?: number | null;
  };
  agentName?: string;
  onOpenEditor: () => void;
}

export function SkillConfigPanel({
  skill,
  agentName,
  onOpenEditor,
}: SkillConfigPanelProps) {
  const isOrgScoped = skill.agentId === null || skill.agentId === undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
          <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate">{skill.name}</h3>
          {skill.executionType && (
            <Badge variant="secondary" className="mt-1 text-xs">
              {skill.executionType}
            </Badge>
          )}
        </div>
      </div>

      {/* Scope */}
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Scope
        </label>
        <div className="mt-1 flex items-center gap-2">
          {isOrgScoped ? (
            <>
              <Building2 className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Organization-level skill</span>
            </>
          ) : (
            <>
              <Bot className="h-4 w-4 text-emerald-500" />
              <span className="text-sm">
                {agentName ? `Owned by ${agentName}` : `Agent ID: ${skill.agentId}`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
        <p>
          {isOrgScoped
            ? 'This skill is available to all agents in the organization.'
            : 'This skill is private to its owning agent.'}
        </p>
      </div>

      {/* Actions */}
      <div className="pt-2 space-y-2">
        <Button onClick={onOpenEditor} className="w-full" size="sm">
          <Sparkles className="h-4 w-4 mr-2" />
          Open Skill Editor
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onOpenEditor}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in New Tab
        </Button>
      </div>
    </div>
  );
}

export default SkillConfigPanel;
