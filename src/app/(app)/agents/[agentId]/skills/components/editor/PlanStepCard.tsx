'use client';

import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TemplateRenderer, type KnownVariable } from './TemplateRenderer';
import { cn } from '@/lib/utils';
import type { StoredPlanStep } from '@/ddd/domain/skills/entities/skill';

interface PlanStepCardProps {
  step: StoredPlanStep;
  stepNumber: number;
  knownVariables?: KnownVariable[];
  compact?: boolean;
}

/**
 * Renders a single plan step with tabs for Summary and Prompt views.
 *
 * - Summary tab: Shows the step description
 * - Prompt tab: Shows the promptTemplate with variable chips (only if template exists)
 */
export function PlanStepCard({
  step,
  stepNumber,
  knownVariables = [],
  compact = false,
}: PlanStepCardProps) {
  const hasPromptTemplate = !!step.promptTemplate?.trim();
  const [activeTab, setActiveTab] = useState<string>('summary');

  // If no template, just render the description
  if (!hasPromptTemplate) {
    return (
      <div className={cn('flex gap-2 text-xs', compact && 'py-0.5')}>
        <span className="text-muted-foreground font-medium min-w-[1.5rem]">
          {stepNumber}.
        </span>
        <span className="text-muted-foreground">{step.description}</span>
      </div>
    );
  }

  return (
    <div className={cn('border rounded-md', compact ? 'p-2' : 'p-3')}>
      <div className="flex items-start gap-2">
        <span className="text-xs text-muted-foreground font-medium min-w-[1.5rem] pt-1">
          {stepNumber}.
        </span>
        <div className="flex-1 min-w-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-7 p-0.5">
              <TabsTrigger value="summary" className="text-[11px] h-6 px-2">
                Summary
              </TabsTrigger>
              <TabsTrigger value="prompt" className="text-[11px] h-6 px-2">
                Prompt
              </TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="mt-2">
              <p className="text-xs text-muted-foreground">{step.description}</p>
            </TabsContent>

            <TabsContent value="prompt" className="mt-2">
              <div className="max-h-48 overflow-y-auto bg-muted/30 rounded p-2">
                <TemplateRenderer
                  template={step.promptTemplate || ''}
                  knownVariables={knownVariables}
                  className="text-xs"
                />
              </div>
              {step.requiredContext && step.requiredContext.length > 0 && (
                <div className="mt-2 text-[10px] text-muted-foreground">
                  <span className="font-medium">Required:</span>{' '}
                  {step.requiredContext.join(', ')}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
