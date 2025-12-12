'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Save, Plus, X, Settings, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModelSelector } from '@/components/ai/ModelSelector';
import { InstructionsInput } from './editor/InstructionsInput';
import { SkillInputsSection } from './editor/SkillInputsSection';
import { SkillOutputsSection } from './editor/SkillOutputsSection';
import type { ToolConfigDTO, SkillInput, SkillOutput } from '@/app/mappers/skill-mapper';
import type { MessagePart } from '@/lib/grpc/generated/agent_worker';

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
}

interface SkillEditorProps {
  value: SkillFormData;
  onChange: (value: SkillFormData) => void;
  agentId?: number | null; // Optional: null for organization skills, number for agent-scoped skills
  skillId?: number;
  onSave?: () => void;
  isSaving?: boolean;
  agentDefaultModel?: string | null; // Agent's default model for inheritance display
  organizationTier?: 'free' | 'pro' | 'enterprise'; // For filtering available models
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
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sync with external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (updates: Partial<SkillFormData>) => {
    const newValue = { ...localValue, ...updates };
    setLocalValue(newValue);
    onChange(newValue);
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
              disabled={isReadOnly}
            />
          </div>
          {onSave && (
            <Button onClick={onSave} disabled={isSaving} className="h-10">
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Creating...' : 'Create Skill'}
            </Button>
          )}
        </div>

        {/* Add Description Link (hide when read-only unless there's a description) */}
        {!isReadOnly && (
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
        )}

        {/* Collapsible Description */}
        {(showDescription || (isReadOnly && localValue.description)) && (
          <Textarea
            id="description"
            value={localValue.description}
            onChange={(e) => handleChange({ description: e.target.value })}
            placeholder="Briefly describe what this skill does..."
            rows={2}
            className="text-base"
            disabled={isReadOnly}
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

      {/* Advanced Settings Section (hide toggle when read-only, show if values are set) */}
      <div className="space-y-3 border-t pt-6">
        {!isReadOnly && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Hide advanced settings
              </>
            ) : (
              <>
                <Settings className="h-3 w-3 mr-1" />
                Advanced settings
              </>
            )}
          </Button>
        )}

        {(showAdvanced || (isReadOnly && (localValue.model || localValue.agentType))) && (
          <div className="space-y-4">
            {isReadOnly && <Label className="text-xs text-muted-foreground">Advanced Settings</Label>}
            {/* Model Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">AI Model</Label>
              <ModelSelector
                value={localValue.model}
                onChange={(model) => handleChange({ model })}
                organizationTier={organizationTier}
                availableModels={availableModels}
                showInherit={true}
                inheritLabel="Inherit from agent"
                inheritFromModel={agentDefaultModel || 'IBM Granite 3.3 8B'}
                requiredCapabilities={['toolCalling']}
                disabled={isReadOnly}
              />
              <p className="text-xs text-muted-foreground">
                Override the AI model used for this skill. Different models have different costs and capabilities.
              </p>
            </div>

            {/* Agent Type Selection */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Agent Type</Label>
                <div className="group relative">
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  <div className="invisible group-hover:visible absolute left-0 top-5 z-50 w-72 rounded-md bg-popover p-3 text-xs text-popover-foreground shadow-md border">
                    <p className="font-medium mb-1">Tool Calling (Default)</p>
                    <p className="text-muted-foreground mb-2">Calls tools using structured function calls. More reliable and predictable. Best for simple tasks and smaller models.</p>
                    <p className="font-medium mb-1">Code Agent</p>
                    <p className="text-muted-foreground">Writes Python code to execute tools. Better for complex multi-step reasoning with conditionals and loops. Works best with larger models.</p>
                  </div>
                </div>
              </div>
              <Select
                value={localValue.agentType || 'tool_calling'}
                onValueChange={(agentType) => handleChange({ agentType: agentType === 'tool_calling' ? null : agentType })}
                disabled={isReadOnly}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select agent type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tool_calling">Tool Calling (Default)</SelectItem>
                  <SelectItem value="code_agent">Code Agent</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How the AI executes tools. Tool Calling is recommended for most use cases.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
