'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TaskModelForm } from '../editor/TaskModelForm';
import type { BaseConfigProps, OperationNodeData } from './types';

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
