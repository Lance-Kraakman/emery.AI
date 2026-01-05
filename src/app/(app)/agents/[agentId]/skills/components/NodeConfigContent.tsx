'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TaskModelForm } from './editor/TaskModelForm';
import { ToolExecutionConfigForm } from './editor/ToolExecutionConfigForm';
import { WriteConfigForm } from './editor/WriteConfigForm';
import { InputDefinitionsSection } from './editor/InputDefinitionsSection';
import { OutputDefinitionsSection } from './editor/OutputDefinitionsSection';
import { WorkflowVariableInput, type WorkflowVariable } from '@/components/workflow-canvas/WorkflowVariableInput';
import { UnifiedChatInput } from '@/components/shared/UnifiedChatInput';
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
import type { InputDefinition, OutputDefinition } from '@/app/mappers/skill-mapper';

interface NodeConfigContentProps {
  node: WorkflowNode;
  onUpdateNode: (id: string, data: Partial<WorkflowNodeData>) => void;
  skillInputs: InputDefinition[];
  availableSkills: AvailableSkill[];
  workflowVariables?: WorkflowVariable[];
  organizationTier?: 'free' | 'pro' | 'max' | 'enterprise';
  disabled?: boolean;
}

/**
 * Node configuration content component.
 * Renders the appropriate configuration form based on node type.
 * Uses full forms (TaskModelForm, ToolExecutionConfigForm, WriteConfigForm) for operation/tool/write nodes.
 */
export function NodeConfigContent({
  node,
  onUpdateNode,
  skillInputs,
  availableSkills,
  workflowVariables = [],
  organizationTier = 'free',
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
          skillInputs={skillInputs}
          disabled={disabled}
        />
      )}

      {type === 'read' && (
        <ReadConfig
          data={data as ReadNodeData}
          onUpdate={handleUpdate}
          skillInputs={skillInputs}
          disabled={disabled}
        />
      )}

      {/* Node Inputs Section - what this node needs */}
      {(type === 'agentic' || type === 'tool' || type === 'write') && (
        <div className="space-y-2 pt-2 border-t">
          <Label className="text-xs font-medium">Inputs</Label>
          <p className="text-[10px] text-muted-foreground">
            Variables this node receives
          </p>
          <InputDefinitionsSection
            inputs={data.inputDefs || []}
            onInputsChange={(inputs) => handleUpdate({ inputDefs: inputs })}
            isReadOnly={disabled}
          />
        </div>
      )}

      {/* Node Outputs Section - what this node produces */}
      {(type === 'agentic' || type === 'operation' || type === 'tool' || type === 'read') && (
        <div className="space-y-2 pt-2 border-t">
          <Label className="text-xs font-medium">Outputs</Label>
          <p className="text-[10px] text-muted-foreground">
            Variables this node produces for subsequent steps
          </p>
          <OutputDefinitionsSection
            outputs={data.outputDefs || []}
            onOutputsChange={(outputs) => handleUpdate({ outputDefs: outputs })}
            isReadOnly={disabled}
          />
        </div>
      )}

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

// =============================================================================
// Type-specific config components
// =============================================================================

