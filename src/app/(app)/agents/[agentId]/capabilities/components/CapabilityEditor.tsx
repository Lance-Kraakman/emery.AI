'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StepCard } from './step-editor/StepCard';
import { AddStepButton } from './step-editor/AddStepButton';
import type { ToolConfigDTO } from '@/app/mappers/capability-mapper';

export interface CapabilityFormData {
  name: string;
  description: string;
  steps: Array<{
    type: 'TOOL_STEP' | 'CODE_STEP';
    instructions: string;
    model?: string;
    tools?: ToolConfigDTO[];
    servers?: any[];
  }>;
}

interface CapabilityEditorProps {
  value: CapabilityFormData;
  onChange: (value: CapabilityFormData) => void;
  agentId: number;
  capabilityId?: number;
}

/**
 * Streamlined Capability Editor
 *
 * AIDEV-NOTE: Redesigned for non-technical users with:
 * - Friendly language throughout
 * - Simple reorder buttons (no drag-and-drop)
 * - Focus on natural language instructions
 * - Advanced settings hidden by default
 * - Prepares for future template and chatbot integration
 */
export function CapabilityEditor({
  value,
  onChange,
  agentId,
  capabilityId
}: CapabilityEditorProps) {
  const [localValue, setLocalValue] = useState(value);

  // Sync with external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleAddStep = (type: 'TOOL_STEP' | 'CODE_STEP') => {
    const newStep = {
      type,
      instructions: '',
      model: undefined,
      tools: [],
      servers: []
    };
    const newValue = {
      ...localValue,
      steps: [...localValue.steps, newStep]
    };
    setLocalValue(newValue);
    onChange(newValue);
  };

  const handleUpdateStep = (index: number, data: Partial<CapabilityFormData['steps'][0]>) => {
    const newSteps = [...localValue.steps];
    newSteps[index] = { ...newSteps[index], ...data };
    const newValue = { ...localValue, steps: newSteps };
    setLocalValue(newValue);
    onChange(newValue);
  };

  const handleDeleteStep = (index: number) => {
    const newSteps = localValue.steps.filter((_, i) => i !== index);
    const newValue = { ...localValue, steps: newSteps };
    setLocalValue(newValue);
    onChange(newValue);
  };

  const handleMoveStepUp = (index: number) => {
    if (index === 0) return;
    const newSteps = [...localValue.steps];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    const newValue = { ...localValue, steps: newSteps };
    setLocalValue(newValue);
    onChange(newValue);
  };

  const handleMoveStepDown = (index: number) => {
    if (index === localValue.steps.length - 1) return;
    const newSteps = [...localValue.steps];
    [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    const newValue = { ...localValue, steps: newSteps };
    setLocalValue(newValue);
    onChange(newValue);
  };

  return (
    <div className="space-y-4">
      {/* Basic Fields */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-base font-medium">
            Capability Name
          </Label>
          <Input
            id="name"
            value={localValue.name}
            onChange={(e) => {
              const newValue = { ...localValue, name: e.target.value };
              setLocalValue(newValue);
              onChange(newValue);
            }}
            placeholder="e.g., Weekly Sales Report, Customer Onboarding, Data Analysis..."
            className="text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-base font-medium">
            Description (Optional)
          </Label>
          <Textarea
            id="description"
            value={localValue.description}
            onChange={(e) => {
              const newValue = { ...localValue, description: e.target.value };
              setLocalValue(newValue);
              onChange(newValue);
            }}
            placeholder="Briefly describe what this capability does..."
            rows={2}
            className="text-base"
          />
        </div>
      </div>

      {/* Steps Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-lg font-semibold">Workflow Steps</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Break down your workflow into sequential steps
            </p>
          </div>
          {localValue.steps.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {localValue.steps.length} step{localValue.steps.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Steps List */}
        <div className="space-y-4">
          {localValue.steps.map((step, index) => (
            <StepCard
              key={index}
              stepIndex={index}
              totalSteps={localValue.steps.length}
              type={step.type}
              instructions={step.instructions}
              model={step.model}
              tools={step.tools}
              servers={step.servers}
              onUpdate={(data) => handleUpdateStep(index, data)}
              onDelete={() => handleDeleteStep(index)}
              onMoveUp={() => handleMoveStepUp(index)}
              onMoveDown={() => handleMoveStepDown(index)}
            />
          ))}
        </div>

        {/* Add Step Button */}
        <AddStepButton onAddStep={handleAddStep} />
      </div>
    </div>
  );
}
