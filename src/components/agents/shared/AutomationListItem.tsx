'use client';

/**
 * AutomationListItem Component
 *
 * Shared component for displaying a single automation with toggle and actions.
 * Used by both CompactAgentHeader and OrgChartPanel.
 */

import React from 'react';
import { Calendar, Database, Globe, Zap, Edit2, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { AutomationConfigurationDTO, TriggerConfigDTO } from '@/app/dtos/automation.dto';

interface AutomationListItemProps {
  automation: AutomationConfigurationDTO;
  index: number;
  skillName?: string;
  onToggle?: (index: number, enabled: boolean) => void;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
  isDeleting?: boolean;
  canDelete?: boolean;
  compact?: boolean;
}

/** Get icon for trigger type */
function getTriggerIcon(type: TriggerConfigDTO['type']) {
  switch (type) {
    case 'CALENDAR':
      return Calendar;
    case 'DATABASE_EVENT':
      return Database;
    case 'WEBHOOK':
      return Globe;
    case 'PIPEDREAM_EVENT':
      return Zap;
    default:
      return Calendar;
  }
}

/** Get human-readable trigger type label */
function getTriggerLabel(type: TriggerConfigDTO['type']) {
  switch (type) {
    case 'CALENDAR':
      return 'Schedule';
    case 'DATABASE_EVENT':
      return 'Database';
    case 'WEBHOOK':
      return 'Webhook';
    case 'PIPEDREAM_EVENT':
      return 'Event';
    default:
      return type;
  }
}

export function AutomationListItem({
  automation,
  index,
  skillName,
  onToggle,
  onEdit,
  onDelete,
  isDeleting = false,
  canDelete = true,
  compact = false,
}: AutomationListItemProps) {
  const TriggerIcon = getTriggerIcon(automation.trigger.type);
  const triggerLabel = getTriggerLabel(automation.trigger.type);

  return (
    <div
      className={cn(
        'group flex items-center justify-between rounded-md transition-colors',
        compact ? 'px-2 py-1.5' : 'px-3 py-2',
        onEdit && 'hover:bg-accent cursor-pointer'
      )}
      onClick={() => onEdit?.(index)}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <TriggerIcon className={cn('shrink-0 text-muted-foreground', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn('font-medium truncate', compact ? 'text-xs' : 'text-sm')}>
              {automation.name || `Automation ${index + 1}`}
            </span>
            <span className={cn(
              'px-1.5 py-0.5 rounded-full shrink-0',
              compact ? 'text-[10px]' : 'text-xs',
              automation.enabled
                ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                : 'bg-gray-500/20 text-gray-600 dark:text-gray-400'
            )}>
              {automation.enabled ? 'Active' : 'Off'}
            </span>
          </div>
          {!compact && (
            <div className="text-xs text-muted-foreground truncate">
              {triggerLabel}
              {skillName && <span> → {skillName}</span>}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 ml-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        {onToggle && (
          <Switch
            checked={automation.enabled}
            onCheckedChange={(checked) => onToggle(index, checked)}
            className="scale-75"
          />
        )}
        {onEdit && !compact && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(index);
            }}
            className="p-1.5 rounded hover:bg-accent-foreground/10 transition-colors opacity-0 group-hover:opacity-100"
            title="Edit automation"
          >
            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(index);
            }}
            disabled={isDeleting || !canDelete}
            className="p-1.5 rounded hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canDelete ? 'Cannot delete last automation' : 'Delete automation'}
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        )}
      </div>
    </div>
  );
}

export default AutomationListItem;
