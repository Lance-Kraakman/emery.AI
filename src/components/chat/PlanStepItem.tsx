'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, Wrench, CheckCircle, XCircle, Circle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PlanStepData } from '@/lib/chat/types/sse-events'

interface PlanStepItemProps {
  step: PlanStepData
  isCurrentStep?: boolean
  isCompleted?: boolean
  isFailed?: boolean
}

export function PlanStepItem({
  step,
  isCurrentStep = false,
  isCompleted = false,
  isFailed = false
}: PlanStepItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const hasDetails = step.toolName || step.toolArgs

  const getStatusIcon = () => {
    if (isCompleted) {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    }
    if (isFailed) {
      return <XCircle className="h-4 w-4 text-red-500" />
    }
    if (isCurrentStep) {
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    }
    return <Circle className="h-4 w-4 text-gray-300" />
  }

  return (
    <div
      className={cn(
        'rounded-md border transition-colors',
        isCurrentStep && 'border-blue-200 bg-blue-50/50',
        isCompleted && 'border-green-200 bg-green-50/30',
        isFailed && 'border-red-200 bg-red-50/30',
        !isCurrentStep && !isCompleted && !isFailed && 'border-gray-200 bg-white'
      )}
    >
      <button
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-start gap-2 p-2 text-left',
          hasDetails && 'cursor-pointer hover:bg-gray-50/50'
        )}
        disabled={!hasDetails}
      >
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          {hasDetails && (
            isExpanded ? (
              <ChevronDown className="h-3 w-3 text-gray-400" />
            ) : (
              <ChevronRight className="h-3 w-3 text-gray-400" />
            )
          )}
          {!hasDetails && <div className="w-3" />}
          {getStatusIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">
              Step {step.index + 1}
            </span>
            {step.toolName && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <Wrench className="h-3 w-3" />
                {step.toolName}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700 mt-0.5">
            {step.description}
          </p>
        </div>
      </button>

      {isExpanded && hasDetails && (
        <div className="px-2 pb-2 pt-0 ml-9">
          {step.toolName && (
            <div className="text-xs">
              <span className="text-gray-500">Tool: </span>
              <code className="text-gray-700 bg-gray-100 px-1 py-0.5 rounded">
                {step.toolName}
              </code>
            </div>
          )}
          {step.toolArgs && Object.keys(step.toolArgs).length > 0 && (
            <div className="mt-1">
              <span className="text-xs text-gray-500">Arguments:</span>
              <pre className="mt-0.5 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                {JSON.stringify(step.toolArgs, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
