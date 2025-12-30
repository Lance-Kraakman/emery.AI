'use client';

import React, { useState } from 'react';
import { Save, X, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModelSelector } from '@/components/ai/ModelSelector';
import { InstructionsInput } from './editor/InstructionsInput';
import { InputDefinitionsSection } from './editor/InputDefinitionsSection';
import { OutputDefinitionsSection } from './editor/OutputDefinitionsSection';
import { ExecutionTypeToggle } from './editor/ExecutionTypeToggle';
import { TaskModelForm } from './editor/TaskModelForm';
import { OutputMappingSection } from './editor/OutputMappingSection';
import { InputMappingSection } from './editor/InputMappingSection';
import { ToolExecutionConfigForm } from './editor/ToolExecutionConfigForm';
import { WriteConfigForm } from './editor/WriteConfigForm';
import { StepBuilderSection } from './editor/StepBuilderSection';
import type { ToolConfigDTO, InputDefinition, OutputDefinition } from '@/app/mappers/skill-mapper';
import type { MessagePart } from '@/lib/grpc/generated/agent_worker';
import type { SkillExecutionType } from '@/ddd/domain/skills/entities/skill';

export interface SkillFormData {
  name: string;
  description: string;
  inputs: InputDefinition[];
  outputs: OutputDefinition[];
  instructions: string;
  tools: ToolConfigDTO[];
  model?: string | null;
  agentType?: string | null;
  content?: MessagePart[];
  pendingAttachments?: File[];
  executionType?: SkillExecutionType;
  taskModelConfig?: {
    modelId: string;
    taskType: string;
    parameters?: Record<string, any>;
  };
  toolExecutionConfig?: {
    toolId: string;
    inputMappings: Array<{ toolParam: string; skillInputName?: string; staticValue?: any }>;
  };
  writeConfig?: {
    targetTableId: number;
    rowAction: 'create' | 'update';
    fieldMappings: Array<{ skillInputName: string; targetFieldId: number }>;
    updateMatch?: { skillInputName: string; targetFieldId: number };
  };
  steps?: Array<{
    name: string;
    instruction?: string;
    skillId?: number;
    tools?: string[];
    inputs?: Record<string, string>;
    outputs?: Record<string, string>;
    parallel?: boolean;
    condition?: string;
  }>;
}

interface SkillEditorProps {
  value: SkillFormData;
  onChange: (value: SkillFormData) => void;
  agentId?: number | null;
  skillId?: number;
  onSave?: () => void;
  isSaving?: boolean;
  agentDefaultModel?: string | null;
  organizationTier?: 'free' | 'pro' | 'max' | 'enterprise';
  availableModels?: string[];
  availableSkills?: { id: number; name: string }[];
  isReadOnly?: boolean;
}

/**
 * Get default field values when switching execution modes.
 * Clears mode-specific fields that don't apply to the new mode.
 * Note: steps is only used by 'agent' mode - clear it for other modes.
 */
function getDefaultsForMode(mode: SkillExecutionType): Partial<SkillFormData> {
  const base = {
    taskModelConfig: undefined,
    toolExecutionConfig: undefined,
    writeConfig: undefined,
    // Note: steps NOT included in base - only 'agent' mode uses steps
  };

  switch (mode) {
    case 'agentic':
      return { ...base, steps: undefined };  // Clear steps
    case 'agent':
      return { ...base, instructions: '', tools: [] };  // KEEP steps for agent mode
    case 'operation':
      return { ...base, tools: [], steps: undefined };  // Clear steps
    case 'tool':
      return { ...base, instructions: '', tools: [], outputs: [], steps: undefined };
    case 'write':
      return { ...base, instructions: '', tools: [], outputs: [], steps: undefined };
    default:
      return { ...base, steps: undefined };
  }
}

/**
 * Simplified Skill Editor
 *
 * Uses controlled component pattern - receives value prop directly,
 * calls onChange for all updates. No internal state mirroring.
 */
