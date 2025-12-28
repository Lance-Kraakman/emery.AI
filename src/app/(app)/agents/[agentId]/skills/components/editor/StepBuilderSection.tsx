'use client';

import React, { useMemo, useState } from 'react';
import { Plus, X, GripVertical, ArrowLeft, ArrowRight } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UnifiedChatInput } from '@/components/shared/UnifiedChatInput';
import { cn } from '@/lib/utils';
import type { SkillStep, InputDefinition } from '@/ddd/domain/skills/entities/skill';

interface AvailableSkill {
  id: number;
  name: string;
}

interface StepBuilderSectionProps {
  steps: SkillStep[];
  onChange: (steps: SkillStep[]) => void;
  skillInputs: InputDefinition[];
  availableSkills?: AvailableSkill[];
  disabled?: boolean;
}

interface VariableInfo {
  name: string;
  description: string;
}

interface SortableStepCardProps {
  step: SkillStep;
  index: number;
  availableVariables: VariableInfo[];
  availableSkills: AvailableSkill[];
  onChange: (updates: Partial<SkillStep>) => void;
  onDelete: () => void;
  disabled?: boolean;
}

/**
 * Get available variables for a step based on skill inputs and previous step outputs
 */
function getAvailableVariables(
  stepIndex: number,
  skillInputs: InputDefinition[],
  steps: SkillStep[]
): VariableInfo[] {
  const vars: VariableInfo[] = [];

  // Skill inputs always available
  for (const input of skillInputs) {
    vars.push({
      name: input.name,
      description: `Skill input: ${input.type || 'text'}`,
    });
  }

  // Previous step outputs (from outputs record keys)
  for (let i = 0; i < stepIndex; i++) {
    const step = steps[i];
    if (step.outputs) {
      for (const outputKey of Object.keys(step.outputs)) {
        vars.push({
          name: outputKey,
          description: `Output from step "${step.name}"`,
        });
      }
    }
    // Also add step name as implicit output
    if (step.name) {
      vars.push({
        name: `${step.name}_result`,
        description: `Result from step "${step.name}"`,
      });
    }
  }

  return vars;
}

/**
 * Step Input Mappings - Maps external values to step parameters
 */
interface StepInputMappingsProps {
  inputs: Record<string, string>;
  onChange: (inputs: Record<string, string>) => void;
  availableVariables: VariableInfo[];
  disabled?: boolean;
}

