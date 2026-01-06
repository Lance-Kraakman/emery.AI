'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Settings2 } from 'lucide-react';
import type {
  NodeConfigPanelProps,
  SkillRefNodeData,
  ConditionNodeData,
  LoopNodeData,
  AgenticNodeData,
  OperationNodeData,
  ToolNodeData,
  WriteNodeData,
} from './types';

/**
 * NodeConfigPanel - Side panel for editing selected node
 */
export function NodeConfigPanel({
  nodeId,
  nodes,
  onUpdateNode,
  skillInputs,
  availableSkills,
  disabled,
}: NodeConfigPanelProps) {
  const selectedNode = nodes.find((n) => n.id === nodeId);

  if (!selectedNode) {
    return (
      <Card className="shadow-lg">
        <CardContent className="p-6 text-center text-muted-foreground">
          <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a node to configure</p>
        </CardContent>
      </Card>
    );
  }

  // Sticky notes don't have config panel
  if (selectedNode.type === 'sticky') {
    return (
      <Card className="shadow-lg">
        <CardContent className="p-6 text-center text-muted-foreground">
          <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Sticky note selected</p>
          <p className="text-xs mt-1">Double-click to edit</p>
        </CardContent>
      </Card>
    );
  }

  const { type } = selectedNode;
  // After sticky check, we know data is WorkflowNodeData
  const data = selectedNode.data as import('./types').WorkflowNodeData;

  const handleUpdate = (updates: Record<string, any>) => {
    onUpdateNode(nodeId!, updates);
  };

  return (
    <Card className="shadow-lg max-h-[500px] overflow-y-auto">
      <CardHeader className="p-3 pb-2 sticky top-0 bg-card z-10 border-b">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Configure Node
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-4">
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

        {/* Type-specific fields */}
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
            disabled={disabled}
          />
        )}

        {type === 'loop' && (
          <LoopConfig
            data={data as LoopNodeData}
            onUpdate={handleUpdate}
            disabled={disabled}
          />
        )}

        {type === 'agentic' && (
          <AgenticConfig
            data={data as AgenticNodeData}
            onUpdate={handleUpdate}
            disabled={disabled}
          />
        )}

        {type === 'operation' && (
          <OperationConfig
            data={data as OperationNodeData}
            onUpdate={handleUpdate}
            disabled={disabled}
          />
        )}

        {type === 'tool' && (
          <ToolConfig
            data={data as ToolNodeData}
            onUpdate={handleUpdate}
            disabled={disabled}
          />
        )}

        {type === 'write' && (
          <WriteConfig
            data={data as WriteNodeData}
            onUpdate={handleUpdate}
            disabled={disabled}
          />
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
      </CardContent>
    </Card>
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
  onUpdate: (updates: Record<string, any>) => void;
  availableSkills: { id: number; name: string; executionType?: string }[];
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
  disabled,
}: {
  data: ConditionNodeData;
  onUpdate: (updates: Record<string, any>) => void;
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
          <Input
            value={cond.expression}
            onChange={(e) => updateCondition(i, e.target.value)}
            placeholder={`e.g., {{result}} > 100`}
            disabled={disabled}
            className="h-8 text-sm"
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
  disabled,
}: {
  data: LoopNodeData;
  onUpdate: (updates: Record<string, any>) => void;
  disabled?: boolean;
}) {
  const loopConfig = data.loopConfig || {
    type: 'for_each' as const,
    itemsVar: '',
    currentItemVar: 'item',
    maxIterations: 100,
  };

  const updateLoopConfig = (updates: Record<string, any>) => {
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
            <Input
              value={loopConfig.itemsVar || ''}
              onChange={(e) => updateLoopConfig({ itemsVar: e.target.value })}
              placeholder="e.g., users"
              disabled={disabled}
              className="h-8 text-sm"
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
          <Input
            value={loopConfig.condition || ''}
            onChange={(e) => updateLoopConfig({ condition: e.target.value })}
            placeholder={`e.g., {{count}} < 10`}
            disabled={disabled}
            className="h-8 text-sm"
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

// =============================================================================
// New node type config components
// =============================================================================

function AgenticConfig({
  data,
  onUpdate,
  disabled,
}: {
  data: AgenticNodeData;
  onUpdate: (updates: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="instructions" className="text-xs">
          Instructions
        </Label>
        <Textarea
          id="instructions"
          value={data.instructions}
          onChange={(e) => onUpdate({ instructions: e.target.value })}
          placeholder="Enter instructions for the LLM..."
          disabled={disabled}
          className="min-h-[100px] text-sm"
        />
        <p className="text-[10px] text-muted-foreground">
          Use {'{{variable}}'} to reference inputs or previous step outputs
        </p>
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

function OperationConfig({
  data,
  onUpdate,
  disabled,
}: {
  data: OperationNodeData;
  onUpdate: (updates: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  const taskModelConfig = data.taskModelConfig;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Task Type</Label>
        <Select
          value={taskModelConfig?.taskType || ''}
          onValueChange={(value) =>
            onUpdate({
              taskModelConfig: { ...taskModelConfig, taskType: value },
            })
          }
          disabled={disabled}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select task type..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text-to-image">Text to Image</SelectItem>
            <SelectItem value="image-to-image">Image to Image</SelectItem>
            <SelectItem value="speech-to-text">Speech to Text</SelectItem>
            <SelectItem value="text-to-speech">Text to Speech</SelectItem>
            <SelectItem value="summarization">Summarization</SelectItem>
            <SelectItem value="translation">Translation</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="modelId" className="text-xs">
          Model ID
        </Label>
        <Input
          id="modelId"
          value={taskModelConfig?.modelId || ''}
          onChange={(e) =>
            onUpdate({
              taskModelConfig: { ...taskModelConfig, modelId: e.target.value },
            })
          }
          placeholder="e.g., black-forest-labs/FLUX.1-schnell"
          disabled={disabled}
          className="h-8 text-sm"
        />
      </div>

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
          className="min-h-[60px] text-sm"
        />
      </div>
    </div>
  );
}

function ToolConfig({
  data,
  onUpdate,
  disabled,
}: {
  data: ToolNodeData;
  onUpdate: (updates: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  const toolConfig = data.toolExecutionConfig;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="toolId" className="text-xs">
          Tool ID
        </Label>
        <Input
          id="toolId"
          value={toolConfig?.toolId || ''}
          onChange={(e) =>
            onUpdate({
              toolExecutionConfig: { ...toolConfig, toolId: e.target.value },
            })
          }
          placeholder="e.g., gmail-send-email"
          disabled={disabled}
          className="h-8 text-sm"
        />
        <p className="text-[10px] text-muted-foreground">
          Pipedream tool identifier
        </p>
      </div>

      {toolConfig?.inputMappings && toolConfig.inputMappings.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">
            Input Mappings ({toolConfig.inputMappings.length})
          </Label>
          <div className="space-y-1 text-xs text-muted-foreground">
            {toolConfig.inputMappings.map((mapping, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{mapping.toolParam}</span>
                <span>
                  {mapping.skillInputName || mapping.staticValue?.toString() || '-'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WriteConfig({
  data,
  onUpdate,
  disabled,
}: {
  data: WriteNodeData;
  onUpdate: (updates: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  const writeConfig = data.writeConfig;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Row Action</Label>
        <Select
          value={writeConfig?.rowAction || 'create'}
          onValueChange={(value) =>
            onUpdate({
              writeConfig: { ...writeConfig, rowAction: value },
            })
          }
          disabled={disabled}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="create">Create Row</SelectItem>
            <SelectItem value="update">Update Row</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="targetTableId" className="text-xs">
          Target Table ID
        </Label>
        <Input
          id="targetTableId"
          type="number"
          value={writeConfig?.targetTableId || ''}
          onChange={(e) =>
            onUpdate({
              writeConfig: {
                ...writeConfig,
                targetTableId: parseInt(e.target.value) || 0,
              },
            })
          }
          placeholder="Table ID"
          disabled={disabled}
          className="h-8 text-sm"
        />
      </div>

      {writeConfig?.fieldMappings && writeConfig.fieldMappings.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">
            Field Mappings ({writeConfig.fieldMappings.length})
          </Label>
          <div className="space-y-1 text-xs text-muted-foreground">
            {writeConfig.fieldMappings.map((mapping, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{mapping.skillInputName}</span>
                <span>Field #{mapping.targetFieldId}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
