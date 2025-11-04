'use client';

import React, { useState } from 'react';
import { BaseModal } from './BaseModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Database,
  Globe,
  Zap,
  Plus,
  Edit2,
  Trash2,
  Power,
  PowerOff,
  AlertCircle
} from 'lucide-react';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { ScheduleConfigurationDTO } from '@/app/dtos/schedule.dto';
import type { TriggerConfig } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import {
  isCalendarTrigger,
  isDatabaseEventTrigger,
  isWebhookTrigger,
  getTriggerTypeLabel
} from '../trigger-utils';
import { updateAgentFromClient } from '@/app/actions/agents';
import { TriggerConfigModal } from './TriggerConfigModal';

interface ScheduleManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentDTO;
  onUpdate?: () => void;
}

interface ScheduleCardProps {
  schedule: ScheduleConfigurationDTO;
  index: number;
  totalCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  isDeleting: boolean;
  isToggling: boolean;
}

function getScheduleIcon(schedule: ScheduleConfigurationDTO) {
  const trigger = schedule.trigger;
  switch (trigger.type) {
    case 'CALENDAR':
      return Calendar;
    case 'DATABASE_EVENT':
      return Database;
    case 'WEBHOOK':
      return Globe;
    default:
      return Calendar;
  }
}

function getScheduleSummary(schedule: ScheduleConfigurationDTO): string {
  const trigger = schedule.trigger;

  if (trigger.type === 'CALENDAR') {
    const rrule = trigger.rrule || 'Not configured';
    const timezone = trigger.timezone || 'UTC';
    return `${rrule} (${timezone})`;
  }

  if (trigger.type === 'DATABASE_EVENT') {
    const ops = trigger.operations?.join(', ') || 'No operations';
    const table = trigger.tableId ? `on table ${trigger.tableId}` : 'No table selected';
    return `${ops} ${table}`;
  }

  if (trigger.type === 'WEBHOOK') {
    const hasSecret = trigger.webhookSecret ? 'Secured' : 'Unsecured';
    const signature = trigger.requiresSignature ? ' • Signature required' : '';
    return `${hasSecret}${signature}`;
  }

  return 'Unknown schedule type';
}

