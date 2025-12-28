'use client';

import React from 'react';
import { Bot, Cpu, Wrench, Database, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SkillExecutionType } from '@/ddd/domain/skills/entities/skill';

interface ExecutionTypeToggleProps {
  value: SkillExecutionType;
  onChange: (value: SkillExecutionType) => void;
  disabled?: boolean;
}

interface ExecutionTypeOption {
  type: SkillExecutionType;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ElementType;
}

const EXECUTION_TYPES: ExecutionTypeOption[] = [
  {
    type: 'agentic',
    label: 'Agentic',
    shortLabel: 'Agentic',
    description: 'LLM orchestrates tools with flat instructions',
    icon: Bot,
  },
  {
    type: 'agent',
    label: 'Agent',
    shortLabel: 'Agent',
    description: 'Step-based workflow with isolated contexts',
    icon: GitBranch,
  },
  {
    type: 'operation',
    label: 'Direct',
    shortLabel: 'Direct',
    description: 'Single model call (image gen, speech)',
    icon: Cpu,
  },
  {
    type: 'tool',
    label: 'Tool',
    shortLabel: 'Tool',
    description: 'Direct Pipedream action (no LLM)',
    icon: Wrench,
  },
  {
    type: 'write',
    label: 'Write',
    shortLabel: 'Write',
    description: 'Direct table write (no LLM)',
    icon: Database,
  },
];

/**
 * Execution type selector for skills.
 * - Agentic: LLM orchestration with flat instructions (default)
 * - Agent: Step-based DAG workflow with skill chaining
 * - Direct (operation): Single model call
 * - Tool: Direct Pipedream action
 * - Write: Direct table write
 */
export function ExecutionTypeToggle({ value, onChange, disabled }: ExecutionTypeToggleProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-2">
        {EXECUTION_TYPES.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.type;

          return (
            <button
              key={option.type}
              type="button"
              onClick={() => onChange(option.type)}
              disabled={disabled}
              className={cn(
                'flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all',
                'hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Icon className={cn(
                'h-5 w-5',
                isSelected ? 'text-primary' : 'text-muted-foreground'
              )} />
              <span className={cn(
                'text-sm font-medium',
                isSelected ? 'text-primary' : 'text-foreground'
              )}>
                {option.shortLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Description for selected type */}
      <p className="text-xs text-muted-foreground text-center">
        {EXECUTION_TYPES.find(t => t.type === value)?.description}
      </p>
    </div>
  );
}
