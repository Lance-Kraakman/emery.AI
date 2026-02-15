'use client'

import React from 'react'
import { Loader2, XCircle, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getStepConfig } from '@/lib/chat/step-config'

type StepStatus = 'executing' | 'completed' | 'failed'

interface StepProgressIndicatorProps {
  currentStep: {
    type: string
    name: string
    index: number
    content?: string
    status?: StepStatus
  } | null
  isLoading: boolean
  onCancel?: () => void
}

/**
 * Get the appropriate icon based on step status
 */
function getStatusIcon(status?: StepStatus) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-red-500" />
    case 'executing':
    default:
      return <Loader2 className="h-4 w-4 animate-spin" />
  }
}

/**
 * Step Progress Indicator
 *
 * Shows real-time agent execution progress during message generation
 */
export function StepProgressIndicator({
  currentStep,
  isLoading,
  onCancel
}: StepProgressIndicatorProps) {
  if (!isLoading || !currentStep) {
    return null
  }

  const config = getStepConfig(currentStep.type)
  const status = currentStep.status || 'executing'

  // Customize message based on step type and status
  let message: string = config.loadingMessage
  if (status === 'completed') {
    message = currentStep.name ? `Completed ${currentStep.name}` : 'Step completed'
  } else if (status === 'failed') {
    message = currentStep.name ? `Failed: ${currentStep.name}` : 'Step failed'
  } else if (currentStep.type === 'ACTION' && currentStep.name) {
    message = `Using ${currentStep.name}...`
  } else if (currentStep.type === 'CODE_EXECUTION') {
    message = 'Executing code...'
  }

  return (
    <div className="transition-all duration-300">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          {getStatusIcon(status)}
          <span className="text-sm">
            {message}
          </span>
        </div>

        {onCancel && status === 'executing' && (
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