function ScheduleCard({
  schedule,
  index,
  totalCount,
  onEdit,
  onDelete,
  onToggle,
  isDeleting,
  isToggling
}: ScheduleCardProps) {
  const Icon = getScheduleIcon(schedule);
  const summary = getScheduleSummary(schedule);
  const isEnabled = schedule.enabled !== false; // Default to enabled if not specified

  // AIDEV-NOTE: Access new ScheduleConfigurationDTO fields with type guards for migration compatibility
  // @ts-ignore - schedule may have new fields during migration
  const scheduleName = schedule.name;
  // @ts-ignore - schedule may have taskInstructions during migration
  const taskInstructions = schedule.taskInstructions?.instructions;
  // @ts-ignore - schedule may have taskInstructions during migration
  const toolsCount = schedule.taskInstructions?.tools?.length || 0;

  return (
    <Card className="mb-3">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-sm font-medium">
                {scheduleName || `Schedule ${index + 1} of ${totalCount}`}
              </CardTitle>
              <div className="flex gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {getTriggerTypeLabel(schedule.trigger.type)}
                </Badge>
                {toolsCount > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {toolsCount} tool{toolsCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant={isEnabled ? 'default' : 'outline'} className="text-xs">
              {isEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Task Instructions Preview */}
        {taskInstructions && (
          <div className="mb-3">
            <p className="text-xs text-muted-foreground mb-1">Task:</p>
            <p className="text-sm line-clamp-2">
              {taskInstructions}
            </p>
          </div>
        )}

        {/* Trigger Configuration Summary */}
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1">Trigger:</p>
          <p className="text-sm text-muted-foreground line-clamp-1">
            {summary}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onEdit}
            className="flex-1"
          >
            <Edit2 className="w-3 h-3 mr-1" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onToggle}
            disabled={isToggling}
            title={isEnabled ? 'Disable schedule' : 'Enable schedule'}
          >
            {isToggling ? (
              <PowerOff className="w-3 h-3 animate-pulse" />
            ) : isEnabled ? (
              <PowerOff className="w-3 h-3" />
            ) : (
              <Power className="w-3 h-3" />
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            disabled={isDeleting || totalCount === 1}
            title={totalCount === 1 ? 'Cannot delete last schedule' : 'Delete schedule'}
            className="text-destructive hover:text-destructive"
          >
            {isDeleting ? (
              <Trash2 className="w-3 h-3 animate-pulse" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ScheduleManagerModal({ isOpen, onClose, agent, onUpdate }: ScheduleManagerModalProps) {
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [togglingIndex, setTogglingIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const schedules = agent.schedules || [];

  const handleDelete = async (index: number) => {
    if (schedules.length === 1) {
      // Cannot delete the last schedule
      return;
    }

    try {
      setDeletingIndex(index);

      const newSchedules = schedules.filter((_, i) => i !== index);

      const result = await updateAgentFromClient(agent.id, {
        schedules: newSchedules
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete schedule');
      }

      onUpdate?.();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      // TODO: Add proper error handling/toast notification
    } finally {
      setDeletingIndex(null);
    }
  };

  const handleToggle = async (index: number) => {
    try {
      setTogglingIndex(index);

      const newSchedules = schedules.map((schedule, i) => {
        if (i === index) {
          return {
            ...schedule,
            enabled: schedule.enabled === false ? true : false
          };
        }
        return schedule;
      });

      const result = await updateAgentFromClient(agent.id, {
        schedules: newSchedules
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to toggle schedule');
      }

      onUpdate?.();
    } catch (error) {
      console.error('Error toggling schedule:', error);
      // TODO: Add proper error handling/toast notification
    } finally {
      setTogglingIndex(null);
    }
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
  };

  const handleCreate = () => {
    setIsCreating(true);
  };

  const handleTriggerModalClose = () => {
    setEditingIndex(null);
    setIsCreating(false);
  };

  const handleTriggerModalUpdate = () => {
    onUpdate?.();
    handleTriggerModalClose();
  };

  return (
    <>
      <BaseModal
        isOpen={isOpen}
        onClose={onClose}
        title="Schedule Management"
        description="Configure multiple execution triggers for this agent"
        size="lg"
      >
        <div className="space-y-4">
          {schedules.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mb-3" />
                <h3 className="text-lg font-medium mb-2">No Schedules Configured</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This agent has no execution triggers. Add your first schedule to get started.
                </p>
                <Button onClick={handleCreate}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Schedule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="max-h-[400px] overflow-y-auto pr-2">
                {schedules.map((schedule, index) => (
                  <ScheduleCard
                    key={index}
                    schedule={schedule}
                    index={index}
                    totalCount={schedules.length}
                    onEdit={() => handleEdit(index)}
                    onDelete={() => handleDelete(index)}
                    onToggle={() => handleToggle(index)}
                    isDeleting={deletingIndex === index}
                    isToggling={togglingIndex === index}
                  />
                ))}
              </div>

              <div className="pt-2 border-t">
                <Button onClick={handleCreate} variant="outline" className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Schedule
                </Button>
              </div>
            </>
          )}

          <div className="flex justify-end pt-2 border-t">
            <Button onClick={onClose} variant="secondary">
              Close
            </Button>
          </div>
        </div>
      </BaseModal>

      {/* TriggerConfigModal for editing/creating */}
      {(editingIndex !== null || isCreating) && (
        <TriggerConfigModal
          isOpen={true}
          onClose={handleTriggerModalClose}
          agent={agent}
          onUpdate={handleTriggerModalUpdate}
          mode={isCreating ? 'create' : 'edit'}
          scheduleIndex={editingIndex ?? undefined}
        />
      )}
    </>
  );
}
