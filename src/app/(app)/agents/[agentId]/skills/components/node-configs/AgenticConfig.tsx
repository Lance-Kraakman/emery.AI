'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UnifiedChatInput } from '@/components/shared/UnifiedChatInput';
import type { ConfigWithVariables, AgenticNodeData } from './types';

export function AgenticConfig({
  data,
  onUpdate,
  variables,
  disabled,
}: ConfigWithVariables<AgenticNodeData>) {
  // Convert WorkflowVariable to the format expected by UnifiedChatInput
  const chatVariables = variables.map((v) => ({
    name: v.name,
    description: v.description || v.label || '',
  }));

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label htmlFor="instructions" className="text-xs">
          Instructions
        </Label>
        <UnifiedChatInput
          mode="form"
          minHeight="120px"
          value={data.instructions}
          onChange={(value) => onUpdate({ instructions: value })}
          variables={chatVariables}
          enableSendButton={false}
          disabled={disabled}
          placeholder="Describe what this step should do... (@ for tools, { for variables)"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Agent Type</Label>
        <Select
          value={data.agentType || 'tool_calling'}
          onValueChange={(value) => onUpdate({ agentType: value })}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tool_calling">Tool Calling</SelectItem>
            <SelectItem value="code_agent">Code Agent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data.tools && data.tools.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs">Tools ({data.tools.length})</Label>
          <div className="flex flex-wrap gap-1">
            {data.tools.map((tool, idx) => (
              <span
                key={idx}
                className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300"
              >
                {tool.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
