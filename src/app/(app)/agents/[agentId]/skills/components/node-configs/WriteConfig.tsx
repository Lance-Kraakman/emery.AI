'use client';

import { WriteConfigForm } from '../editor/WriteConfigForm';
import type { ConfigWithSkillInputs, WriteNodeData } from './types';

/**
 * Write node config - uses the full WriteConfigForm
 */
export function WriteConfig({
  data,
  onUpdate,
  skillInputs,
  disabled,
}: ConfigWithSkillInputs<WriteNodeData>) {
  return (
    <WriteConfigForm
      value={data.writeConfig}
      onChange={(writeConfig) => onUpdate({ writeConfig })}
      skillInputs={skillInputs}
      onInputDefinitionsChange={(inputs) => onUpdate({ inputDefs: inputs })}
      disabled={disabled}
    />
  );
}