function StepInputMappings({ inputs, onChange, availableVariables, disabled }: StepInputMappingsProps) {
  const entries = Object.entries(inputs);

  const addInput = () => {
    const newKey = `param_${Object.keys(inputs).length + 1}`;
    onChange({ ...inputs, [newKey]: '' });
  };

  const updateInput = (oldKey: string, newKey: string, value: string) => {
    const newInputs: Record<string, string> = {};
    for (const [k, v] of Object.entries(inputs)) {
      if (k === oldKey) {
        newInputs[newKey] = value;
      } else {
        newInputs[k] = v;
      }
    }
    onChange(newInputs);
  };

  const removeInput = (key: string) => {
    const { [key]: _, ...rest } = inputs;
    onChange(rest);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Input Mappings</Label>
        {!disabled && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-5 w-5 p-0"
            onClick={addInput}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="text-[10px] text-muted-foreground italic">No input mappings</p>
      ) : (
        entries.map(([param, source]) => (
          <div key={param} className="flex items-center gap-1.5">
            <Input
              value={param}
              onChange={(e) => updateInput(param, e.target.value, source)}
              className="h-6 text-xs w-24 font-mono"
              placeholder="param"
              disabled={disabled}
            />
            <ArrowLeft className="h-3 w-3 text-muted-foreground shrink-0" />
            <Input
              value={source}
              onChange={(e) => updateInput(param, param, e.target.value)}
              className="h-6 text-xs flex-1 font-mono"
              placeholder="{{source}}"
              disabled={disabled}
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => removeInput(param)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

/**
 * Step Output Mappings - Captures step results to named variables
 */
interface StepOutputMappingsProps {
  outputs: Record<string, string>;
  onChange: (outputs: Record<string, string>) => void;
  disabled?: boolean;
}

function StepOutputMappings({ outputs, onChange, disabled }: StepOutputMappingsProps) {
  const entries = Object.entries(outputs);

  const addOutput = () => {
    const newKey = `output_${Object.keys(outputs).length + 1}`;
    onChange({ ...outputs, [newKey]: '' });
  };

  const updateOutput = (oldKey: string, newKey: string, value: string) => {
    const newOutputs: Record<string, string> = {};
    for (const [k, v] of Object.entries(outputs)) {
      if (k === oldKey) {
        newOutputs[newKey] = value;
      } else {
        newOutputs[k] = v;
      }
    }
    onChange(newOutputs);
  };

  const removeOutput = (key: string) => {
    const { [key]: _, ...rest } = outputs;
    onChange(rest);
  };

  return (
    <div className="space-y-1.5 border-t pt-2">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Output Mappings</Label>
        {!disabled && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-5 w-5 p-0"
            onClick={addOutput}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="text-[10px] text-muted-foreground italic">No output mappings</p>
      ) : (
        entries.map(([outputName, targetVar]) => (
          <div key={outputName} className="flex items-center gap-1.5">
            <Input
              value={outputName}
              onChange={(e) => updateOutput(outputName, e.target.value, targetVar)}
              className="h-6 text-xs w-24 font-mono"
              placeholder="result_field"
              disabled={disabled}
            />
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <Input
              value={targetVar}
              onChange={(e) => updateOutput(outputName, outputName, e.target.value)}
              className="h-6 text-xs flex-1 font-mono"
              placeholder="target_var"
              disabled={disabled}
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => removeOutput(outputName)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

/**
 * Sortable Step Card Component
 */
function SortableStepCard({
  step,
  index,
  availableVariables,
  availableSkills,
  onChange,
  onDelete,
  disabled,
}: SortableStepCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.name || `step-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isSkillRef = step.skillId !== undefined && step.skillId !== null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative',
        isDragging && 'opacity-50 z-50'
      )}
    >
      {/* Connector line above (not for first step) */}
      {index > 0 && (
        <div className="flex justify-center -mt-1 mb-1">
          <div className="w-0.5 h-4 bg-border" />
        </div>
      )}

      {/* Step Card */}
      <div className="border rounded-lg bg-card">
        {/* Header with drag handle and delete */}
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
          <button
            type="button"
            className={cn(
              'cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground',
              disabled && 'cursor-not-allowed opacity-50'
            )}
            {...attributes}
            {...listeners}
            disabled={disabled}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <span className="text-xs font-medium text-muted-foreground">
            Step {index + 1}
          </span>

          <Input
            value={step.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="step_name"
            className="h-7 text-sm flex-1 bg-background"
            disabled={disabled}
          />

          {!disabled && (
            <button
              type="button"
              onClick={onDelete}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Step Content */}
        <div className="p-3 space-y-3">
          {/* Input Mappings - maps context values to step parameters */}
          <StepInputMappings
            inputs={step.inputs || {}}
            onChange={(inputs) => onChange({ inputs })}
            availableVariables={availableVariables}
            disabled={disabled}
          />

          {/* Mode Toggle */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name={`step-mode-${index}`}
                checked={!isSkillRef}
                onChange={() => onChange({ skillId: undefined, instruction: step.instruction || '' })}
                disabled={disabled}
                className="text-primary"
              />
              Inline instruction
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name={`step-mode-${index}`}
                checked={isSkillRef}
                onChange={() => onChange({ skillId: -1, instruction: undefined })}
                disabled={disabled}
                className="text-primary"
              />
              Reference skill
            </label>
          </div>

          {/* Inline Instruction or Skill Selector */}
          {isSkillRef ? (
            <div className="space-y-2">
              <Label className="text-xs">Skill</Label>
              <Select
                value={step.skillId?.toString() || ''}
                onValueChange={(val) => onChange({ skillId: parseInt(val, 10) })}
                disabled={disabled || availableSkills.length === 0}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select a skill..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSkills.map((skill) => (
                    <SelectItem key={skill.id} value={skill.id.toString()}>
                      {skill.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableSkills.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No other skills available to reference.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs">Instruction</Label>
              <UnifiedChatInput
                value={step.instruction || ''}
                onChange={(text) => onChange({ instruction: text })}
                placeholder="Describe what this step should do... Use { for variables"
                variables={availableVariables}
                mode="form"
                minHeight="80px"
                disabled={disabled}
                enableAttachments={false}
                enableSendButton={false}
              />
            </div>
          )}

          {/* Output Mappings - captures step results to named variables */}
          <StepOutputMappings
            outputs={step.outputs || {}}
            onChange={(outputs) => onChange({ outputs })}
            disabled={disabled}
          />

          {/* Available Variables */}
          {availableVariables.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Available variables:</p>
              <div className="flex flex-wrap gap-1">
                {availableVariables.map((v, i) => (
                  <code
                    key={i}
                    className="px-1.5 py-0.5 text-xs bg-muted rounded font-mono"
                    title={v.description}
                  >
                    {`{{${v.name}}}`}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Step Builder Section
 *
 * Allows building step-based workflows with:
 * - Drag-and-drop reordering
 * - Inline instructions or skill references
 * - Variable context from inputs and previous steps
 */
export function StepBuilderSection({
  steps,
  onChange,
  skillInputs,
  availableSkills = [],
  disabled = false,
}: StepBuilderSectionProps) {
  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Generate unique IDs for sortable context
  const stepIds = useMemo(
    () => steps.map((s, i) => s.name || `step-${i}`),
    [steps]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stepIds.indexOf(active.id as string);
    const newIndex = stepIds.indexOf(over.id as string);

    if (oldIndex !== -1 && newIndex !== -1) {
      onChange(arrayMove(steps, oldIndex, newIndex));
    }
  };

  const handleStepChange = (index: number, updates: Partial<SkillStep>) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    onChange(newSteps);
  };

  const handleDeleteStep = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
  };

  const handleAddStep = () => {
    const newStep: SkillStep = {
      name: `step_${steps.length + 1}`,
      instruction: '',
    };
    onChange([...steps, newStep]);
  };

  const handleInsertStep = (atIndex: number) => {
    const newStep: SkillStep = {
      name: `step_${steps.length + 1}`,
      instruction: '',
    };
    const newSteps = [...steps];
    newSteps.splice(atIndex, 0, newStep);
    onChange(newSteps);
  };

  // Empty state
  if (steps.length === 0) {
    return (
      <div className="space-y-3">
        <Label className="text-base font-semibold">Steps</Label>
        <div className="border-2 border-dashed border-muted rounded-lg p-8 flex flex-col items-center justify-center gap-3">
          <p className="text-sm text-muted-foreground">
            No steps defined yet.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddStep}
            disabled={disabled}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add first step
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold">Steps</Label>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={stepIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-0">
            {steps.map((step, index) => (
              <React.Fragment key={step.name || `step-${index}`}>
                {/* Insert button before step (not for first step) */}
                {index > 0 && !disabled && (
                  <div className="flex justify-center py-1">
                    <button
                      type="button"
                      onClick={() => handleInsertStep(index)}
                      className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/40
                        text-muted-foreground/60 hover:border-primary hover:text-primary
                        hover:bg-primary/5 flex items-center justify-center transition-colors"
                      title="Insert step here"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <SortableStepCard
                  step={step}
                  index={index}
                  availableVariables={getAvailableVariables(index, skillInputs, steps)}
                  availableSkills={availableSkills}
                  onChange={(updates) => handleStepChange(index, updates)}
                  onDelete={() => handleDeleteStep(index)}
                  disabled={disabled}
                />
              </React.Fragment>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add Step Button with connector */}
      <div className="flex flex-col items-center pt-1">
        <div className="w-0.5 h-4 bg-border" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-full h-8 w-8"
          onClick={handleAddStep}
          disabled={disabled}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
