'use client';

/**
 * SkillConfigPanel Component
 *
 * Enhanced configuration panel for skill nodes in the org chart.
 * Features inline name editing and execution type display.
 */

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ExternalLink, Bot, Building2, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { updateSkill } from '@/app/actions/skills';

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

/** Get badge color based on execution type */
function getExecutionTypeBadgeColor(executionType?: string): string {
  const colors: Record<string, string> = {
    agentic: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
    tool: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    read: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
    write: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
    operation: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  };
  return colors[executionType || 'agentic'] || colors.agentic;
}

export function SkillConfigPanel({
  skill,
  agentName,
  onOpenEditor,
}: SkillConfigPanelProps) {
  const router = useRouter();
  const isOrgScoped = skill.agentId === null || skill.agentId === undefined;

  // Inline editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(skill.name);
  const [isSaving, setIsSaving] = useState(false);

  // Handle save name
  const handleSaveName = useCallback(async () => {
    if (editName.trim() === skill.name) {
      setIsEditingName(false);
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateSkill(skill.id, { name: editName.trim() });
      if (result.success) {
        toast.success('Skill name updated');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to update name');
        setEditName(skill.name);
      }
    } catch (error) {
      toast.error('Failed to update name');
      setEditName(skill.name);
    } finally {
      setIsSaving(false);
      setIsEditingName(false);
    }
  }, [skill.id, skill.name, editName, router]);

  // Cancel editing
  const handleCancelName = () => {
    setEditName(skill.name);
    setIsEditingName(false);
  };

  // Build the correct URL for opening the skill
  const getSkillUrl = () => {
    if (skill.agentId) {
      return `/agents/${skill.agentId}/skills?skillId=${skill.id}`;
    }
    return `/skills/${skill.id}`;
  };

  return (
    <div className="space-y-5">
      {/* Header with inline editing */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30 shrink-0">
          <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Editable name */}
          {isEditingName ? (
            <div className="flex items-center gap-1">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-7 text-sm font-semibold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') handleCancelName();
                }}
                disabled={isSaving}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={handleSaveName}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={handleCancelName}
                disabled={isSaving}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <h3
              className="font-semibold text-base truncate cursor-pointer hover:text-primary transition-colors"
              onClick={() => setIsEditingName(true)}
              title="Click to edit"
            >
              {skill.name}
            </h3>
          )}

          {/* Execution type badge */}
          {skill.executionType && (
            <Badge
              variant="secondary"
              className={cn('text-xs', getExecutionTypeBadgeColor(skill.executionType))}
            >
              {skill.executionType}
            </Badge>
          )}
        </div>
      </div>

      {/* Scope badge */}
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Scope
        </label>
        <div className="mt-1.5">
          <div
            className={cn(
              'inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm',
              isOrgScoped
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            )}
          >
            {isOrgScoped ? (
              <>
                <Building2 className="h-4 w-4" />
                <span>Organization-level</span>
              </>
            ) : (
              <>
                <Bot className="h-4 w-4" />
                <span>{agentName || `Agent #${skill.agentId}`}</span>
              </>
            )}
          </div>
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
      <div className="pt-2 space-y-2 border-t">
        <Button onClick={onOpenEditor} className="w-full" size="sm">
          <Sparkles className="h-4 w-4 mr-2" />
          Open Skill Editor
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => window.open(getSkillUrl(), '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in New Tab
        </Button>
      </div>
    </div>
  );
}

export default SkillConfigPanel;
