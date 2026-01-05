'use client';

import { Label } from '@/components/ui/label';
import { WorkflowVariableInput } from '@/components/workflow-canvas/WorkflowVariableInput';
import type { ConfigWithVariables, ConditionNodeData } from './types';

export function ConditionConfig({
  data,
  onUpdate,
  variables,
  disabled,
}: ConfigWithVariables<ConditionNodeData>) {
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
