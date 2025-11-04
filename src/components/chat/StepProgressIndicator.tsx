'use client'

import React from 'react'
import { Loader2, Brain, Wrench, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StepProgressIndicatorProps {
  currentStep: {
    type: string
    name: string
    index: number
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

  const getStepIcon = () => {
    switch (currentStep.type) {
      case 'PLANNING':
        return <Brain className="h-4 w-4 animate-pulse text-blue-500" />
      case 'ACTION':
        return <Wrench className="h-4 w-4 animate-pulse text-orange-500" />
      case 'REASONING':
        return <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
      case 'FINAL':
        return <CheckCircle2 className="h-4 w-4 animate-pulse text-green-500" />
      default:
        return <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
    }
  }

  const getStepColor = () => {
    switch (currentStep.type) {
      case 'PLANNING':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900'
      case 'ACTION':
        return 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-900'
      case 'REASONING':
        return 'bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-900'
      case 'FINAL':
        return 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900'
      default:
        return 'bg-gray-50 border-gray-200 dark:bg-gray-950/20 dark:border-gray-900'
    }
  }

  return (
    <div className={`flex items-center justify-between px-4 py-2 border rounded-lg ${getStepColor()} transition-all duration-300`}>
      <div className="flex items-center gap-3">
        {getStepIcon()}
        <div className="flex flex-col">
          <div className="text-sm font-medium text-foreground/90">
            {currentStep.name}
          </div>
          <div className="text-xs text-muted-foreground">
            Step {currentStep.index + 1}
          </div>
        </div>
      </div>

      {onCancel && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="h-7 px-2 text-xs hover:bg-destructive/10 hover:text-destructive"
        >
          <XCircle className="h-4 w-4 mr-1" />
          Cancel
        </Button>
      )}
    </div>
  )
}
