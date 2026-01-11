'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TaskModelForm } from '../editor/TaskModelForm';
import type { BaseConfigProps, OperationNodeData } from './types';

// Operations that support prompt templates
const OPERATIONS_WITH_TEMPLATES = [
  'text-to-image',
  'image-to-image',
  'text-to-video',
  'speech-to-text',
  'text-to-speech',
  'summarization',
  'translation',
  'question-answering',
  'zero-shot-classification',
  'feature-extraction',
];

interface OperationConfigProps extends BaseConfigProps<OperationNodeData> {
  organizationTier?: 'free' | 'pro' | 'max' | 'enterprise';
}

/**
 * Operation node config - uses the full TaskModelForm
 */
export function OperationConfig({
  data,
  onUpdate,
  organizationTier,
  disabled,
}: OperationConfigProps) {
  // Only show prompt template for operations that support it
  const taskType = data.taskModelConfig?.taskType || '';
  const shouldShowTemplate = OPERATIONS_WITH_TEMPLATES.includes(taskType);

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

      {shouldShowTemplate && (
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
