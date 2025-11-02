"use client"

/**
 * UsageStatsCard Component
 *
 * Displays token usage and cost metrics with quota progress.
 * Used in dashboards and organization settings.
 */

import * as React from "react"
import Link from "next/link"
import { TrendingUp, AlertTriangle, DollarSign, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export interface UsageStats {
  currentUsage: number
  monthlyQuota?: number
  totalCost: number
  executionCount: number
  modelBreakdown?: Array<{
    modelName: string
    totalTokens: number
    totalCost: number
  }>
}

export interface UsageStatsCardProps {
  stats: UsageStats
  loading?: boolean
  showDetails?: boolean
  detailsHref?: string
  className?: string
}

export function UsageStatsCard({
  stats,
  loading = false,
  showDetails = true,
  detailsHref = "/settings/organization/usage",
  className,
}: UsageStatsCardProps) {
  const percentageUsed = stats.monthlyQuota
    ? (stats.currentUsage / stats.monthlyQuota) * 100
    : 0

  const quotaStatus = getQuotaStatus(percentageUsed)

  if (loading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-3">
          <div className="h-5 w-32 bg-muted animate-pulse rounded" />
          <div className="h-4 w-48 bg-muted animate-pulse rounded mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-2 bg-muted animate-pulse rounded" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-16 bg-muted animate-pulse rounded" />
              <div className="h-16 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Token Usage
          </CardTitle>
          <QuotaStatusBadge status={quotaStatus} />
        </div>
        <CardDescription>
          Current month usage and costs
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quota Progress */}
        {stats.monthlyQuota && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {stats.currentUsage.toLocaleString()} / {stats.monthlyQuota.toLocaleString()} tokens
              </span>
              <span className="font-medium">
                {percentageUsed.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={Math.min(percentageUsed, 100)}
              className={cn(
                "h-2",
                quotaStatus === 'critical' && "bg-red-200 [&>div]:bg-red-500",
                quotaStatus === 'warning' && "bg-yellow-200 [&>div]:bg-yellow-500",
                quotaStatus === 'normal' && "bg-green-200 [&>div]:bg-green-500"
              )}
            />
            {quotaStatus !== 'normal' && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>
                  {quotaStatus === 'critical'
                    ? 'Critical: Quota almost exceeded. New executions may be blocked.'
                    : 'Warning: Approaching quota limit. Consider upgrading your plan.'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <MetricCard
            label="Total Cost"
            value={`$${stats.totalCost.toFixed(2)}`}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <MetricCard
            label="Executions"
            value={stats.executionCount.toLocaleString()}
            icon={<TrendingUp className="h-4 w-4" />}
          />
        </div>

        {/* Model Breakdown */}
        {stats.modelBreakdown && stats.modelBreakdown.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Top Models</h4>
            <div className="space-y-1.5">
              {stats.modelBreakdown.slice(0, 3).map((model) => (
                <div
                  key={model.modelName}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-muted-foreground truncate flex-1">
                    {getModelDisplayName(model.modelName)}
                  </span>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-muted-foreground">
                      {model.totalTokens.toLocaleString()}
                    </span>
                    <span className="font-medium">
                      ${model.totalCost.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {showDetails && (
        <CardFooter>
          <Button variant="ghost" size="sm" asChild className="w-full">
            <Link href={detailsHref}>
              View Detailed Usage →
            </Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}

function QuotaStatusBadge({ status }: { status: 'normal' | 'warning' | 'critical' | 'unlimited' }) {
  const configs = {
    normal: {
      label: "Normal",
      className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    },
    warning: {
      label: "Warning",
      className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    },
    critical: {
      label: "Critical",
      className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    },
    unlimited: {
      label: "Unlimited",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    },
  }

  const config = configs[status]

  return (
    <Badge variant="secondary" className={cn("text-xs", config.className)}>
      {config.label}
    </Badge>
  )
}

function getQuotaStatus(percentageUsed: number): 'normal' | 'warning' | 'critical' | 'unlimited' {
  if (percentageUsed === 0) return 'unlimited'
  if (percentageUsed >= 95) return 'critical'
  if (percentageUsed >= 80) return 'warning'
  return 'normal'
}

function getModelDisplayName(fullName: string): string {
  // Extract short name from full model ID
  // e.g., "ibm-granite/granite-3.3-8b-instruct" → "Granite 3.3 8B"
  const parts = fullName.split('/')
  const modelName = parts[parts.length - 1]

  // Simple transformation - could be enhanced with model registry lookup
  return modelName
    .replace(/-/g, ' ')
    .replace(/instruct/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}
