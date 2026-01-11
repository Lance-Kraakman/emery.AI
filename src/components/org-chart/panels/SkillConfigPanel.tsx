'use client';

/**
 * SkillConfigPanel Component
 *
 * Enhanced configuration panel for skill nodes in the org chart.
 * Features inline name editing, execution type display, and I/O connection config.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ExternalLink,
  Bot,
  Building2,
  Check,
  X,
  Loader2,
  Database,
  ChevronDown,
  ChevronRight,
  Table2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { updateSkill } from '@/app/actions/skills';

/** Edge passed from selection (already filtered to this skill) */
interface SelectedEdge {
  id: string;
  target: string;  // e.g., "database-123" or "skill-456"
  edgeType: string; // "skill_table" or "skill_ref"
}

/** Parsed connection for display */
interface SkillConnection {
  edgeId: string;
  edgeType: 'skill_table' | 'skill_ref';
  targetId: number;
  targetName: string;
  targetType: 'database' | 'skill';
  tables?: Array<{ id: number; name: string }>;
}

interface SkillConfigPanelProps {
  skill: {
    id: number;
    name: string;
    executionType?: string;
    agentId?: number | null;
  };
  agentName?: string;
  onOpenEditor: () => void;
  /** Edges connected to this skill (already filtered, from selection) */
  edges?: SelectedEdge[];
  /** Database info for connected databases */
  databases?: Array<{
    id: number;
    name: string;
    tables?: Array<{ id: number; name: string }>;
  }>;
  /** Skill info for connected skills */
  connectedSkills?: Array<{ id: number; name: string }>;
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

/**
 * ConnectionItem - Shows a single connection (database or skill)
 */
function ConnectionItem({ connection }: { connection: SkillConnection }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = connection.targetType === 'database' ? Database : Sparkles;
  const iconColor =
    connection.targetType === 'database' ? 'text-cyan-500' : 'text-violet-500';
  const bgColor =
    connection.targetType === 'database'
      ? 'bg-cyan-50 dark:bg-cyan-900/20'
      : 'bg-violet-50 dark:bg-violet-900/20';

  return (
    <div className={cn('rounded-lg border', bgColor)}>
      {/* Header - clickable to expand */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors rounded-lg"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <Icon className={cn('h-4 w-4 shrink-0', iconColor)} />
        <span className="text-sm font-medium truncate flex-1">
          {connection.targetName}
        </span>
        <Badge
          variant="outline"
          className="text-[10px] shrink-0"
        >
          {connection.edgeType === 'skill_ref' ? 'skill ref' : 'data'}
        </Badge>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/50">
          {connection.targetType === 'database' && connection.tables && (
            <div className="space-y-2">
              <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Tables
              </label>
              {connection.tables.length > 0 ? (
                <div className="space-y-1">
                  {connection.tables.slice(0, 5).map((table) => (
                    <div
                      key={table.id}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <Table2 className="h-3 w-3 text-cyan-500" />
                      <span className="truncate">{table.name}</span>
                    </div>
                  ))}
                  {connection.tables.length > 5 && (
                    <span className="text-[10px] text-muted-foreground/60 pl-5">
                      +{connection.tables.length - 5} more
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic">
                  No tables in database
                </p>
              )}
              <p className="text-[10px] text-muted-foreground/60 mt-2">
                Configure field mappings in the skill editor.
              </p>
            </div>
          )}

          {connection.targetType === 'skill' && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                This skill references{' '}
                <span className="font-medium">{connection.targetName}</span>.
              </p>
              <p className="text-[10px] text-muted-foreground/60">
                Configure I/O mappings in the skill editor.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SkillConfigPanel({
  skill,
  agentName,
  onOpenEditor,
  edges = [],
  databases = [],
  connectedSkills = [],
}: SkillConfigPanelProps) {
  const router = useRouter();
  const isOrgScoped = skill.agentId === null || skill.agentId === undefined;

  // Build connections from edges (edges are already filtered to this skill)
  const connections = useMemo((): SkillConnection[] => {
    console.log('[SkillConfigPanel] edges received:', edges);
    console.log('[SkillConfigPanel] databases:', databases);
    console.log('[SkillConfigPanel] connectedSkills:', connectedSkills);

    if (!edges || edges.length === 0) return [];

    return edges.map((edge) => {
      const edgeType = edge.edgeType === 'skill_ref' ? 'skill_ref' : 'skill_table';

      // Determine target type and ID from target string (e.g., "database-123")
      const isSkillRef = edge.target.startsWith('skill-');
      const targetType: 'database' | 'skill' = isSkillRef ? 'skill' : 'database';
      const targetId = parseInt(edge.target.split('-')[1], 10);

      // Look up name and tables from passed-in data
      let targetName = 'Unknown';
      let tables: Array<{ id: number; name: string }> | undefined;

      if (targetType === 'database') {
        const db = databases.find((d) => d.id === targetId);
        targetName = db?.name || 'Unknown Database';
        tables = db?.tables;
      } else {
        const sk = connectedSkills.find((s) => s.id === targetId);
        targetName = sk?.name || 'Unknown Skill';
      }

      return {
        edgeId: edge.id,
        edgeType,
        targetId,
        targetName,
        targetType,
        tables,
      };
    });
  }, [edges, databases, connectedSkills]);

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

      {/* Inputs/Outputs Section */}
      {connections.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            Inputs / Outputs
          </h4>
          <div className="space-y-2">
            {connections.map((conn) => (
              <ConnectionItem key={conn.edgeId} connection={conn} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state for connections */}
      {connections.length === 0 && (
        <div className="border-t pt-4">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Inputs / Outputs
          </h4>
          <p className="text-xs text-muted-foreground/60 italic">
            Drag from this skill to a database or another skill to create connections.
          </p>
        </div>
      )}

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
