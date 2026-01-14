'use client'

import { cn } from '@/lib/utils'
import type { PlanExecutionStatus } from './types/extended-chat-handler'

interface PlanStatusBadgeProps {
  status: PlanExecutionStatus
  className?: string
}

const statusConfig: Record<PlanExecutionStatus, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-gray-100 text-gray-700 border-gray-200'
  },
  awaiting_approval: {
    label: 'Awaiting Approval',
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200 animate-pulse'
  },
  approved: {
    label: 'Approved',
    className: 'bg-green-50 text-green-700 border-green-200'
  },
  executing: {
    label: 'Executing',
    className: 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-100 text-green-800 border-green-300'
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-50 text-red-700 border-red-200'
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-gray-100 text-gray-600 border-gray-200'
  }
}

export function PlanStatusBadge({ status, className }: PlanStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
