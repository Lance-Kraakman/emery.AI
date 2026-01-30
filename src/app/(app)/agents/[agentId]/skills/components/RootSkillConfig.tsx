'use client';

import React, { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TableGroupedInputPanel } from '@/components/skill-config/TableGroupedInputPanel';
import { TableGroupedOutputPanel } from '@/components/skill-config/TableGroupedOutputPanel';
import { OutputSourceSection } from './editor/OutputSourceSection';
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
 * Contains: description, inputs (table-grouped), outputs (table-grouped), output sources.
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
          nodeId: node.id,  // UUID - matches backend step_context keys (keyed by step.id)
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

      {/* Inputs (table-grouped) */}
      <TableGroupedInputPanel
        inputs={value.inputs}
        onInputsChange={(inputs) => handleChange({ inputs })}
        isReadOnly={isReadOnly}
      />

      {/* Outputs (table-grouped) */}
      <TableGroupedOutputPanel
        outputs={value.outputs}
        inputs={value.inputs}
        onOutputsChange={(outputs) => handleChange({ outputs })}
        isReadOnly={isReadOnly}
      />

      {/* Output Source Mapping - where each output value comes from (workflow-specific) */}
      {value.outputs.length > 0 && availableNodeOutputs.length > 0 && (
        <OutputSourceSection
          outputs={value.outputs}
          onOutputsChange={(outputs) => handleChange({ outputs })}
          availableNodeOutputs={availableNodeOutputs}
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
}
