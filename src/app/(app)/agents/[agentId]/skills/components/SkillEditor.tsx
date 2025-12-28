'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Save, Plus, X, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModelSelector } from '@/components/ai/ModelSelector';
import { InstructionsInput } from './editor/InstructionsInput';
import { SkillInputsSection } from './editor/SkillInputsSection';
import { SkillOutputsSection } from './editor/SkillOutputsSection';
import { ExecutionTypeToggle } from './editor/ExecutionTypeToggle';
import { TaskModelForm } from './editor/TaskModelForm';
import { OutputMappingSection } from './editor/OutputMappingSection';
import { ToolExecutionConfigForm } from './editor/ToolExecutionConfigForm';
import { WriteConfigForm } from './editor/WriteConfigForm';
import type { ToolConfigDTO, SkillInput, SkillOutput } from '@/app/mappers/skill-mapper';
import type { MessagePart } from '@/lib/grpc/generated/agent_worker';
import type { SkillExecutionType } from '@/ddd/domain/skills/entities/skill';

export interface SkillFormData {
  name: string;
  description: string;
  inputs: SkillInput[];
  outputs: SkillOutput[];
  instructions: string;
  tools: ToolConfigDTO[];
  model?: string | null; // Optional model override for this skill
  agentType?: string | null; // Optional: "tool_calling" (default) or "code_agent"
  content?: MessagePart[]; // Existing uploaded attachments
  pendingAttachments?: File[]; // New attachments to upload on save
  // Execution type determines how the skill runs:
  // - 'agentic': LLM orchestration with flat instructions (default)
  // - 'agent': Step-based DAG workflow with skill chaining
  // - 'operation': Direct AI model inference (e.g., speech-to-text)
  // - 'tool': Direct Pipedream tool call (no LLM)
  // - 'write': Direct table write (no LLM)
  executionType?: SkillExecutionType;
  // Configuration for operation execution (required when executionType is 'operation')
  taskModelConfig?: {
    modelId: string;
    taskType: string;
    parameters?: Record<string, any>;
  };
  // Configuration for tool execution (required when executionType is 'tool')
  toolExecutionConfig?: {
    toolId: string;
    inputMappings: Array<{ toolParam: string; skillInputName?: string; staticValue?: any }>;
  };
  // Configuration for write execution (required when executionType is 'write')
  writeConfig?: {
    targetTableId: number;
    rowAction: 'create' | 'update';
    fieldMappings: Array<{ skillInputName: string; targetFieldId: number }>;
    updateMatch?: { skillInputName: string; targetFieldId: number };
  };
  // Steps for agent (step-based) execution (required when executionType is 'agent')
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
  agentId?: number | null; // Optional: null for organization skills, number for agent-scoped skills
  skillId?: number;
  onSave?: () => void;
  isSaving?: boolean;
  agentDefaultModel?: string | null; // Agent's default model for inheritance display
  organizationTier?: 'free' | 'pro' | 'max' | 'enterprise'; // For filtering available models
  availableModels?: string[]; // Organization's whitelist of allowed models
  isReadOnly?: boolean; // When true, disables all inputs (for system skills)
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
  isSaving,
  agentDefaultModel,
  organizationTier = 'free',
  availableModels,
  isReadOnly = false,
}: SkillEditorProps) {
  const [localValue, setLocalValue] = useState(value);
  const [showDescription, setShowDescription] = useState(false);

  // Separate state for each execution mode's inputs/outputs
  // This preserves user's work when switching between modes
  const [savedAgenticState, setSavedAgenticState] = useState<{
    inputs: SkillInput[];
    outputs: SkillOutput[];
    instructions: string;
    tools: ToolConfigDTO[];
  }>({ inputs: [], outputs: [], instructions: '', tools: [] });

  const [savedAgentState, setSavedAgentState] = useState<{
    inputs: SkillInput[];
    outputs: SkillOutput[];
    steps: SkillFormData['steps'];
  }>({ inputs: [], outputs: [], steps: [] });

  const [savedDirectState, setSavedDirectState] = useState<{
    inputs: SkillInput[];
    outputs: SkillOutput[];
    instructions: string;
    taskModelConfig?: { modelId: string; taskType: string; parameters?: Record<string, any> };
  }>({ inputs: [], outputs: [], instructions: '' });

  const [savedToolState, setSavedToolState] = useState<{
    inputs: SkillInput[];
    toolExecutionConfig?: SkillFormData['toolExecutionConfig'];
  }>({ inputs: [] });

  const [savedWriteState, setSavedWriteState] = useState<{
    inputs: SkillInput[];
    writeConfig?: SkillFormData['writeConfig'];
  }>({ inputs: [] });

  // Sync with external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (updates: Partial<SkillFormData>) => {
    // Use functional update to avoid stale closure issues when multiple
    // updates are called in sequence (e.g., TaskModelForm updating taskModelConfig,
    // inputs, and outputs separately)
    setLocalValue(prev => {
      const newValue = { ...prev, ...updates };
      onChange(newValue);
      return newValue;
    });
  };

  // Attachment handlers
  const handleAttachmentAdd = (file: File) => {
    const newAttachments = [...(localValue.pendingAttachments || []), file];
    handleChange({ pendingAttachments: newAttachments });
  };

  const handleAttachmentRemove = (index: number) => {
    const newAttachments = (localValue.pendingAttachments || []).filter((_, i) => i !== index);
    handleChange({ pendingAttachments: newAttachments });
  };

  const handleExistingAttachmentRemove = (index: number) => {
    const newContent = (localValue.content || []).filter((_, i) => i !== index);
    handleChange({ content: newContent });
  };

  // Convert MessageParts to existingAttachments format for UnifiedChatInput
  const existingAttachments = (localValue.content || [])
    .filter(part => part.imageUrl || part.file)
    .map(part => ({
      url: part.imageUrl?.url || part.file?.url || '',
      filename: part.file?.filename || 'Image',
      type: (part.imageUrl ? 'image' : 'file') as 'image' | 'file',
      size: part.file?.size
    }));

  return (
    <div className="space-y-4">
      {/* Compact Header: Name + Model + Create */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              id="name"
              value={localValue.name}
              onChange={(e) => handleChange({ name: e.target.value })}
              placeholder="Skill name..."
              className="h-9"
              disabled={isReadOnly}
            />
          </div>
          {/* Model selector moved to header (Agent mode only) */}
          {localValue.executionType !== 'operation' && (
            <ModelSelector
              value={localValue.model}
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
            value={localValue.executionType || 'agentic'}
            onChange={(newMode) => {
              const currentMode = localValue.executionType || 'agentic';
              if (currentMode === newMode) return;

              // Save current state based on current mode
              if (currentMode === 'agentic') {
                setSavedAgenticState({ inputs: localValue.inputs, outputs: localValue.outputs, instructions: localValue.instructions, tools: localValue.tools });
              } else if (currentMode === 'agent') {
                setSavedAgentState({ inputs: localValue.inputs, outputs: localValue.outputs, steps: localValue.steps });
              } else if (currentMode === 'operation') {
                setSavedDirectState({ inputs: localValue.inputs, outputs: localValue.outputs, instructions: localValue.instructions, taskModelConfig: localValue.taskModelConfig });
              } else if (currentMode === 'tool') {
                setSavedToolState({ inputs: localValue.inputs, toolExecutionConfig: localValue.toolExecutionConfig });
              } else if (currentMode === 'write') {
                setSavedWriteState({ inputs: localValue.inputs, writeConfig: localValue.writeConfig });
              }

              // Restore target mode's saved state
              if (newMode === 'agentic') {
                handleChange({ executionType: newMode, ...savedAgenticState, taskModelConfig: undefined, toolExecutionConfig: undefined, writeConfig: undefined, steps: undefined });
              } else if (newMode === 'agent') {
                handleChange({ executionType: newMode, inputs: savedAgentState.inputs, outputs: savedAgentState.outputs, steps: savedAgentState.steps, instructions: '', tools: [], taskModelConfig: undefined, toolExecutionConfig: undefined, writeConfig: undefined });
              } else if (newMode === 'operation') {
                handleChange({ executionType: newMode, ...savedDirectState, tools: [], toolExecutionConfig: undefined, writeConfig: undefined, steps: undefined });
              } else if (newMode === 'tool') {
                handleChange({ executionType: newMode, inputs: savedToolState.inputs, outputs: [], instructions: '', tools: [], toolExecutionConfig: savedToolState.toolExecutionConfig, taskModelConfig: undefined, writeConfig: undefined, steps: undefined });
              } else if (newMode === 'write') {
                handleChange({ executionType: newMode, inputs: savedWriteState.inputs, outputs: [], instructions: '', tools: [], writeConfig: savedWriteState.writeConfig, taskModelConfig: undefined, toolExecutionConfig: undefined, steps: undefined });
              }
            }}
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
        {(showDescription || (isReadOnly && localValue.description)) && (
          <Textarea
            id="description"
            value={localValue.description}
            onChange={(e) => handleChange({ description: e.target.value })}
            placeholder="Briefly describe what this skill does..."
            rows={2}
            className="text-sm"
            disabled={isReadOnly}
          />
        )}
      </div>

      {/* Conditional Form Based on Execution Type */}
      {localValue.executionType === 'operation' ? (
        /* Direct Mode Form - Compact, auto-configures inputs/outputs */
        <>
          <TaskModelForm
            value={localValue.taskModelConfig}
            onChange={(taskModelConfig) => handleChange({ taskModelConfig })}
            onInputsChange={(inputs) => handleChange({ inputs })}
            onOutputsChange={(outputs) => handleChange({ outputs })}
            onInstructionsChange={(instructions) => handleChange({ instructions })}
            organizationTier={organizationTier}
            isReadOnly={isReadOnly}
          />

          {/* Prompt Template - Only for operations with text inputs */}
          {localValue.taskModelConfig?.taskType && localValue.inputs.some(input => input.type === 'text') && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Prompt Template</Label>
              <InstructionsInput
                value={localValue.instructions}
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
          {localValue.taskModelConfig?.taskType && localValue.outputs.length > 0 && (
            <OutputMappingSection
              outputs={localValue.outputs}
              onOutputsChange={(outputs) => handleChange({ outputs })}
              executionType="operation"
              taskType={localValue.taskModelConfig?.taskType}
              skillInputs={localValue.inputs}
              isReadOnly={isReadOnly}
            />
          )}
        </>
      ) : localValue.executionType === 'tool' ? (
        /* Tool Mode Form - Pipedream tool selector + input mappings */
        <>
          <ToolExecutionConfigForm
            value={localValue.toolExecutionConfig}
            onChange={(config) => handleChange({ toolExecutionConfig: config })}
            skillInputs={localValue.inputs}
            onSkillInputsChange={(inputs) => handleChange({ inputs })}
            disabled={isReadOnly}
          />

          {/* Show skill inputs for reference/editing */}
          {localValue.inputs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">Skill Inputs</Label>
                <span className="text-xs text-muted-foreground">
                  {localValue.inputs.length} input{localValue.inputs.length !== 1 ? 's' : ''}
                </span>
              </div>
              <SkillInputsSection
                inputs={localValue.inputs}
                onInputsChange={(inputs) => handleChange({ inputs })}
                isReadOnly={isReadOnly}
              />
              <p className="text-xs text-muted-foreground">
                These inputs were auto-generated from the tool&apos;s parameters.
              </p>
            </div>
          )}
        </>
      ) : localValue.executionType === 'write' ? (
        /* Write Mode Form - Inputs first, then table selector + field mappings */
        <>
          {/* Skill Inputs Section - FIRST */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Skill Inputs</Label>
              <span className="text-xs text-muted-foreground">
                {localValue.inputs.length} input{localValue.inputs.length !== 1 ? 's' : ''}
              </span>
            </div>
            <SkillInputsSection
              inputs={localValue.inputs}
              onInputsChange={(inputs) => handleChange({ inputs })}
              isReadOnly={isReadOnly}
            />
            <p className="text-xs text-muted-foreground">
              Define inputs that will be mapped to table fields.
            </p>
          </div>

          {/* Table Write Configuration - AFTER inputs */}
          <WriteConfigForm
            value={localValue.writeConfig}
            onChange={(config) => handleChange({ writeConfig: config })}
            skillInputs={localValue.inputs}
            onSkillInputsChange={(inputs) => handleChange({ inputs })}
            disabled={isReadOnly}
          />
        </>
      ) : localValue.executionType === 'agent' ? (
        /* Agent Form - Step-based DAG workflow */
        <>
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
              isReadOnly={isReadOnly}
            />
          </div>

          {/* Steps Section - Placeholder for now */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Steps</Label>
            <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Step-based workflow configuration coming soon.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Define steps with inline instructions or skill references.
                Each step can have its own tools and passes data to the next.
              </p>
            </div>
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
              isReadOnly={isReadOnly}
            />
          </div>
        </>
      ) : (
        /* Agentic Form (default) - Flat instructions with LLM orchestration */
        <>
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
              isReadOnly={isReadOnly}
            />
            <p className="text-xs text-muted-foreground">
              Reference inputs in instructions using {'{input_name}'} syntax
            </p>
          </div>

          {/* Instructions Section */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Instructions</Label>

            {/* Selected Tools Display - ABOVE instructions (like chat UI) */}
            {localValue.tools.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {localValue.tools.map((tool, index) => (
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
                          const newTools = localValue.tools.filter((_, i) => i !== index);
                          handleChange({ tools: newTools });
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
              value={localValue.instructions}
              onChange={(text) => handleChange({ instructions: text })}
              onToolsChange={(tools) => handleChange({ tools })}
              tools={localValue.tools}
              stepIndex={0}
              pendingAttachments={localValue.pendingAttachments}
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
                {localValue.outputs.length} output{localValue.outputs.length !== 1 ? 's' : ''}
              </span>
            </div>
            <SkillOutputsSection
              outputs={localValue.outputs}
              onOutputsChange={(outputs) => handleChange({ outputs })}
              isReadOnly={isReadOnly}
            />
            <p className="text-xs text-muted-foreground">
              Define what data this skill returns
            </p>
          </div>

          {/* Output Mapping Section - for Agent mode */}
          <OutputMappingSection
            outputs={localValue.outputs}
            onOutputsChange={(outputs) => handleChange({ outputs })}
            executionType="agent"
            skillOutputs={localValue.outputs}
            skillInputs={localValue.inputs}
            isReadOnly={isReadOnly}
          />

          {/* Agent Type - Only show if non-default value needed */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Agent Type:</Label>
            <Select
              value={localValue.agentType || 'tool_calling'}
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
