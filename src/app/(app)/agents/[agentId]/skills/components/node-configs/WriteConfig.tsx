'use client';

import { WriteConfigForm } from '../editor/WriteConfigForm';
import type { ConfigWithWorkflowVariables, WriteNodeData } from './types';

/**
 * Write node config - uses the full WriteConfigForm with workflow variables
 */
export function WriteConfig({
  data,
  onUpdate,
  workflowVariables = [],
  disabled,
}: ConfigWithWorkflowVariables<WriteNodeData>) {
  return (
    <WriteConfigForm
      value={data.writeConfig}
      onChange={(writeConfig) => onUpdate({ writeConfig })}
      workflowVariables={workflowVariables}
      onInputDefinitionsChange={(inputs) => onUpdate({ inputDefs: inputs })}
      disabled={disabled}
    />
  );
}
