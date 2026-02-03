'use client';

import { useState } from 'react';
import { ChevronDown, X, Loader2, Sparkles, Wand2, Info, MessageSquare, RefreshCw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { UnifiedChatInput } from '@/components/shared/UnifiedChatInput';
import { OutputDefinitionsSection } from '../editor/OutputDefinitionsSection';
import { useSkillAttachments, workflowVariablesToChatVariables } from '../hooks';
import type { ConfigWithVariables, AgenticNodeData } from './types';

interface AgenticConfigProps extends ConfigWithVariables<AgenticNodeData> {
  skillId?: number;
  isGeneratingPlan?: boolean;
  /** Handler for generating a plan. Pass feedback string for regeneration with feedback. */
  onGeneratePlan?: (feedback?: string) => void;
}

export function AgenticConfig({
  data,
  onUpdate,
  variables,
  skillId,
  disabled,
  isGeneratingPlan = false,
  onGeneratePlan,
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

  // Feedback state for plan regeneration
  const [planFeedback, setPlanFeedback] = useState('');

  // Handle successful plan generation - clear feedback
  const handleGeneratePlanClick = (withFeedback = false) => {
    if (onGeneratePlan) {
      onGeneratePlan(withFeedback ? planFeedback.trim() : undefined);
      if (withFeedback) {
        setPlanFeedback('');
      }
    }
  };

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

      {/* Plan Section */}
      <div className="space-y-1.5 pt-2 border-t">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs">Plan</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[240px]">
                <p className="text-xs">
                  Plans define how this step executes autonomously.
                  Without a plan, approval is requested at runtime.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {isGeneratingPlan ? (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground p-2 bg-amber-50 dark:bg-amber-900/20 rounded">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating...
          </div>
        ) : data.plan ? (
          <>
            <div className="text-[10px] text-muted-foreground space-y-1 p-2 bg-emerald-50/50 dark:bg-emerald-900/20 rounded border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center justify-between">
                <strong>Goal:</strong>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => onUpdate({ plan: undefined })}
                  disabled={disabled}
                  title="Remove plan"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="text-[10px]">{data.plan.goal}</div>
              <div>
                <strong>Steps:</strong> {data.plan.steps?.length || 0}
              </div>
            </div>
            <Collapsible>
              <CollapsibleTrigger className="flex items-center text-[10px] text-primary hover:text-primary/80">
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

            {/* Feedback for regeneration */}
            {onGeneratePlan && (
              <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-1 mb-1">
                  <MessageSquare className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] font-medium">Improve Plan</span>
                </div>
                <Textarea
                  value={planFeedback}
                  onChange={(e) => setPlanFeedback(e.target.value)}
                  placeholder="Describe changes (e.g., 'add error handling')..."
                  rows={2}
                  className="text-[10px] resize-none mb-1.5"
                  disabled={disabled || isGeneratingPlan}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGeneratePlanClick(true)}
                  disabled={!planFeedback.trim() || !data.instructions?.trim() || disabled || isGeneratingPlan}
                  className="w-full h-6 text-[10px]"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Regenerate with Feedback
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-[10px] text-muted-foreground p-2 bg-muted rounded">
            <div className="flex items-center gap-1 mb-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Autonomous Execution
            </div>
            Generate a plan for this step to run without approval.
          </div>
        )}

        {onGeneratePlan && !data.plan && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleGeneratePlanClick(false)}
            disabled={isGeneratingPlan || !data.instructions?.trim() || disabled}
            className="w-full h-7 text-xs"
          >
            {isGeneratingPlan ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="h-3 w-3 mr-1" />
                Generate Plan
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
