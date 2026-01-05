'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { WorkflowVariable } from '@/components/workflow-canvas/WorkflowVariableInput';
import type {
  WorkflowNode,
  WorkflowNodeData,
  SkillRefNodeData,
  ConditionNodeData,
  LoopNodeData,
  AgenticNodeData,
  OperationNodeData,
  ToolNodeData,
  WriteNodeData,
  ReadNodeData,
  AvailableSkill,
} from '@/components/workflow-canvas/types';
import type { InputDefinition } from '@/app/mappers/skill-mapper';

// Import type-specific config components
import {
  SkillRefConfig,
  ConditionConfig,
  LoopConfig,
  AgenticConfig,
  OperationConfig,
  ToolConfig,
  WriteConfig,
  ReadConfig,
} from './node-configs';

interface NodeConfigContentProps {
  node: WorkflowNode;
  onUpdateNode: (id: string, data: Partial<WorkflowNodeData>) => void;
  skillInputs: InputDefinition[];
  availableSkills: AvailableSkill[];
  workflowVariables?: WorkflowVariable[];
  organizationTier?: 'free' | 'pro' | 'max' | 'enterprise';
  skillId?: number;
  disabled?: boolean;
}

/**
 * Node configuration content component.
 * Renders the appropriate configuration form based on node type.
 * Uses dedicated config components from node-configs/ for each node type.
 */
export function NodeConfigContent({
  node,
  onUpdateNode,
  skillInputs,
  availableSkills,
  workflowVariables = [],
  organizationTier = 'free',
  skillId,
  disabled = false,
}: NodeConfigContentProps) {
  const { type, data } = node;

  const handleUpdate = (updates: Partial<WorkflowNodeData>) => {
    onUpdateNode(node.id, updates);
  };

  return (
    <div className="space-y-4">
      {/* Name field - common to all */}
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-xs">
          Name
        </Label>
        <Input
          id="name"
          value={data.name}
          onChange={(e) => handleUpdate({ name: e.target.value })}
          disabled={disabled}
          className="h-8 text-sm"
        />
      </div>

      {/* Type-specific configuration */}
      {type === 'skillRef' && (
        <SkillRefConfig
          data={data as SkillRefNodeData}
          onUpdate={handleUpdate}
          availableSkills={availableSkills}
          disabled={disabled}
        />
      )}

      {type === 'condition' && (
        <ConditionConfig
          data={data as ConditionNodeData}
          onUpdate={handleUpdate}
          variables={workflowVariables}
          disabled={disabled}
        />
      )}

      {type === 'loop' && (
        <LoopConfig
          data={data as LoopNodeData}
          onUpdate={handleUpdate}
          variables={workflowVariables}
          disabled={disabled}
        />
      )}

      {type === 'agentic' && (
        <AgenticConfig
          data={data as AgenticNodeData}
          onUpdate={handleUpdate}
          variables={workflowVariables}
          skillId={skillId}
          disabled={disabled}
        />
      )}

      {type === 'operation' && (
        <OperationConfig
          data={data as OperationNodeData}
          onUpdate={handleUpdate}
          organizationTier={organizationTier}
          disabled={disabled}
        />
      )}

      {type === 'tool' && (
        <ToolConfig
          data={data as ToolNodeData}
          onUpdate={handleUpdate}
          skillInputs={skillInputs}
          disabled={disabled}
        />
      )}

      {type === 'write' && (
        <WriteConfig
          data={data as WriteNodeData}
          onUpdate={handleUpdate}
          workflowVariables={workflowVariables}
          disabled={disabled}
        />
      )}

      {type === 'read' && (
        <ReadConfig
          data={data as ReadNodeData}
          onUpdate={handleUpdate}
          workflowVariables={workflowVariables}
          disabled={disabled}
        />
      )}

      {/*
        Note: Input/Output definitions are now auto-inferred from connections.
        See variable-inference.ts for the logic.
        - Skill inputs are always available
        - Node outputs are inferred by type (agentic → result, read → fieldMappings, etc.)
        - Upstream node outputs flow to downstream nodes via edges
      */}

      {/* Error handling - common to all */}
      <div className="space-y-2 pt-2 border-t">
        <Label className="text-xs font-medium">Error Handling</Label>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Continue on error
          </span>
          <Switch
            checked={data.errorConfig?.continueOnError ?? false}
            onCheckedChange={(checked) =>
              handleUpdate({
                errorConfig: { ...data.errorConfig, continueOnError: checked },
              })
            }
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
