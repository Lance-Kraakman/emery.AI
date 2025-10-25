'use client';

import React, { useState } from 'react';
import { GripVertical, Trash2, ChevronDown, ChevronUp, Code, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { ToolConfigDTO } from '@/app/mappers/capability-mapper';
import { StepToolsSection } from './StepToolsSection';

interface StepCardProps {
  stepIndex: number;
  type: 'TOOL_STEP' | 'CODE_STEP';
  instructions: string;
  model?: string;
  tools?: ToolConfigDTO[];
  servers?: any[];
  onUpdate: (data: {
    instructions?: string;
    model?: string;
    tools?: ToolConfigDTO[];
    servers?: any[];
  }) => void;
  onDelete: () => void;
  isDragging?: boolean;
  dragHandleProps?: any;
}

export function StepCard({
  stepIndex,
  type,
  instructions,
  model,
  tools = [],
  servers = [],
  onUpdate,
  onDelete,
  isDragging,
  dragHandleProps
}: StepCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [localInstructions, setLocalInstructions] = useState(instructions);
  const [localModel, setLocalModel] = useState(model || '');

  const handleInstructionsBlur = () => {
    if (localInstructions !== instructions) {
      onUpdate({ instructions: localInstructions });
    }
  };

  const handleModelBlur = () => {
    if (localModel !== model) {
      onUpdate({ model: localModel || undefined });
    }
  };

  const getStepIcon = () => {
    return type === 'TOOL_STEP' ? (
      <Wrench className="h-4 w-4" />
    ) : (
      <Code className="h-4 w-4" />
    );
  };

  const getStepLabel = () => {
    return type === 'TOOL_STEP' ? 'Tool Step' : 'Code Step';
  };

  return (
    <div
      className={`border rounded-lg bg-background transition-shadow ${
        isDragging ? 'shadow-lg opacity-50' : 'shadow-sm'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
        {/* Drag Handle */}
        <div
          {...dragHandleProps}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Step Info */}
        <div className="flex items-center gap-2 flex-1">
          <Badge variant="outline" className="flex items-center gap-1">
            {getStepIcon()}
            {getStepLabel()}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Step {stepIndex + 1}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Instructions */}
          <div className="space-y-2">
            <Label htmlFor={`step-${stepIndex}-instructions`}>
              Instructions *
            </Label>
            <Textarea
              id={`step-${stepIndex}-instructions`}
              value={localInstructions}
              onChange={(e) => setLocalInstructions(e.target.value)}
              onBlur={handleInstructionsBlur}
              placeholder="Enter step instructions..."
              className="min-h-[100px] resize-y"
            />
          </div>

          {/* Model (Optional) */}
          <div className="space-y-2">
            <Label htmlFor={`step-${stepIndex}-model`}>
              Model (Optional)
            </Label>
            <Input
              id={`step-${stepIndex}-model`}
              value={localModel}
              onChange={(e) => setLocalModel(e.target.value)}
              onBlur={handleModelBlur}
              placeholder="e.g., gpt-4, claude-3-opus..."
            />
          </div>

          {/* Tools Section (Only for TOOL_STEP) */}
          {type === 'TOOL_STEP' && (
            <StepToolsSection
              tools={tools}
              onToolsChange={(newTools) => onUpdate({ tools: newTools })}
              stepIndex={stepIndex}
            />
          )}

          {/* TODO: Servers section if needed */}
        </div>
      )}
    </div>
  );
}
