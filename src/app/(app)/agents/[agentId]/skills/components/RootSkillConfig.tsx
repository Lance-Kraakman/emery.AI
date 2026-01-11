'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { InputDefinitionsSection } from './editor/InputDefinitionsSection';
import { OutputDefinitionsSection } from './editor/OutputDefinitionsSection';
import { InputMappingSection } from './editor/InputMappingSection';
import { OutputMappingSection } from './editor/OutputMappingSection';
import type { SkillFormData } from './SkillEditor';

interface RootSkillConfigProps {
  value: SkillFormData;
  onChange: (value: SkillFormData) => void;
  isReadOnly?: boolean;
}

/**
 * Root skill configuration panel shown when no node is selected.
 * Contains: description, inputs, outputs, input mappings, output mappings.
 */
export function RootSkillConfig({
  value,
  onChange,
  isReadOnly = false,
}: RootSkillConfigProps) {
  const handleChange = (updates: Partial<SkillFormData>) => {
    onChange({ ...value, ...updates });
  };

  return (
    <div className="space-y-6">
      {/* Description */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Description</Label>
        <Textarea
          value={value.description}
          onChange={(e) => handleChange({ description: e.target.value })}
          placeholder="Briefly describe what this skill does..."
          rows={3}
          className="text-sm"
          disabled={isReadOnly}
        />
      </div>

      {/* Skill-level Inputs (API contract) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Inputs</Label>
          <span className="text-xs text-muted-foreground">
            {value.inputs.length} input{value.inputs.length !== 1 ? 's' : ''}
          </span>
        </div>
        <InputDefinitionsSection
          inputs={value.inputs}
          onInputsChange={(inputs) => handleChange({ inputs })}
          isReadOnly={isReadOnly}
        />
        <p className="text-xs text-muted-foreground">
          Skill inputs available to all workflow steps
        </p>
      </div>

      {/* Input Mapping Section - read from tables (only show if inputs exist) */}
      {value.inputs.length > 0 && (
        <InputMappingSection
          inputs={value.inputs}
          onInputsChange={(inputs) => handleChange({ inputs })}
          isReadOnly={isReadOnly}
        />
      )}

      {/* Skill-level Outputs (API contract) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Outputs</Label>
          <span className="text-xs text-muted-foreground">
            {value.outputs.length} output{value.outputs.length !== 1 ? 's' : ''}
          </span>
        </div>
        <OutputDefinitionsSection
          outputs={value.outputs}
          onOutputsChange={(outputs) => handleChange({ outputs })}
          isReadOnly={isReadOnly}
        />
        <p className="text-xs text-muted-foreground">
          Define what data this skill returns
        </p>
      </div>

      {/* Output Mapping Section - write to tables (only show if outputs exist) */}
      {value.outputs.length > 0 && (
        <OutputMappingSection
          outputs={value.outputs}
          onOutputsChange={(outputs) => handleChange({ outputs })}
          executionType="agent"
          skillOutputs={value.outputs}
          skillInputs={value.inputs}
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
}
