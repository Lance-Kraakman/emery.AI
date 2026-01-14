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
  const hasMetadata = step.metadata && (step.metadata.tool || step.metadata.arguments || step.metadata.skill_name)

  return (
    <div className="pl-1 py-0.5">
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
                  {step.metadata?.skill_name && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Skill:</span>
                        <span>{step.metadata.skill_name}</span>
                        {step.metadata.skill_status && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            step.metadata.skill_status === 'completed' ? 'bg-green-500/20 text-green-600' :
                            step.metadata.skill_status === 'failed' ? 'bg-red-500/20 text-red-600' :
                            'bg-yellow-500/20 text-yellow-600'
                          }`}>
                            {step.metadata.skill_status}
                          </span>
                        )}
                      </div>
                      {step.metadata.skill_message && (
                        <div className="text-muted-foreground whitespace-pre-wrap pl-2 border-l-2 border-muted">
                          {step.metadata.skill_message}
                        </div>
                      )}
                    </div>
                  )}
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
    <div className="my-1 space-y-0.5">
      {steps.map((step) => (
        <StepHistoryItem key={`${step.index}-${step.timestamp}`} step={step} />
      ))}
    </div>
  )
}
