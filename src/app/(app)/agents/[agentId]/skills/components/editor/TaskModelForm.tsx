'use client';

import React from 'react';
import {
  Image,
  Mic,
  Volume2,
  ScanSearch,
  Tags,
  FileText,
  Binary,
  HelpCircle,
  ListFilter,
  Info
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModelSelector } from '@/components/ai/ModelSelector';
import { getModelsByTaskType, type ModelTaskType } from '@/lib/ai/model-registry';
import type { SkillInput, SkillOutput } from '@/app/mappers/skill-mapper';

// Task type options with icons and detailed descriptions for info tooltips
const TASK_TYPE_OPTIONS = [
  { value: 'text-to-image', label: 'Text to Image', icon: Image, hint: 'Generate images', description: 'Creates images from text descriptions using diffusion models. Input a prompt describing what you want, get an image back.' },
  { value: 'speech-to-text', label: 'Speech to Text', icon: Mic, hint: 'Transcribe audio', description: 'Transcribes spoken audio into text. Supports various audio formats. Output is the transcribed text.' },
  { value: 'text-to-speech', label: 'Text to Speech', icon: Volume2, hint: 'Generate audio', description: 'Converts written text into spoken audio. Output is an audio file that can be played back.' },
  { value: 'object-detection', label: 'Object Detection', icon: ScanSearch, hint: 'Find objects', description: 'Identifies and locates objects in images with bounding boxes. Returns a list of detected objects with coordinates and confidence scores.' },
  { value: 'image-classification', label: 'Image Classification', icon: Tags, hint: 'Classify images', description: 'Categorizes images into predefined labels. Returns top classifications with confidence scores.' },
  { value: 'summarization', label: 'Summarization', icon: FileText, hint: 'Summarize text', description: 'Condenses long text into a shorter summary while preserving key information. Good for articles, documents, or any lengthy content.' },
  { value: 'feature-extraction', label: 'Embeddings', icon: Binary, hint: 'Vector embeddings', description: 'Converts text into numerical vectors (embeddings) for semantic search, clustering, or similarity comparisons.' },
  { value: 'question-answering', label: 'Question Answering', icon: HelpCircle, hint: 'Extract answers', description: 'Extracts answers from a given context. Provide a question and context passage, get the specific answer.' },
  { value: 'zero-shot-classification', label: 'Zero-Shot', icon: ListFilter, hint: 'Classify text', description: 'Classifies text into custom labels without training. Provide text and candidate labels, get classification scores.' },
] as const;

// Auto input/output mapping + default templates per task type
const TASK_CONFIG: Record<string, {
  inputs: SkillInput[],
  outputs: SkillOutput[],
  defaultTemplate?: string  // Default prompt template (Jinja2 syntax)
}> = {
  'text-to-image': {
    inputs: [{ name: 'prompt', type: 'text', required: true }],
    outputs: [{ name: 'image', type: 'image' }],
    defaultTemplate: '{{ prompt }}'
  },
  'speech-to-text': {
    inputs: [{ name: 'audio', type: 'audio', required: true }],
    outputs: [{ name: 'transcript', type: 'text' }]
    // No template - audio input only
  },
  'text-to-speech': {
    inputs: [{ name: 'text', type: 'text', required: true }],
    outputs: [{ name: 'audio', type: 'audio' }],
    defaultTemplate: '{{ text }}'
  },
  'object-detection': {
    inputs: [{ name: 'image', type: 'image', required: true }],
    outputs: [{ name: 'detections', type: 'document' }]
    // No template - image input only
  },
  'image-classification': {
    inputs: [{ name: 'image', type: 'image', required: true }],
    outputs: [{ name: 'classifications', type: 'document' }]
    // No template - image input only
  },
  'summarization': {
    inputs: [{ name: 'text', type: 'text', required: true }],
    outputs: [{ name: 'summary', type: 'text' }],
    defaultTemplate: '{{ text }}'
  },
  'feature-extraction': {
    inputs: [{ name: 'text', type: 'text', required: true }],
    outputs: [{ name: 'embedding', type: 'document' }],
    defaultTemplate: '{{ text }}'
  },
  'question-answering': {
    inputs: [
      { name: 'question', type: 'text', required: true },
      { name: 'context', type: 'text', required: true }
    ],
    outputs: [{ name: 'answer', type: 'text' }],
    defaultTemplate: 'Question: {{ question }}\n\nContext: {{ context }}'
  },
  'zero-shot-classification': {
    inputs: [
      { name: 'text', type: 'text', required: true },
      { name: 'labels', type: 'text', required: true }
    ],
    outputs: [{ name: 'classification', type: 'document' }],
    defaultTemplate: '{{ text }}'
  },
};