export function SkillEditor({
  value,
  onChange,
  agentId,
  skillId,
  onSave,
  isSaving,
  agentDefaultModel,
  organizationTier = 'free',
  availableModels,
  availableSkills = [],
  isReadOnly = false,
}: SkillEditorProps) {
  const [showDescription, setShowDescription] = useState(false);

  // Direct update handler - no local state, just merge updates and call parent
  const handleChange = (updates: Partial<SkillFormData>) => {
    if ('steps' in updates) {
      console.log('[SkillEditor] handleChange steps:', {
        currentValueSteps: value.steps,
        updateSteps: updates.steps,
        mergedSteps: { ...value, ...updates }.steps
      });
    }
    onChange({ ...value, ...updates });
  };

  // Attachment handlers
  const handleAttachmentAdd = (file: File) => {
    handleChange({ pendingAttachments: [...(value.pendingAttachments || []), file] });
  };

  const handleAttachmentRemove = (index: number) => {
    handleChange({ pendingAttachments: (value.pendingAttachments || []).filter((_, i) => i !== index) });
  };

  const handleExistingAttachmentRemove = (index: number) => {
    handleChange({ content: (value.content || []).filter((_, i) => i !== index) });
  };

  // Convert MessageParts to existingAttachments format for UnifiedChatInput
  const existingAttachments = (value.content || [])
    .filter(part => part.imageUrl || part.file)
    .map(part => ({
      url: part.imageUrl?.url || part.file?.url || '',
      filename: part.file?.filename || 'Image',
      type: (part.imageUrl ? 'image' : 'file') as 'image' | 'file',
      size: part.file?.size
    }));

  // Handle execution mode change - reset to defaults for new mode
  const handleModeChange = (newMode: SkillExecutionType) => {
    const currentMode = value.executionType || 'agentic';
    if (currentMode === newMode) return;

    handleChange({
      executionType: newMode,
      ...getDefaultsForMode(newMode)
    });
  };

  return (
    <div className="space-y-4">
      {/* Compact Header: Name + Model + Create */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              id="name"
              value={value.name}
              onChange={(e) => handleChange({ name: e.target.value })}
              placeholder="Skill name..."
              className="h-9"
              disabled={isReadOnly}
            />
          </div>
          {value.executionType !== 'operation' && (
            <ModelSelector
              value={value.model}
              onChange={(model) => handleChange({ model })}
              organizationTier={organizationTier}
              availableModels={availableModels}
              showInherit={true}
              inheritLabel="Inherit"
              inheritFromModel={agentDefaultModel || 'IBM Granite 3.3 8B'}
              requiredCapabilities={['toolCalling']}
              disabled={isReadOnly}
              className="w-[180px] h-9"
            />
          )}
          {onSave && (
            <Button onClick={onSave} disabled={isSaving} className="h-9">
              <Save className="h-4 w-4 mr-1.5" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>

        {/* Inline: Execution Toggle + Add Description */}
        <div className="flex items-center gap-3">
          <ExecutionTypeToggle
            value={value.executionType || 'agentic'}
            onChange={handleModeChange}
            disabled={isReadOnly}
          />
          {!isReadOnly && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto py-0.5 px-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowDescription(!showDescription)}
            >
              {showDescription ? 'Hide description' : '+ Description'}
            </Button>
          )}
        </div>

        {/* Collapsible Description */}
        {(showDescription || (isReadOnly && value.description)) && (
          <Textarea
            id="description"
            value={value.description}
            onChange={(e) => handleChange({ description: e.target.value })}
            placeholder="Briefly describe what this skill does..."
            rows={2}
            className="text-sm"
            disabled={isReadOnly}
          />
        )}
      </div>

      {/* Conditional Form Based on Execution Type */}
      {value.executionType === 'operation' ? (
        /* Direct Mode Form - Compact, auto-configures inputs/outputs */
        <>
          <TaskModelForm
            value={value.taskModelConfig}
            onChange={(taskModelConfig) => handleChange({ taskModelConfig })}
            onInputsChange={(inputs) => handleChange({ inputs })}
            onOutputsChange={(outputs) => handleChange({ outputs })}
            onInstructionsChange={(instructions) => handleChange({ instructions })}
            organizationTier={organizationTier}
            isReadOnly={isReadOnly}
          />

          {/* Prompt Template - Only for operations with text inputs */}
          {value.taskModelConfig?.taskType && value.inputs.some(input => input.type === 'text') && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Prompt Template</Label>
              <InstructionsInput
                value={value.instructions}
                onChange={(text) => handleChange({ instructions: text })}
                onToolsChange={() => {}}
                tools={[]}
                stepIndex={0}
                isReadOnly={isReadOnly}
              />
              <p className="text-xs text-muted-foreground">
                Use {'{{ input_name }}'} syntax. Leave empty to pass input directly.
              </p>
            </div>
          )}

          {/* Output Mapping Section - for Direct/Operation mode */}
          {value.taskModelConfig?.taskType && value.outputs.length > 0 && (
            <OutputMappingSection
              outputs={value.outputs}
              onOutputsChange={(outputs) => handleChange({ outputs })}
              executionType="operation"
              taskType={value.taskModelConfig?.taskType}
              skillInputs={value.inputs}
              isReadOnly={isReadOnly}
            />
          )}
        </>
      ) : value.executionType === 'tool' ? (
        /* Tool Mode Form - Pipedream tool selector + input mappings */
        <>
          <ToolExecutionConfigForm
            value={value.toolExecutionConfig}
            onChange={(config) => handleChange({ toolExecutionConfig: config })}
            skillInputs={value.inputs}
            onInputDefinitionsChange={(inputs) => handleChange({ inputs })}
            disabled={isReadOnly}
          />

          {/* Show skill inputs for reference/editing */}
          {value.inputs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">Skill Inputs</Label>
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
                These inputs were auto-generated from the tool&apos;s parameters.
              </p>
            </div>
          )}
        </>
      ) : value.executionType === 'write' ? (
        /* Write Mode Form - Inputs first, then table selector + field mappings */
        <>
          {/* Skill Inputs Section - FIRST */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Skill Inputs</Label>
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
              Define inputs that will be mapped to table fields.
            </p>
          </div>

          {/* Table Write Configuration - AFTER inputs */}
          <WriteConfigForm
            value={value.writeConfig}
            onChange={(config) => handleChange({ writeConfig: config })}
            skillInputs={value.inputs}
            onInputDefinitionsChange={(inputs) => handleChange({ inputs })}
            disabled={isReadOnly}
          />
        </>
      ) : value.executionType === 'agent' ? (
        /* Agent Form - Step-based DAG workflow */
        <>
          {/* Inputs Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Inputs</Label>
              <span className="text-xs text-muted-foreground">
                {value.inputs.length} input{value.inputs.length !== 1 ? 's' : ''}
              </span>
            </div>
            <InputDefinitionsSection
              inputs={value.inputs}
              onInputsChange={(inputs) => handleChange({ inputs })}
              isReadOnly={isReadOnly}
            />
          </div>

          {/* Input Mapping Section - for Agent mode */}
          <InputMappingSection
            inputs={value.inputs}
            onInputsChange={(inputs) => handleChange({ inputs })}
            isReadOnly={isReadOnly}
          />

          {/* Steps Section */}
          <StepBuilderSection
            steps={value.steps || []}
            onChange={(steps) => handleChange({ steps })}
            skillInputs={value.inputs}
            availableSkills={availableSkills}
            disabled={isReadOnly}
          />

          {/* Outputs Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Outputs</Label>
              <span className="text-xs text-muted-foreground">
                {value.outputs.length} output{value.outputs.length !== 1 ? 's' : ''}
              </span>
            </div>
            <OutputDefinitionsSection
              outputs={value.outputs}
              onOutputsChange={(outputs) => handleChange({ outputs })}
              isReadOnly={isReadOnly}
            />
          </div>

          {/* Output Mapping Section - for Agent mode (maps skill outputs to tables) */}
          <OutputMappingSection
            outputs={value.outputs}
            onOutputsChange={(outputs) => handleChange({ outputs })}
            executionType="agent"
            skillOutputs={value.outputs}
            skillInputs={value.inputs}
            isReadOnly={isReadOnly}
          />
        </>
      ) : (
        /* Agentic Form (default) - Flat instructions with LLM orchestration */
        <>
          {/* Inputs Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Inputs</Label>
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
              Reference inputs in instructions using {'{input_name}'} syntax
            </p>
          </div>

          {/* Input Mapping Section - for Agentic mode */}
          <InputMappingSection
            inputs={value.inputs}
            onInputsChange={(inputs) => handleChange({ inputs })}
            isReadOnly={isReadOnly}
          />

          {/* Instructions Section */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Instructions</Label>

            {/* Selected Tools Display - ABOVE instructions (like chat UI) */}
            {value.tools.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {value.tools.map((tool, index) => (
                  <div key={index} className="relative flex items-center group">
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs
                        transition-colors duration-150 flex-shrink-0 max-w-xs
                        border-border bg-background hover:bg-muted/50"
                      title={tool.config?.displayName || tool.name}
                    >
                      <span className="truncate font-medium">
                        {tool.config?.displayName || tool.name}
                      </span>
                    </div>

                    {/* Remove button (hide when read-only) */}
                    {!isReadOnly && (
                      <button
                        onClick={() => {
                          handleChange({ tools: value.tools.filter((_, i) => i !== index) });
                        }}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove tool"
                      >
                        <X className="w-2 h-2" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <InstructionsInput
              value={value.instructions}
              onChange={(text) => handleChange({ instructions: text })}
              onToolsChange={(tools) => handleChange({ tools })}
              tools={value.tools}
              stepIndex={0}
              pendingAttachments={value.pendingAttachments}
              onAttachmentAdd={handleAttachmentAdd}
              onAttachmentRemove={handleAttachmentRemove}
              existingAttachments={existingAttachments}
              onExistingAttachmentRemove={handleExistingAttachmentRemove}
              isReadOnly={isReadOnly}
            />

            <p className="text-xs text-muted-foreground">
              Type @ to reference tools, documents, or other skills. Selected tools will appear above.
            </p>
          </div>

          {/* Outputs Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Outputs</Label>
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

          {/* Output Mapping Section - for Agent mode */}
          <OutputMappingSection
            outputs={value.outputs}
            onOutputsChange={(outputs) => handleChange({ outputs })}
            executionType="agent"
            skillOutputs={value.outputs}
            skillInputs={value.inputs}
            isReadOnly={isReadOnly}
          />

          {/* Agent Type - Only show if non-default value needed */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Agent Type:</Label>
            <Select
              value={value.agentType || 'tool_calling'}
              onValueChange={(agentType) => handleChange({ agentType: agentType === 'tool_calling' ? null : agentType })}
              disabled={isReadOnly}
            >
              <SelectTrigger className="h-7 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tool_calling">Tool Calling</SelectItem>
                <SelectItem value="code_agent">Code Agent</SelectItem>
              </SelectContent>
            </Select>
            <div className="group relative">
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              <div className="invisible group-hover:visible absolute left-0 top-5 z-50 w-72 rounded-md bg-popover p-3 text-xs text-popover-foreground shadow-md border">
                <p className="font-medium mb-1">Tool Calling (Default)</p>
                <p className="text-muted-foreground mb-2">Calls tools using structured function calls. More reliable and predictable.</p>
                <p className="font-medium mb-1">Code Agent</p>
                <p className="text-muted-foreground">Writes Python code to execute tools. Better for complex multi-step reasoning.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
