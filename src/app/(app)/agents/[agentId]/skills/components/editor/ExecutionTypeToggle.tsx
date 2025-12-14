'use client';

import React from 'react';
import { Bot, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExecutionTypeToggleProps {
  value: 'agent' | 'operation' | 'task-model';  // Include legacy 'task-model' for loading existing skills
  onChange: (value: 'agent' | 'operation') => void;  // Only emit new values
  disabled?: boolean;
}

/**
 * Compact toggle between Agent and Direct (operation) execution types.
 * Note: 'task-model' is a legacy value that maps to 'operation' for display purposes.
 */
export function ExecutionTypeToggle({ value, onChange, disabled }: ExecutionTypeToggleProps) {
  // Normalize legacy 'task-model' to 'operation' for display
  const isOperation = value === 'operation' || value === 'task-model';

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant={value === 'agent' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onChange('agent')}
        disabled={disabled}
        className="flex-1"
        title="LLM orchestrates tools and reasoning"
      >
        <Bot className="h-4 w-4 mr-2" />
        Agent
      </Button>
      <Button
        type="button"
        variant={isOperation ? 'default' : 'outline'}
        size="sm"
        onClick={() => onChange('operation')}
        disabled={disabled}
        className="flex-1"
        title="Single model call (image gen, speech, etc.)"
      >
        <Cpu className="h-4 w-4 mr-2" />
        Direct
      </Button>
    </div>
  );
}
