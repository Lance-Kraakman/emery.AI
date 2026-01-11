'use client';

/**
 * AgentConfigPanel Component
 *
 * Enhanced configuration panel for agent nodes in the org chart.
 * Features inline editing for name/role, automations list.
 * Modal rendering is lifted to parent (OrgChartEditorClient) for proper overlay.
 */

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, ExternalLink, Settings, Plus, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { updateAgentFromClient } from '@/app/actions/agents';
import { AutomationListItem } from '@/components/agents/shared';
import type { AutomationConfigurationDTO } from '@/app/dtos/automation.dto';

interface AgentConfigPanelProps {
  agent: {
    id: number;
    name: string;
    role?: string;
    status?: string;
    automations?: Array<{
      name?: string;
      enabled: boolean;
      skillId: number;
      trigger: { type: string; enabled: boolean };
    }>;
  };
  skillCount: number;
  databaseCount: number;
  onOpenAgent: () => void;
  getSkillName?: (skillId: number) => string | undefined;
  /** Callback to open trigger config modal (handled by parent for proper overlay) */
  onOpenTriggerModal?: (mode: 'create' | 'edit', scheduleIndex?: number) => void;
}

export function AgentConfigPanel({
  agent,
  skillCount,
  databaseCount,
  onOpenAgent,
  getSkillName,
  onOpenTriggerModal,
}: AgentConfigPanelProps) {
  const router = useRouter();

  // Inline editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [editName, setEditName] = useState(agent.name);
  const [editRole, setEditRole] = useState(agent.role || '');
  const [isSaving, setIsSaving] = useState(false);

  // Automation toggle state
  const [togglingAutomation, setTogglingAutomation] = useState<number | null>(null);

  // Handle save name
  const handleSaveName = useCallback(async () => {
    if (editName.trim() === agent.name) {
      setIsEditingName(false);
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateAgentFromClient(agent.id, { name: editName.trim() });
      if (result.success) {
        toast.success('Name updated');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to update name');
        setEditName(agent.name);
      }
    } catch (error) {
      toast.error('Failed to update name');
      setEditName(agent.name);
    } finally {
      setIsSaving(false);
      setIsEditingName(false);
    }
  }, [agent.id, agent.name, editName, router]);

  // Handle save role
  const handleSaveRole = useCallback(async () => {
    if (editRole.trim() === (agent.role || '')) {
      setIsEditingRole(false);
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateAgentFromClient(agent.id, { role: editRole.trim() });
      if (result.success) {
        toast.success('Role updated');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to update role');
        setEditRole(agent.role || '');
      }
    } catch (error) {
      toast.error('Failed to update role');
      setEditRole(agent.role || '');
    } finally {
      setIsSaving(false);
      setIsEditingRole(false);
    }
  }, [agent.id, agent.role, editRole, router]);

  // Handle automation toggle
  const handleAutomationToggle = useCallback(
    async (index: number, enabled: boolean) => {
      if (!agent.automations) return;

      setTogglingAutomation(index);
      try {
        const newAutomations = agent.automations.map((automation, i) =>
          i === index ? { ...automation, enabled } : automation
        );

        const result = await updateAgentFromClient(agent.id, {
          automations: newAutomations as any,
        });

        if (result.success) {
          toast.success(enabled ? 'Automation enabled' : 'Automation disabled');
          router.refresh();
        } else {
          toast.error(result.error || 'Failed to update automation');
        }
      } catch (error) {
        toast.error('Failed to update automation');
      } finally {
        setTogglingAutomation(null);
      }
    },
    [agent.id, agent.automations, router]
  );

  // Handle edit automation - call parent's modal handler
  const handleEditAutomation = useCallback(
    (index: number) => {
      if (onOpenTriggerModal) {
        onOpenTriggerModal('edit', index);
      } else {
        // Fallback: navigate to agent page
        onOpenAgent();
      }
    },
    [onOpenTriggerModal, onOpenAgent]
  );

  // Handle add automation - call parent's modal handler
  const handleAddAutomation = useCallback(() => {
    if (onOpenTriggerModal) {
      onOpenTriggerModal('create');
    } else {
      // Fallback: navigate to agent page
      onOpenAgent();
    }
  }, [onOpenTriggerModal, onOpenAgent]);

  // Cancel editing
  const handleCancelName = () => {
    setEditName(agent.name);
    setIsEditingName(false);
  };

  const handleCancelRole = () => {
    setEditRole(agent.role || '');
    setIsEditingRole(false);
  };

  // Count active automations
  const activeAutomations = agent.automations?.filter((a) => a.enabled).length || 0;
  const totalAutomations = agent.automations?.length || 0;

  return (
    <div className="space-y-5">
      {/* Header with inline editing */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 shrink-0">
          <Bot className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
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
              {agent.name}
            </h3>
          )}

          {/* Editable role */}
          {isEditingRole ? (
            <div className="flex items-center gap-1">
              <Input
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="h-6 text-xs"
                placeholder="Enter role..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRole();
                  if (e.key === 'Escape') handleCancelRole();
                }}
                disabled={isSaving}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                onClick={handleSaveRole}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3 text-green-600" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                onClick={handleCancelRole}
                disabled={isSaving}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <p
              className={cn(
                'text-sm truncate cursor-pointer transition-colors',
                agent.role ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/50 hover:text-muted-foreground italic'
              )}
              onClick={() => setIsEditingRole(true)}
              title="Click to edit"
            >
              {agent.role || 'Add role...'}
            </p>
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
      <div className="grid grid-cols-2 gap-3">
        <div className="p-2.5 rounded-lg bg-muted/50">
          <div className="text-xl font-bold">{skillCount}</div>
          <div className="text-xs text-muted-foreground">
            {skillCount === 1 ? 'Skill' : 'Skills'}
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-muted/50">
          <div className="text-xl font-bold">{databaseCount}</div>
          <div className="text-xs text-muted-foreground">
            {databaseCount === 1 ? 'Database' : 'Databases'}
          </div>
        </div>
      </div>

      {/* Automations section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Automations
          </label>
          <span className="text-xs text-muted-foreground">
            {activeAutomations}/{totalAutomations} active
          </span>
        </div>

        {totalAutomations === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground bg-muted/30 rounded-lg">
            No automations configured
          </div>
        ) : (
          <div className="space-y-1 bg-muted/30 rounded-lg py-1">
            {agent.automations?.map((automation, index) => (
              <AutomationListItem
                key={index}
                automation={automation as AutomationConfigurationDTO}
                index={index}
                skillName={getSkillName?.(automation.skillId)}
                onToggle={handleAutomationToggle}
                onEdit={handleEditAutomation}
                compact
              />
            ))}
          </div>
        )}

        {/* Add automation button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2"
          onClick={handleAddAutomation}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Automation
        </Button>
      </div>

      {/* Actions */}
      <div className="pt-2 space-y-2 border-t">
        <Button onClick={onOpenAgent} className="w-full" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Full Configuration
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => window.open(`/agents/${agent.id}`, '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in New Tab
        </Button>
      </div>
    </div>
  );
}

export default AgentConfigPanel;
