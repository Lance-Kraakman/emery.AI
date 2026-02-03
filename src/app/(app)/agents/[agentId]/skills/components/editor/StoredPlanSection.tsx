'use client';

/**
 * StoredPlanSection Component
 *
 * Reusable component for displaying stored execution plans.
 * Used in AgenticSkillEditor and SkillConfigPanel (org-chart).
 */

import React from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { StoredPlan } from '@/ddd/domain/skills/entities/skill';

interface StoredPlanSectionProps {
  plan?: StoredPlan;
  onRemove?: () => void;
  isReadOnly?: boolean;
  /** Compact mode for smaller panels */
  compact?: boolean;
}

export function StoredPlanSection({
  plan,
  onRemove,
  isReadOnly = false,
  compact = false,
}: StoredPlanSectionProps) {
  if (!plan) return null;

  const textSize = compact ? 'text-[10px]' : 'text-xs';
  const labelSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className={`${labelSize} font-medium`}>Stored Plan</Label>
        {onRemove && !isReadOnly && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onRemove}
            title="Remove stored plan"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <div className={`${textSize} text-muted-foreground space-y-1 p-2 bg-muted rounded`}>
        <div>
          <strong>Goal:</strong> {plan.goal}
        </div>
        <div>
          <strong>Steps:</strong> {plan.steps?.length || 0}
        </div>
        {plan.approvedAt && (
          <div>
            <strong>Approved:</strong>{' '}
            {new Date(plan.approvedAt).toLocaleDateString()}
          </div>
        )}
      </div>

      {plan.steps && plan.steps.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className={`flex items-center ${textSize} text-primary hover:text-primary/80`}>
            View steps <ChevronDown className="h-3 w-3 ml-1" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className={`${textSize} space-y-1 mt-1`}>
              {plan.steps.map((step, i) => (
                <li
                  key={step.stepId}
                  className="pl-2 border-l border-muted-foreground/30"
                >
                  {i + 1}. {step.description}
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
