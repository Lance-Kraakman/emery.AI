'use client';

import React from 'react';
import { Calendar, Database, Globe, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TriggerType } from '@/ddd/domain/scheduling/value-objects/trigger-config';

interface TriggerTypeSelectorProps {
  value: TriggerType;
  onChange: (type: TriggerType) => void;
  disabled?: boolean;
}

const triggerTypes: { type: TriggerType; label: string; icon: React.ElementType }[] = [
  { type: 'CALENDAR', label: 'Schedule', icon: Calendar },
  { type: 'DATABASE_EVENT', label: 'Database', icon: Database },
  { type: 'WEBHOOK', label: 'Webhook', icon: Globe },
  { type: 'PIPEDREAM_EVENT', label: 'External', icon: Zap },
];

export function TriggerTypeSelector({ value, onChange, disabled }: TriggerTypeSelectorProps) {
  return (
    <div className="flex gap-1">
      {triggerTypes.map(({ type, label, icon: Icon }) => {
        const isSelected = value === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            disabled={disabled}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              'border',
              isSelected
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