interface TaskModelConfig {
  modelId: string;
  taskType: string;
  parameters?: Record<string, any>;
}

interface TaskModelFormProps {
  value: TaskModelConfig | undefined;
  onChange: (config: TaskModelConfig | undefined) => void;
  onInputsChange: (inputs: SkillInput[]) => void;
  onOutputsChange: (outputs: SkillOutput[]) => void;
  onInstructionsChange?: (instructions: string) => void;  // For default template
  organizationTier?: 'free' | 'pro' | 'max' | 'enterprise';
  isReadOnly?: boolean;
}

/**
 * Compact form for configuring task-model skill execution.
 */
export function TaskModelForm({
  value,
  onChange,
  onInputsChange,
  onOutputsChange,
  onInstructionsChange,
  organizationTier = 'free',
  isReadOnly = false
}: TaskModelFormProps) {

  const handleTaskTypeChange = (taskType: string) => {
    // Reset model when task type changes
    onChange({ modelId: '', taskType, parameters: {} });

    // Auto-populate inputs/outputs/template from config
    const config = TASK_CONFIG[taskType];
    if (config) {
      onInputsChange(config.inputs);
      onOutputsChange(config.outputs);
      // Set default template if available
      if (config.defaultTemplate && onInstructionsChange) {
        onInstructionsChange(config.defaultTemplate);
      }
    }
  };

  const handleModelChange = (modelId: string | null) => {
    onChange({
      ...value,
      modelId: modelId || '',
      taskType: value?.taskType || '',
      parameters: value?.parameters || {}
    });
  };

  const handleParametersChange = (parameters: Record<string, any>) => {
    onChange({
      ...value,
      modelId: value?.modelId || '',
      taskType: value?.taskType || '',
      parameters
    });
  };

  // Get models filtered by selected task type
  const availableModels = value?.taskType
    ? getModelsByTaskType(value.taskType as ModelTaskType).map(m => m.id)
    : [];

  const selectedTaskOption = TASK_TYPE_OPTIONS.find(o => o.value === value?.taskType);

  return (
    <div className="space-y-4">
      {/* Operation Selector with info icon */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Operation</Label>
          {selectedTaskOption && (
            <div className="group relative">
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              <div className="invisible group-hover:visible absolute left-0 top-5 z-50 w-64 rounded-md bg-popover p-3 text-xs text-popover-foreground shadow-md border">
                {selectedTaskOption.description}
              </div>
            </div>
          )}
        </div>
        <Select
          value={value?.taskType}
          onValueChange={handleTaskTypeChange}
          disabled={isReadOnly}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an operation..." />
          </SelectTrigger>
          <SelectContent>
            {TASK_TYPE_OPTIONS.map(option => {
              const Icon = option.icon;
              return (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{option.label}</span>
                    <span className="text-muted-foreground text-xs">— {option.hint}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Model Selector (filtered by task type) */}
      {value?.taskType && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Model</Label>
          {availableModels.length > 0 ? (
            <ModelSelector
              value={value.modelId || null}
              onChange={handleModelChange}
              organizationTier={organizationTier}
              availableModels={availableModels}
              disabled={isReadOnly}
            />
          ) : (
            <p className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/30">
              No models available for this task type.
            </p>
          )}
        </div>
      )}

      {/* Task-Specific Parameters - only if the task has params */}
      {value?.taskType && (
        <TaskParameterForm
          taskType={value.taskType}
          parameters={value.parameters || {}}
          onChange={handleParametersChange}
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
}

// Task-specific parameter forms
interface TaskParameterFormProps {
  taskType: string;
  parameters: Record<string, any>;
  onChange: (params: Record<string, any>) => void;
  isReadOnly?: boolean;
}

// Helper component for parameter row with info icon on RHS
function ParamRow({ children, hint }: { children: React.ReactNode; hint: string }) {
  return (
    <div className="flex items-center gap-3">
      {children}
      <div className="group relative ml-auto">
        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
        <div className="invisible group-hover:visible absolute right-0 top-5 z-50 w-48 rounded-md bg-popover p-2 text-xs text-popover-foreground shadow-md border">
          {hint}
        </div>
      </div>
    </div>
  );
}

function TaskParameterForm({ taskType, parameters, onChange, isReadOnly }: TaskParameterFormProps) {
  switch (taskType) {
    case 'text-to-image':
      return (
        <div className="space-y-3">
          <ParamRow hint="Output image dimensions in pixels. Some models only support specific sizes.">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Size</Label>
            <Input
              type="number"
              value={parameters.width || 1024}
              onChange={(e) => onChange({ ...parameters, width: parseInt(e.target.value) || 1024 })}
              disabled={isReadOnly}
              className="w-20 h-8"
            />
            <span className="text-muted-foreground">×</span>
            <Input
              type="number"
              value={parameters.height || 1024}
              onChange={(e) => onChange({ ...parameters, height: parseInt(e.target.value) || 1024 })}
              disabled={isReadOnly}
              className="w-20 h-8"
            />
          </ParamRow>
          <Input
            value={parameters.negative_prompt || ''}
            onChange={(e) => onChange({ ...parameters, negative_prompt: e.target.value })}
            placeholder="Negative prompt (things to avoid)..."
            disabled={isReadOnly}
            className="h-8"
          />
        </div>
      );

    case 'object-detection':
      return (
        <ParamRow hint="Minimum confidence score (0-1) for detected objects. Higher values = fewer but more confident detections.">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Confidence</Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="1"
            value={parameters.threshold ?? 0.5}
            onChange={(e) => onChange({ ...parameters, threshold: parseFloat(e.target.value) || 0.5 })}
            disabled={isReadOnly}
            className="w-20 h-8"
          />
        </ParamRow>
      );

    case 'summarization':
      return (
        <ParamRow hint="Target summary length in tokens. Min sets the minimum, max sets the maximum length.">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Length</Label>
          <Input
            type="number"
            value={parameters.min_length || 30}
            onChange={(e) => onChange({ ...parameters, min_length: parseInt(e.target.value) || 30 })}
            disabled={isReadOnly}
            className="w-20 h-8"
            placeholder="min"
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="number"
            value={parameters.max_length || 150}
            onChange={(e) => onChange({ ...parameters, max_length: parseInt(e.target.value) || 150 })}
            disabled={isReadOnly}
            className="w-20 h-8"
            placeholder="max"
          />
        </ParamRow>
      );

    case 'image-classification':
      return (
        <ParamRow hint="Number of top classification labels to return, ranked by confidence score.">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Top K</Label>
          <Input
            type="number"
            min="1"
            max="20"
            value={parameters.top_k || 5}
            onChange={(e) => onChange({ ...parameters, top_k: parseInt(e.target.value) || 5 })}
            disabled={isReadOnly}
            className="w-20 h-8"
          />
        </ParamRow>
      );

    default:
      return null;
  }
}
