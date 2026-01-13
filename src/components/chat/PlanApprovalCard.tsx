'use client'

import { Check, X, ClipboardList, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlanStepItem } from './PlanStepItem'
import { PlanStatusBadge } from './PlanStatusBadge'
import type { PendingPlanApproval, ActivePlanExecution } from './types/extended-chat-handler'

interface PlanApprovalCardProps {
  plan: PendingPlanApproval
  execution?: ActivePlanExecution | null
  onApprove: () => void
  onReject: () => void
  isLoading?: boolean
}

export function PlanApprovalCard({
  plan,
  execution,
  onApprove,
  onReject,
  isLoading = false
}: PlanApprovalCardProps) {
  const status = execution?.status || 'awaiting_approval'
  const isApproving = status === 'approved' || status === 'executing'
  const isFinished = status === 'completed' || status === 'failed' || status === 'cancelled'

  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-yellow-50 border-b border-yellow-200">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-yellow-600" />
          <span className="font-medium text-sm text-gray-900">
            Plan Requires Approval
          </span>
        </div>
        <PlanStatusBadge status={status} />
      </div>

      {/* Goal */}
      <div className="px-4 py-3 border-b border-yellow-100">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          Goal
        </div>
        <p className="text-sm text-gray-800">
          {plan.goal}
        </p>
      </div>

      {/* Context Tables (if any) */}
      {plan.contextTables && plan.contextTables.length > 0 && (
        <div className="px-4 py-2 border-b border-yellow-100 bg-yellow-50/50">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Database className="h-3 w-3" />
            <span>Context: {plan.contextTables.join(', ')}</span>
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="px-4 py-3">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Steps ({plan.steps.length})
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {plan.steps.map((step) => (
            <PlanStepItem
              key={step.index}
              step={step}
              isCurrentStep={execution?.currentStepIndex === step.index}
              isCompleted={execution?.completedSteps?.includes(step.index)}
              isFailed={execution?.failedSteps?.includes(step.index)}
            />
          ))}
        </div>
      </div>

      {/* Estimated Actions */}
      {plan.estimatedActions && (
        <div className="px-4 py-2 border-t border-yellow-100 bg-yellow-50/50">
          <span className="text-xs text-gray-500">
            Estimated actions: {plan.estimatedActions}
          </span>
        </div>
      )}

      {/* Action Buttons */}
      {!isFinished && (
        <div className="flex items-center justify-end gap-2 px-4 py-3 bg-white border-t border-yellow-200">
          <Button
            variant="outline"
            size="sm"
            onClick={onReject}
            disabled={isLoading || isApproving}
            className="gap-1"
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </Button>
          <Button
            size="sm"
            onClick={onApprove}
            disabled={isLoading || isApproving}
            className="gap-1 bg-green-600 hover:bg-green-700"
          >
            <Check className="h-3.5 w-3.5" />
            Approve
          </Button>
        </div>
      )}

      {/* Error Message */}
      {execution?.error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
          <p className="text-xs text-red-700">{execution.error}</p>
        </div>
      )}
    </div>
  )
}
