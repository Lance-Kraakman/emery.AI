'use client';

import React, { useState } from 'react';
import { Trash2, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { ToolConfigDTO } from '@/app/mappers/capability-mapper';
import { StepToolsSection } from './StepToolsSection';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface StepCardProps {
  stepIndex: number;
  totalSteps: number;
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
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

/**
 * Streamlined StepCard Component
 *
 * AIDEV-NOTE: Redesigned for non-technical users with:
 * - Friendly language ("What should this step do?")
 * - Larger instructions textarea (main focus)
 * - Inline tool pills
 * - Collapsible advanced settings
 * - Reorder buttons instead of drag handles
 */
export function StepCard({
  stepIndex,
  totalSteps,
  type,
  instructions,
  model,
  tools = [],
  servers = [],
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown
}: StepCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
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

  return (
    <div className="border rounded-lg bg-background shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-muted/20">
        {/* Step Counter Badge */}
        <Badge variant="secondary" className="text-sm font-medium px-3 py-1">
          Step {stepIndex + 1} of {totalSteps}
        </Badge>

        <div className="flex-1" />

        {/* Reorder Buttons */}
        <div className="flex items-center gap-1">
          {stepIndex > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onMoveUp}
              title="Move step up"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
          {stepIndex < totalSteps - 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onMoveDown}
              title="Move step down"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
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
            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-6 space-y-6">
          {/* Main Instructions - Friendly Label */}
          <div className="space-y-3">
            <Label htmlFor={`step-${stepIndex}-instructions`} className="text-base font-medium">
              What should this step do?
            </Label>
            <Textarea
              id={`step-${stepIndex}-instructions`}
              value={localInstructions}
              onChange={(e) => setLocalInstructions(e.target.value)}
              onBlur={handleInstructionsBlur}
              placeholder="Describe what this step should accomplish. Use natural language - you can include conditions like 'if this happens, then do that'..."
              className="min-h-[120px] resize-y text-base"
            />
            <p className="text-sm text-muted-foreground">
              Tip: Write in plain language. The AI will understand conditionals and complex instructions.
            </p>
          </div>

          {/* Tools Section - Inline */}
          <StepToolsSection
            tools={tools}
            onToolsChange={(newTools) => onUpdate({ tools: newTools })}
            stepIndex={stepIndex}
          />

          {/* Advanced Settings - Collapsible */}
          <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground hover:text-foreground"
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Advanced settings (optional)
                {isAdvancedOpen ? (
                  <ChevronUp className="h-4 w-4 ml-auto" />
                ) : (
                  <ChevronDown className="h-4 w-4 ml-auto" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              {/* Model Override */}
              <div className="space-y-2">
                <Label htmlFor={`step-${stepIndex}-model`} className="text-sm text-muted-foreground">
                  AI Model Override
                </Label>
                <Input
                  id={`step-${stepIndex}-model`}
                  value={localModel}
                  onChange={(e) => setLocalModel(e.target.value)}
                  onBlur={handleModelBlur}
                  placeholder="Leave empty to use default model"
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Only change this if you need a specific model for this step
                </p>
              </div>

              {/* Step Type Info */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Step Type</Label>
                <div className="flex items-center gap-2">
                  <Badge variant={type === 'TOOL_STEP' ? 'default' : 'outline'} className="text-xs">
                    {type === 'TOOL_STEP' ? 'Tool Execution' : 'Code Execution'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {type === 'TOOL_STEP'
                      ? 'Uses selected tools to complete the task'
                      : 'Executes code directly without external tools'}
                  </span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
}
