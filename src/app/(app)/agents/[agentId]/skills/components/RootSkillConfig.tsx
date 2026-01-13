'use client';

import React, { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { InputDefinitionsSection } from './editor/InputDefinitionsSection';
import { OutputDefinitionsSection } from './editor/OutputDefinitionsSection';
import { OutputSourceSection } from './editor/OutputSourceSection';
import { InputMappingSection } from './editor/InputMappingSection';
import { OutputMappingSection } from './editor/OutputMappingSection';
import type { SkillFormData } from './SkillEditor';
import type { WorkflowNode } from '@/components/workflow-canvas/types';

interface RootSkillConfigProps {
  value: SkillFormData;
  onChange: (value: SkillFormData) => void;
  isReadOnly?: boolean;
  /** Workflow nodes for building available output sources */
  nodes?: WorkflowNode[];
}

/**
 * Root skill configuration panel shown when no node is selected.
 * Contains: description, inputs, outputs, input mappings, output mappings.
 */
export function RootSkillConfig({
  value,
  onChange,
  isReadOnly = false,
  nodes = [],
}: RootSkillConfigProps) {
  const handleChange = (updates: Partial<SkillFormData>) => {
    onChange({ ...value, ...updates });
  };

  // Build available node outputs from workflow nodes
  // Only include agentic nodes that have outputDefs
  const availableNodeOutputs = useMemo(() => {
    return nodes
      .filter((node) => {
        // Only agentic nodes with outputDefs
        if (node.type !== 'agentic') return false;
        const data = node.data as { outputDefs?: Array<{ name: string; type?: string }> };
        return data.outputDefs && data.outputDefs.length > 0;
      })
      .flatMap((node) => {
        const data = node.data as { name: string; outputDefs: Array<{ name: string; type?: string }> };
        return data.outputDefs.map((output) => ({
          nodeId: data.name,  // Use step name (not node.id) - matches backend step_context keys
          nodeName: data.name,
          outputName: output.name,
          outputType: output.type,
        }));
      });
  }, [nodes]);

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

      {/* Output Source Mapping - where each output value comes from */}
      {value.outputs.length > 0 && availableNodeOutputs.length > 0 && (
        <OutputSourceSection
          outputs={value.outputs}
          onOutputsChange={(outputs) => handleChange({ outputs })}
          availableNodeOutputs={availableNodeOutputs}
          isReadOnly={isReadOnly}
        />
      )}

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
