'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

interface SortableStepProps {
  step: CapabilityFormData['steps'][0];
  index: number;
  onUpdate: (index: number, data: Partial<CapabilityFormData['steps'][0]>) => void;
  onDelete: (index: number) => void;
}

function SortableStep({ step, index, onUpdate, onDelete }: SortableStepProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `step-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <StepCard
        stepIndex={index}
        type={step.type}
        instructions={step.instructions}
        model={step.model}
        tools={step.tools}
        servers={step.servers}
        onUpdate={(data) => onUpdate(index, data)}
        onDelete={() => onDelete(index)}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

/**
 * CapabilityEditor Component
 *
 * Full-featured capability editor with:
 * - Basic metadata (name, description)
 * - Step-by-step workflow builder
 * - Drag-and-drop step reordering
 * - Tool selection per step with @doc:, @file:, @agent: format
 * - Visual tool display similar to ToolPanel
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

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = parseInt(active.id.toString().replace('step-', ''));
      const newIndex = parseInt(over.id.toString().replace('step-', ''));

      const newSteps = arrayMove(localValue.steps, oldIndex, newIndex);
      const newValue = { ...localValue, steps: newSteps };
      setLocalValue(newValue);
      onChange(newValue);
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Basic Fields */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={localValue.name}
            onChange={(e) => {
              const newValue = { ...localValue, name: e.target.value };
              setLocalValue(newValue);
              onChange(newValue);
            }}
            placeholder="Enter capability name..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={localValue.description}
            onChange={(e) => {
              const newValue = { ...localValue, description: e.target.value };
              setLocalValue(newValue);
              onChange(newValue);
            }}
            placeholder="Enter capability description..."
            rows={3}
          />
        </div>
      </div>

      {/* Steps Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Steps</Label>
          {localValue.steps.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {localValue.steps.length} step{localValue.steps.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Steps List with Drag-and-Drop */}
        {localValue.steps.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localValue.steps.map((_, i) => `step-${i}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {localValue.steps.map((step, index) => (
                  <SortableStep
                    key={`step-${index}`}
                    step={step}
                    index={index}
                    onUpdate={handleUpdateStep}
                    onDelete={handleDeleteStep}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
            <p>No steps yet</p>
            <p className="text-sm mt-1">Add your first step to get started</p>
          </div>
        )}

        {/* Add Step Button */}
        <AddStepButton onAddStep={handleAddStep} />
      </div>
    </div>
  );
}
