'use client';

import { ChevronDown, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { UnifiedChatInput } from '@/components/shared/UnifiedChatInput';
import { OutputDefinitionsSection } from '../editor/OutputDefinitionsSection';
import { useSkillAttachments, workflowVariablesToChatVariables } from '../hooks';
import type { ConfigWithVariables, AgenticNodeData } from './types';

interface AgenticConfigProps extends ConfigWithVariables<AgenticNodeData> {
  skillId?: number;
}

export function AgenticConfig({
  data,
  onUpdate,
  variables,
  skillId,
  disabled,
}: AgenticConfigProps) {
  // Use shared attachment hook
  const {
    pendingAttachments,
    handleAttachmentAdd,
    handleAttachmentRemove,
    handleExistingAttachmentRemove,
  } = useSkillAttachments({
    skillId,
    existingAttachments: data.attachments,
    onAttachmentsChange: (attachments) => onUpdate({ attachments }),
  });

  // Convert workflow variables to chat format using shared utility
  const chatVariables = workflowVariablesToChatVariables(variables);

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
          enableAttachments={true}
          pendingAttachments={pendingAttachments}
          onAttachmentAdd={handleAttachmentAdd}
          onAttachmentRemove={handleAttachmentRemove}
          existingAttachments={data.attachments}
          onExistingAttachmentRemove={handleExistingAttachmentRemove}
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

      {/* Outputs - available downstream as variables */}
      <div className="space-y-1 pt-2 border-t">
        <Label className="text-xs">Outputs</Label>
        <p className="text-[10px] text-muted-foreground">
          Define values to extract. Available downstream as variables.
        </p>
        <OutputDefinitionsSection
          outputs={data.outputDefs || []}
          onOutputsChange={(outputs) => onUpdate({ outputDefs: outputs })}
          isReadOnly={disabled}
        />
      </div>

      {/* Stored Plan - for autonomous execution */}
      {data.plan && (
        <div className="space-y-1 pt-2 border-t">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Stored Plan</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onUpdate({ plan: undefined })}
              disabled={disabled}
              title="Remove stored plan"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="text-[10px] text-muted-foreground space-y-1 p-2 bg-muted rounded">
            <div>
              <strong>Goal:</strong> {data.plan.goal}
            </div>
            <div>
              <strong>Steps:</strong> {data.plan.steps?.length || 0}
            </div>
            {data.plan.approvedAt && (
              <div>
                <strong>Approved:</strong>{' '}
                {new Date(data.plan.approvedAt).toLocaleDateString()}
              </div>
            )}
          </div>
          <Collapsible>
            <CollapsibleTrigger className="flex items-center text-[10px] text-blue-600 hover:text-blue-800">
              View steps <ChevronDown className="h-3 w-3 ml-1" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="text-[10px] space-y-1 mt-1">
                {data.plan.steps?.map((step, i) => (
                  <li key={step.stepId} className="pl-2 border-l border-muted-foreground/30">
                    {i + 1}. {step.description}
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
}
