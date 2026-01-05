'use client';

import { ToolExecutionConfigForm } from '../editor/ToolExecutionConfigForm';
import type { ConfigWithSkillInputs, ToolNodeData } from './types';

/**
 * Tool node config - uses the full ToolExecutionConfigForm
 */
export function ToolConfig({
  data,
  onUpdate,
  skillInputs,
  disabled,
}: ConfigWithSkillInputs<ToolNodeData>) {
  return (
    <ToolExecutionConfigForm
      value={data.toolExecutionConfig}
      onChange={(toolExecutionConfig) => onUpdate({ toolExecutionConfig })}
      skillInputs={skillInputs}
      onInputDefinitionsChange={(inputs) => onUpdate({ inputDefs: inputs })}
      disabled={disabled}
    />
  );
}