function SkillRefConfig({
  data,
  onUpdate,
  availableSkills,
  disabled,
}: {
  data: SkillRefNodeData;
  onUpdate: (updates: Partial<WorkflowNodeData>) => void;
  availableSkills: AvailableSkill[];
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="skillId" className="text-xs">
        Select Skill
      </Label>
      <Select
        value={data.skillId?.toString() || ''}
        onValueChange={(value) => {
          const skill = availableSkills.find((s) => s.id.toString() === value);
          onUpdate({
            skillId: parseInt(value),
            skillName: skill?.name,
            skillType: skill?.executionType,
          });
        }}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Choose a skill..." />
        </SelectTrigger>
        <SelectContent>
          {availableSkills.map((skill) => (
            <SelectItem key={skill.id} value={skill.id.toString()}>
              <span className="flex items-center gap-2">
                {skill.name}
                {skill.executionType && (
                  <span className="text-[10px] text-muted-foreground">
                    ({skill.executionType})
                  </span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ConditionConfig({
  data,
  onUpdate,
  variables,
  disabled,
}: {
  data: ConditionNodeData;
  onUpdate: (updates: Partial<WorkflowNodeData>) => void;
  variables: WorkflowVariable[];
  disabled?: boolean;
}) {
  const conditions = data.conditions || [];

  const updateCondition = (index: number, expression: string) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], expression };
    onUpdate({ conditions: newConditions });
  };

  const addCondition = () => {
    onUpdate({
      conditions: [
        ...conditions,
        { expression: '', label: `Condition ${conditions.length + 1}` },
      ],
    });
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">Conditions</Label>
      {conditions.map((cond, i) => (
        <div key={i} className="space-y-1">
          <WorkflowVariableInput
            value={cond.expression}
            onChange={(value) => updateCondition(i, value)}
            variables={variables}
            placeholder={`e.g., {{result}} > 100`}
            disabled={disabled}
            className="h-8"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={addCondition}
        disabled={disabled}
        className="text-xs text-primary hover:underline"
      >
        + Add condition
      </button>
    </div>
  );
}

function LoopConfig({
  data,
  onUpdate,
  variables,
  disabled,
}: {
  data: LoopNodeData;
  onUpdate: (updates: Partial<WorkflowNodeData>) => void;
  variables: WorkflowVariable[];
  disabled?: boolean;
}) {
  const loopConfig = data.loopConfig || {
    type: 'for_each' as const,
    itemsVar: '',
    currentItemVar: 'item',
    maxIterations: 100,
  };

  const updateLoopConfig = (updates: Record<string, unknown>) => {
    onUpdate({ loopConfig: { ...loopConfig, ...updates } });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Loop Type</Label>
        <Select
          value={loopConfig.type}
          onValueChange={(value) => updateLoopConfig({ type: value })}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="for_each">For Each</SelectItem>
            <SelectItem value="while">While</SelectItem>
            <SelectItem value="until">Until</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loopConfig.type === 'for_each' ? (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Items Variable</Label>
            <WorkflowVariableInput
              value={loopConfig.itemsVar || ''}
              onChange={(value) => updateLoopConfig({ itemsVar: value })}
              variables={variables}
              placeholder="e.g., users"
              disabled={disabled}
              className="h-8"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Current Item Variable</Label>
            <Input
              value={loopConfig.currentItemVar || 'item'}
              onChange={(e) =>
                updateLoopConfig({ currentItemVar: e.target.value })
              }
              placeholder="item"
              disabled={disabled}
              className="h-8 text-sm"
            />
          </div>
        </>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-xs">Condition</Label>
          <WorkflowVariableInput
            value={loopConfig.condition || ''}
            onChange={(value) => updateLoopConfig({ condition: value })}
            variables={variables}
            placeholder={`e.g., {{count}} < 10`}
            disabled={disabled}
            className="h-8"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Max Iterations</Label>
        <Input
          type="number"
          value={loopConfig.maxIterations || 100}
          onChange={(e) =>
            updateLoopConfig({ maxIterations: parseInt(e.target.value) || 100 })
          }
          disabled={disabled}
          className="h-8 text-sm"
        />
      </div>
    </div>
  );
}

function AgenticConfig({
  data,
  onUpdate,
  variables,
  disabled,
}: {
  data: AgenticNodeData;
  onUpdate: (updates: Partial<WorkflowNodeData>) => void;
  variables: WorkflowVariable[];
  disabled?: boolean;
}) {
  // Convert WorkflowVariable to the format expected by UnifiedChatInput
  const chatVariables = variables.map(v => ({
    name: v.name,
    description: v.description || v.label || '',
  }));

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="instructions" className="text-xs">
          Instructions
        </Label>
        <UnifiedChatInput
          mode="form"
          minHeight="120px"
          value={data.instructions}
          onChange={(value) => onUpdate({ instructions: value })}
          variables={chatVariables}
          enableSendButton={false}
          disabled={disabled}
          placeholder="Describe what this step should do... (@ for tools, { for variables)"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Agent Type</Label>
        <Select
          value={data.agentType || 'tool_calling'}
          onValueChange={(value) => onUpdate({ agentType: value })}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tool_calling">Tool Calling</SelectItem>
            <SelectItem value="code_agent">Code Agent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data.tools && data.tools.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Tools ({data.tools.length})</Label>
          <div className="flex flex-wrap gap-1">
            {data.tools.map((tool, idx) => (
              <span
                key={idx}
                className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300"
              >
                {tool.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Operation node config - uses the full TaskModelForm
 */
function OperationConfig({
  data,
  onUpdate,
  organizationTier,
  disabled,
}: {
  data: OperationNodeData;
  onUpdate: (updates: Partial<WorkflowNodeData>) => void;
  organizationTier?: 'free' | 'pro' | 'max' | 'enterprise';
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <TaskModelForm
        value={data.taskModelConfig}
        onChange={(taskModelConfig) => onUpdate({ taskModelConfig })}
        onInputsChange={(inputs) => onUpdate({ inputDefs: inputs })}
        onOutputsChange={(outputs) => onUpdate({ outputDefs: outputs })}
        onInstructionsChange={(promptTemplate) => onUpdate({ promptTemplate })}
        organizationTier={organizationTier}
        isReadOnly={disabled}
      />

      {data.promptTemplate !== undefined && (
        <div className="space-y-1.5">
          <Label htmlFor="promptTemplate" className="text-xs">
            Prompt Template
          </Label>
          <Textarea
            id="promptTemplate"
            value={data.promptTemplate || ''}
            onChange={(e) => onUpdate({ promptTemplate: e.target.value })}
            placeholder="Enter prompt template (use {{input}} for variables)..."
            disabled={disabled}
            className="min-h-[80px] text-sm"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Tool node config - uses the full ToolExecutionConfigForm
 */
function ToolConfig({
  data,
  onUpdate,
  skillInputs,
  disabled,
}: {
  data: ToolNodeData;
  onUpdate: (updates: Partial<WorkflowNodeData>) => void;
  skillInputs: InputDefinition[];
  disabled?: boolean;
}) {
  return (
    <ToolExecutionConfigForm
      value={data.toolExecutionConfig}
      onChange={(toolExecutionConfig) => onUpdate({ toolExecutionConfig })}
      skillInputs={skillInputs}
      onInputDefinitionsChange={(inputs) => onUpdate({ inputDefs: inputs })}
      disabled={disabled}
    />
  );
}

/**
 * Write node config - uses the full WriteConfigForm
 */
function WriteConfig({
  data,
  onUpdate,
  skillInputs,
  disabled,
}: {
  data: WriteNodeData;
  onUpdate: (updates: Partial<WorkflowNodeData>) => void;
  skillInputs: InputDefinition[];
  disabled?: boolean;
}) {
  return (
    <WriteConfigForm
      value={data.writeConfig}
      onChange={(writeConfig) => onUpdate({ writeConfig })}
      skillInputs={skillInputs}
      onInputDefinitionsChange={(inputs) => onUpdate({ inputDefs: inputs })}
      disabled={disabled}
    />
  );
}

/**
 * Read node config - database read configuration
 */
function ReadConfig({
  data,
  onUpdate,
  skillInputs,
  disabled,
}: {
  data: ReadNodeData;
  onUpdate: (updates: Partial<WorkflowNodeData>) => void;
  skillInputs: InputDefinition[];
  disabled?: boolean;
}) {
  const readConfig = data.readConfig || {
    mode: 'single_row' as const,
    sourceTableId: 0,
    fieldMappings: [],
  };

  const updateReadConfig = (updates: Partial<typeof readConfig>) => {
    onUpdate({ readConfig: { ...readConfig, ...updates } });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Read Mode</Label>
        <Select
          value={readConfig.mode}
          onValueChange={(value: 'single_row' | 'query') =>
            updateReadConfig({ mode: value })
          }
          disabled={disabled}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single_row">Single Row</SelectItem>
            <SelectItem value="query">Query (Multiple Rows)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Source Table ID</Label>
        <Input
          type="number"
          value={readConfig.sourceTableId || 0}
          onChange={(e) =>
            updateReadConfig({ sourceTableId: parseInt(e.target.value) || 0 })
          }
          placeholder="Table ID"
          disabled={disabled}
          className="h-8 text-sm"
        />
        <p className="text-[10px] text-muted-foreground">
          Enter the Baserow table ID to read from
        </p>
      </div>

      {readConfig.mode === 'query' && (
        <div className="space-y-1.5">
          <Label className="text-xs">Max Results</Label>
          <Input
            type="number"
            value={readConfig.queryLimit || 100}
            onChange={(e) =>
              updateReadConfig({ queryLimit: parseInt(e.target.value) || 100 })
            }
            placeholder="100"
            disabled={disabled}
            className="h-8 text-sm"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Field Mappings ({readConfig.fieldMappings?.length || 0})</Label>
        <p className="text-[10px] text-muted-foreground">
          Configure which table fields map to output variables in the Output section below
        </p>
      </div>
    </div>
  );
}
