'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Save, Plus, X, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModelSelector } from '@/components/ai/ModelSelector';
import { InstructionsInput } from './editor/InstructionsInput';
import { ToolsSection } from './editor/ToolsSection';
import { SkillInputsSection } from './editor/SkillInputsSection';
import { SkillOutputsSection } from './editor/SkillOutputsSection';
import { AttachmentInput, AttachmentList } from '@/components/shared/attachments';
import { useAttachments } from '@/hooks/useAttachments';
import { uploadSkillAttachment, deleteSkillAttachment } from '@/app/actions/skills';
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
  content?: MessagePart[]; // Skill-level attachments
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
        <InstructionsInput
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
          <ToolsSection
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

      {/* Attachments Section (only for existing skills) */}
      {skillId && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground">Attachments</Label>
            <span className="text-xs text-muted-foreground">
              {(localValue.content?.filter(p => p.imageUrl || p.file)?.length || 0)} file{((localValue.content?.filter(p => p.imageUrl || p.file)?.length || 0) !== 1) ? 's' : ''}
            </span>
          </div>
          <div className="border rounded-md p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AttachmentInput
                onFileSelect={async (file) => {
                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('type', file.type.startsWith('image/') ? 'image' : 'file');

                  const result = await uploadSkillAttachment(skillId, formData);
                  if (result.success && result.data) {
                    // Convert attachment metadata to MessagePart
                    const newPart: MessagePart = file.type.startsWith('image/')
                      ? { imageUrl: { url: result.data.url } }
                      : { file: {
                          url: result.data.url,
                          mimeType: result.data.mimeType,
                          filename: result.data.filename,
                          size: result.data.sizeBytes
                        }};

                    const newContent = [...(localValue.content || []), newPart];
                    handleChange({ content: newContent });
                  } else {
                    alert('Failed to upload attachment: ' + (result.error || 'Unknown error'));
                  }
                }}
                buttonTitle="Upload reference files (images, documents)"
              />
              <span className="text-xs text-muted-foreground">
                Upload images or files to include as reference material for this skill
              </span>
            </div>

            {localValue.content && localValue.content.length > 0 && (
              <div className="space-y-2">
                {localValue.content.map((part, index) => {
                  const isImage = part.imageUrl;
                  const isFile = part.file;
                  if (!isImage && !isFile) return null;

                  const filename = isFile ? part.file!.filename : 'Image';
                  const size = isFile ? part.file!.size : 0;

                  return (
                    <div key={index} className="flex items-center justify-between bg-muted/30 rounded px-3 py-2">
                      <div className="flex items-center gap-2">
                        {isImage && <span className="text-xs">🖼️</span>}
                        {isFile && <span className="text-xs">📄</span>}
                        <span className="text-xs truncate max-w-[200px]">{filename}</span>
                        {size > 0 && <span className="text-xs text-muted-foreground">({(size / 1024).toFixed(1)} KB)</span>}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          const s3Key = isImage ? part.imageUrl?.url.split('/').pop() : part.file?.url.split('/').pop();
                          if (s3Key) {
                            await deleteSkillAttachment(skillId, s3Key);
                          }
                          const newContent = localValue.content?.filter((_, i) => i !== index) || [];
                          handleChange({ content: newContent });
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Reference files are available to the AI when executing this skill
          </p>
        </div>
      )}

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

      {/* Advanced Settings Section */}
      <div className="space-y-3 border-t pt-6">
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

        {showAdvanced && (
          <div className="space-y-4">
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
              />
              <p className="text-xs text-muted-foreground">
                Override the AI model used for this skill. Different models have different costs and capabilities.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
