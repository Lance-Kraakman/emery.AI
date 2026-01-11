'use client';

import React from 'react';
import { Calendar, Clock, ChevronRight, Plus, Database, Webhook, Zap } from 'lucide-react';
import { RRule } from 'rrule';
import type { AutomationConfigurationDTO } from '@/app/dtos/automation.dto';

interface CompactSchedulesListProps {
  schedules: AutomationConfigurationDTO[];
  onManageSchedules?: () => void;
  className?: string;
}

const TRIGGER_ICONS: Record<string, typeof Calendar> = {
  CALENDAR: Calendar,
  DATABASE_EVENT: Database,
  WEBHOOK: Webhook,
  PIPEDREAM_EVENT: Zap
};

function getScheduleDescription(schedule: AutomationConfigurationDTO): string {
  const trigger = schedule.trigger;

  switch (trigger.type) {
    case 'CALENDAR':
      try {
        const rrule = RRule.fromString(trigger.rrule);
        const text = rrule.toText();
        return text.charAt(0).toUpperCase() + text.slice(1);
      } catch (error) {
        return 'Invalid configuration';
      }
    case 'DATABASE_EVENT':
      const ops = trigger.operations.join(', ');
      return `On ${ops} ${trigger.tableId ? `(${trigger.tableId})` : '(all tables)'}`;
    case 'WEBHOOK':
      return 'Webhook trigger';
    case 'PIPEDREAM_EVENT':
      return `External: ${(trigger as any).triggerType || 'event'}`;
    default:
      return 'Unknown trigger';
  }
}

export function CompactSchedulesList({
  schedules,
  onManageSchedules,
  className = ''
}: CompactSchedulesListProps) {
  const activeSchedules = schedules.filter(s => s.enabled && s.trigger.enabled);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Automations</h4>
          <span className="text-xs text-muted-foreground">
            ({activeSchedules.length}/{schedules.length})
          </span>
        </div>
        {onManageSchedules && (
          <button
            onClick={onManageSchedules}
            className="p-1 hover:bg-accent rounded transition-colors"
            title="Manage automations"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {schedules.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-4 border rounded-md bg-muted/20">
          No automations configured
        </div>
      ) : (
        <div className="space-y-1">
          {schedules.map((schedule, idx) => {
            const TriggerIcon = TRIGGER_ICONS[schedule.trigger.type] || Clock;
            const isActive = schedule.enabled && schedule.trigger.enabled;

            return (
              <div
                key={idx}
                className="w-full p-2 border rounded-md bg-card opacity-100 transition-opacity"
                style={{ opacity: isActive ? 1 : 0.5 }}
              >
                <div className="flex items-start gap-2">
                  <TriggerIcon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {schedule.name || `Skill ${schedule.skillId}`}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {getScheduleDescription(schedule)}
                    </p>
                    {!isActive && (
                      <span className="inline-block mt-1 text-xs px-1.5 py-0.5 bg-yellow-500/20 text-yellow-600 rounded">
                        Disabled
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
