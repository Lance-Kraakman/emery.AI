'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WorkflowVariableInput } from '@/components/workflow-canvas/WorkflowVariableInput';
import type { ConfigWithVariables, LoopNodeData } from './types';

export function LoopConfig({
  data,
  onUpdate,
  variables,
  disabled,
}: ConfigWithVariables<LoopNodeData>) {
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
    <div className="space-y-2">
      <div className="space-y-1">
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
          <div className="space-y-1">
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
          <div className="space-y-1">
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
        <div className="space-y-1">
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

      <div className="space-y-1">
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
