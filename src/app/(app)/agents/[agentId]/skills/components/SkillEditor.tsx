'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Save, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StepInstructionsInput } from './step-editor/StepInstructionsInput';
import { StepToolsSection } from './step-editor/StepToolsSection';
import { SkillInputsSection } from './step-editor/SkillInputsSection';
import { SkillOutputsSection } from './step-editor/SkillOutputsSection';
import type { ToolConfigDTO, SkillInput, SkillOutput } from '@/app/mappers/skill-mapper';

export interface SkillFormData {
  name: string;
  description: string;
  inputs: SkillInput[];
  outputs: SkillOutput[];
  instructions: string;
  tools: ToolConfigDTO[];
}

interface SkillEditorProps {
  value: SkillFormData;
  onChange: (value: SkillFormData) => void;
  agentId?: number | null; // Optional: null for organization skills, number for agent-scoped skills
  skillId?: number;
  onSave?: () => void;
  isSaving?: boolean;
}

/**
 * Simplified Skill Editor
 *
 * AIDEV-NOTE: Removed multi-step workflow, replaced with:
 * - Single natural language instructions textarea
 * - Explicit Inputs section (name + required/optional)
 * - Explicit Outputs section (name only)
 * - Tools tracked automatically via @ mentions
 */
export function SkillEditor({
  value,
  onChange,
  agentId,
  skillId,
  onSave,
  isSaving
}: SkillEditorProps) {
  const [localValue, setLocalValue] = useState(value);
  const [showDescription, setShowDescription] = useState(false);

  // Sync with external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (updates: Partial<SkillFormData>) => {
    const newValue = { ...localValue, ...updates };
    setLocalValue(newValue);
    onChange(newValue);
  };

  return (
    <div className="space-y-6">
      {/* Inline Name + Create Button */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Input
              id="name"
              value={localValue.name}
              onChange={(e) => handleChange({ name: e.target.value })}
              placeholder="e.g., Send Welcome Email, Generate Report, Analyze Data..."
              className="text-base h-10"
            />
          </div>
          {onSave && (
            <Button onClick={onSave} disabled={isSaving} className="h-10">
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Creating...' : 'Create Skill'}
            </Button>
          )}
        </div>

        {/* Add Description Link */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowDescription(!showDescription)}
        >
          {showDescription ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" />
              Hide description
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" />
              Add description
            </>
          )}
        </Button>

        {/* Collapsible Description */}
        {showDescription && (
          <Textarea
            id="description"
            value={localValue.description}
            onChange={(e) => handleChange({ description: e.target.value })}
            placeholder="Briefly describe what this skill does..."
            rows={2}
            className="text-base"
          />
        )}
      </div>

      {/* Inputs Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">Inputs</Label>
          <span className="text-xs text-muted-foreground">
            {localValue.inputs.length} input{localValue.inputs.length !== 1 ? 's' : ''}
          </span>
        </div>
        <SkillInputsSection
          inputs={localValue.inputs}
          onInputsChange={(inputs) => handleChange({ inputs })}
        />
        <p className="text-xs text-muted-foreground">
          Reference inputs in instructions using {'{input_name}'} syntax
        </p>
      </div>

      {/* Instructions Section */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Instructions</Label>
        <StepInstructionsInput
          value={localValue.instructions}
          onChange={(text) => handleChange({ instructions: text })}
          onToolsChange={(tools) => handleChange({ tools })}
          tools={localValue.tools}
          stepIndex={0}
        />

        {/* Tools Display - BELOW instructions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground">Tools Used</Label>
            <span className="text-xs text-muted-foreground">
              {localValue.tools.length} tool{localValue.tools.length !== 1 ? 's' : ''}
            </span>
          </div>
          <StepToolsSection
            tools={localValue.tools}
            onToolsChange={(tools) => handleChange({ tools })}
            stepIndex={0}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Type @ to reference tools, documents, or other skills
        </p>
      </div>

      {/* Outputs Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">Outputs</Label>
          <span className="text-xs text-muted-foreground">
            {localValue.outputs.length} output{localValue.outputs.length !== 1 ? 's' : ''}
          </span>
        </div>
        <SkillOutputsSection
          outputs={localValue.outputs}
          onOutputsChange={(outputs) => handleChange({ outputs })}
        />
        <p className="text-xs text-muted-foreground">
          Define what data this skill returns
        </p>
      </div>

      {/* Tools Section - Display Only */}
      {localValue.tools.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Tools Used</Label>
          <div className="flex items-center gap-2 flex-wrap">
            {localValue.tools.map((tool, index) => (
              <div
                key={index}
                className="px-2.5 py-1.5 rounded-md border text-xs bg-muted/50"
              >
                {tool.config?.displayName || tool.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
