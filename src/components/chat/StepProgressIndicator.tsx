'use client'

import React from 'react'
import { Loader2, Brain, Wrench, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StepProgressIndicatorProps {
  currentStep: {
    type: string
    name: string
    index: number
    content?: string
  } | null
  isLoading: boolean
  onCancel?: () => void
}

/**
 * Step Progress Indicator
 *
 * Shows real-time agent execution progress:
 * - PLANNING: Agent is thinking about what to do
 * - ACTION: Agent is executing a tool
 * - REASONING: Agent is analyzing results
 * - FINAL: Agent is generating final answer
 */
export function StepProgressIndicator({
  currentStep,
  isLoading,
  onCancel
}: StepProgressIndicatorProps) {
  if (!isLoading || !currentStep) {
    return null
  }

  const getStepMessage = () => {
    switch (currentStep.type) {
      case 'PLANNING':
        return 'Thinking...'
      case 'ACTION':
        return currentStep.name ? `Using ${currentStep.name}...` : 'Executing action...'
      case 'REASONING':
        return 'Processing results...'
      case 'FINAL':
        return 'Finalizing response...'
      default:
        return 'Working...'
    }
  }

  return (
    <div className="transition-all duration-300">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">
            {getStepMessage()}
          </span>
        </div>

        {onCancel && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            className="h-7 px-2 text-xs hover:bg-destructive/10 hover:text-destructive"
          >
            <XCircle className="h-3 w-3 mr-1" />
            Cancel
          </Button>
        )}
      </div>

      {/* Display step content if available */}
      {currentStep.content && (
        <div className="text-xs text-muted-foreground/70 whitespace-pre-wrap line-clamp-3">
          {currentStep.content}
        </div>
      )}
    </div>
  )
}
