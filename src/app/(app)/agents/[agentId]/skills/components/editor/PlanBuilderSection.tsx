'use client';

import React, { useState, useCallback } from 'react';
import {
  Loader2,
  Sparkles,
  Wand2,
  CheckCircle2,
  RefreshCw,
  X,
  ChevronDown,
  FileText,
  Pencil,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { UnifiedChatInput } from '@/components/shared/UnifiedChatInput';
import { generateSkillPlan } from '@/app/actions/skills';
import type { StoredPlan, StoredPlanStep } from '@/ddd/domain/skills/entities/skill';
import type { ChatVariable } from '../hooks/useChatVariables';

type PlanState = 'idle' | 'generating' | 'ready' | 'saved';

interface PlanBuilderSectionProps {
  instructions: string;
  onInstructionsChange: (instructions: string) => void;
  plan: StoredPlan | null | undefined;
  onPlanChange: (plan: StoredPlan | null) => void;
  skillId?: number;
  chatVariables?: ChatVariable[];
  isReadOnly?: boolean;
  pendingAttachments?: File[];
  onAttachmentAdd?: (file: File) => void;
  onAttachmentRemove?: (index: number) => void;
}

/**
 * Combined Instructions + Plan generation section.
 *
 * States:
 * - idle: Show instructions + "Generate Plan" button
 * - generating: Show spinner while generating
 * - ready: Show plan preview + "Approve" / "Regenerate" (plan not yet saved)
 * - saved: Show saved plan + "Edit" / "Remove" buttons
 */
export function PlanBuilderSection({
  instructions,
  onInstructionsChange,
  plan,
  onPlanChange,
  skillId,
  chatVariables = [],
  isReadOnly = false,
  pendingAttachments = [],
  onAttachmentAdd,
  onAttachmentRemove,
}: PlanBuilderSectionProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<StoredPlan | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Determine current state
  const getState = (): PlanState => {
    if (isGenerating) return 'generating';
    if (pendingPlan) return 'ready';
    if (plan && !isEditing) return 'saved';
    return 'idle';
  };

  const state = getState();

  // Handle generating a plan
  const handleGeneratePlan = useCallback(async () => {
    if (!skillId || !instructions?.trim()) {
      toast.error('Save the skill and add instructions first');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateSkillPlan(skillId, instructions);
      if (result.success && result.data) {
        setPendingPlan(result.data);
        toast.success(`Plan generated with ${result.data.steps?.length || 0} steps`);
      } else {
        toast.error(result.error || 'Failed to generate plan');
      }
    } catch (error) {
      console.error('Plan generation failed:', error);
      toast.error('Failed to generate plan');
    } finally {
      setIsGenerating(false);
    }
  }, [skillId, instructions]);

  // Handle approving the pending plan (saves it)
  const handleApprovePlan = useCallback(() => {
    if (pendingPlan) {
      onPlanChange(pendingPlan);
      setPendingPlan(null);
      setIsEditing(false);
      toast.success('Plan saved');
    }
  }, [pendingPlan, onPlanChange]);

  // Handle regenerating (discard pending and regenerate)
  const handleRegenerate = useCallback(async () => {
    setPendingPlan(null);
    await handleGeneratePlan();
  }, [handleGeneratePlan]);

  // Handle editing saved plan (go back to instructions)
  const handleEditPlan = useCallback(() => {
    setIsEditing(true);
    setPendingPlan(null);
  }, []);

  // Handle removing plan
  const handleRemovePlan = useCallback(() => {
    onPlanChange(null);
    setPendingPlan(null);
    setIsEditing(false);
  }, [onPlanChange]);

  // Cancel editing and go back to saved state
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setPendingPlan(null);
  }, []);

  // Render plan display (shared between ready and saved states)
  const renderPlanDisplay = (displayPlan: StoredPlan, isSaved: boolean) => (
    <div
      className={cn(
        'border rounded-lg p-4 mt-3',
        isSaved
          ? 'bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
          : 'bg-blue-50/30 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isSaved ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <FileText className="h-4 w-4 text-blue-500" />
          )}
          <span className="text-sm font-medium">
            {isSaved ? 'Saved Plan' : 'Plan Ready'}
          </span>
          <Badge variant="outline" className="text-[10px]">
            {displayPlan.steps?.length || 0} steps
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {isSaved ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={handleEditPlan}
                disabled={isReadOnly}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={handleRemovePlan}
                disabled={isReadOnly}
                title="Remove plan"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="default"
                size="sm"
                className="h-7"
                onClick={handleApprovePlan}
                disabled={isReadOnly}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Approve Plan
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={handleRegenerate}
                disabled={isReadOnly}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Regenerate
              </Button>
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-2">{displayPlan.goal}</p>

      {displayPlan.steps && displayPlan.steps.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="text-xs text-blue-600 hover:text-blue-800 flex items-center">
            View steps <ChevronDown className="h-3 w-3 ml-1" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ol className="text-xs space-y-1 mt-2 pl-4 list-decimal text-muted-foreground">
              {displayPlan.steps.map((step: StoredPlanStep) => (
                <li key={step.stepId}>{step.description}</li>
              ))}
            </ol>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );

  return (
    <div className="border rounded-lg bg-muted/10">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-medium">Plan</span>
      </div>

      <div className="p-4">
        {/* Instructions - always show in idle, generating, ready states, or when editing */}
        {(state === 'idle' || state === 'generating' || state === 'ready' || isEditing) && (
          <div className="flex flex-col">
            <Label className="text-xs font-medium mb-2 text-muted-foreground">
              Instructions
            </Label>
            <div className="min-h-[150px] h-[200px]">
              <UnifiedChatInput
                mode="form"
                minHeight="100%"
                value={instructions}
                onChange={onInstructionsChange}
                variables={chatVariables}
                enableSendButton={false}
                enableAttachments={true}
                pendingAttachments={pendingAttachments}
                onAttachmentAdd={onAttachmentAdd}
                onAttachmentRemove={onAttachmentRemove}
                disabled={isReadOnly || isGenerating}
                placeholder="Describe what this skill should do... (@ for tools, { for variables)"
              />
            </div>

            {/* Generate button or status */}
            <div className="mt-3">
              {state === 'generating' ? (
                <div className="flex items-center gap-2 text-amber-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Generating plan...</span>
                </div>
              ) : state === 'idle' || isEditing ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGeneratePlan}
                    disabled={!instructions?.trim() || !skillId || isReadOnly}
                  >
                    <Wand2 className="h-3 w-3 mr-1.5" />
                    Generate Plan
                  </Button>
                  {isEditing && plan && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Saved plan display (when not editing) */}
        {state === 'saved' && plan && renderPlanDisplay(plan, true)}

        {/* Pending plan display (ready state) */}
        {state === 'ready' && pendingPlan && renderPlanDisplay(pendingPlan, false)}
      </div>
    </div>
  );
}
