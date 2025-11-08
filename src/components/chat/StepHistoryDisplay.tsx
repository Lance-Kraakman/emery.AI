'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ExecutionStep } from '@/app/dtos/chat.dto'
import { getStepConfig } from '@/lib/chat/step-config'

interface StepHistoryDisplayProps {
  steps: ExecutionStep[]
}

/**
 * Individual step item component
 */
function StepHistoryItem({ step }: { step: ExecutionStep }) {
  const [showDetails, setShowDetails] = useState(false)
  const config = getStepConfig(step.type)
  const Icon = config.icon
  const hasMetadata = step.metadata && (step.metadata.tool || step.metadata.arguments)

  return (
    <div className="pl-1 py-1">
      <div className="flex items-start gap-2">
        <div className={`${config.color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{step.name}</span>
          </div>

          {step.content && (
            <div className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
              {step.content}
            </div>
          )}

          {hasMetadata && (
            <details className="mt-2">
              <summary
                className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={(e) => {
                  e.preventDefault()
                  setShowDetails(!showDetails)
                }}
              >
                {showDetails ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {step.metadata?.tool ? `Tool: ${step.metadata.tool}` : 'Details'}
              </summary>
              {showDetails && (
                <div className="mt-2 p-2 bg-transparent rounded text-xs space-y-1">
                  {step.metadata?.tool && (
                    <div>
                      <span className="font-medium">Tool:</span> {step.metadata.tool}
                    </div>
                  )}
                  {step.metadata?.arguments && (
                    <div>
                      <span className="font-medium">Arguments:</span>
                      <pre className="mt-1 whitespace-pre-wrap break-words">
                        {step.metadata.arguments}
                      </pre>
                    </div>
                  )}
                  {step.metadata?.observations && (
                    <div>
                      <span className="font-medium">Observations:</span>
                      <pre className="mt-1 whitespace-pre-wrap break-words">
                        {step.metadata.observations}
                      </pre>
                    </div>
                  )}
                  {step.metadata?.error && (
                    <div className="text-destructive">
                      <span className="font-medium">Error:</span> {step.metadata.error}
                    </div>
                  )}
                </div>
              )}
            </details>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Step History Display
 *
 * Shows persistent execution step history for assistant messages.
 * Displays steps that were collected during agent processing,
 * providing transparency into the agent's reasoning and actions.
 */
export function StepHistoryDisplay({ steps }: StepHistoryDisplayProps) {
  if (!steps || steps.length === 0) {
    return null
  }

  return (
    <div className="my-2 space-y-1">
      {steps.map((step) => (
        <StepHistoryItem key={`${step.index}-${step.timestamp}`} step={step} />
      ))}
    </div>
  )
}
