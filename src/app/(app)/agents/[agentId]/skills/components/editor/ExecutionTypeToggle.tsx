'use client';

import React from 'react';
import { Bot, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExecutionTypeToggleProps {
  value: 'agent' | 'operation';
  onChange: (value: 'agent' | 'operation') => void;
  disabled?: boolean;
}

/**
 * Compact toggle between Agent and Direct (operation) execution types.
 */
export function ExecutionTypeToggle({ value, onChange, disabled }: ExecutionTypeToggleProps) {
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
        variant={value === 'operation' ? 'default' : 'outline'}
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
