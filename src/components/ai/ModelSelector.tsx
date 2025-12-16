"use client"

/**
 * ModelSelector Component
 *
 * Reusable dropdown for AI model selection with rich metadata display.
 * Supports tier-based filtering, capability requirements, and cost preview.
 */

import * as React from "react"
import { Check, ChevronDown, Sparkles, Zap, Target, Settings2, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  getAllModels,
  getModelsForTier,
  getModelsWithCapability,
  canAccessModel,
  type ModelMetadata
} from "@/lib/ai/model-registry"

export interface ModelSelectorProps {
  value?: string | null
  onChange: (modelId: string | null) => void
  organizationTier?: 'free' | 'pro' | 'max' | 'enterprise'
  availableModels?: string[]
  showInherit?: boolean
  inheritLabel?: string
  inheritFromModel?: string
  requiredCapabilities?: Array<keyof ModelMetadata['capabilities']>
  className?: string
  disabled?: boolean
  /** Compact icon-only mode for headers */
  compact?: boolean
}

export function ModelSelector({
  value,
  onChange,
  organizationTier = 'free',
  availableModels,
  showInherit = false,
  inheritLabel = "Inherit",
  inheritFromModel,
  requiredCapabilities = [],
  className,
  disabled = false,
  compact = false,
}: ModelSelectorProps) {
  // Get filtered models based on tier and capabilities
  const models = React.useMemo(() => {
    let filteredModels = getModelsForTier(organizationTier)

    // Filter by required capabilities
    if (requiredCapabilities.length > 0) {
      filteredModels = filteredModels.filter(model =>
        requiredCapabilities.every(cap => model.capabilities[cap])
      )
    }

    // Filter by organization's available models whitelist
    if (availableModels && availableModels.length > 0) {
      filteredModels = filteredModels.filter(model =>
        availableModels.includes(model.id)
      )
    }

    return filteredModels
  }, [organizationTier, availableModels, requiredCapabilities])

  // Get current model metadata for display
  const currentModel = React.useMemo(() => {
    if (!value) return null
    return models.find(m => m.id === value)
  }, [value, models])

  const handleValueChange = (newValue: string) => {
    if (newValue === '__inherit__') {
      onChange(null)
    } else {
      onChange(newValue)
    }
  }

  // Get tooltip text for compact mode
  const tooltipText = currentModel?.name || inheritLabel

  const selectContent = (
    <SelectContent className="max-h-[400px]">
      {showInherit && (
        <SelectItem value="__inherit__" className="font-medium">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span>{inheritLabel}</span>
            {inheritFromModel && (
              <span className="text-xs text-muted-foreground">
                ({inheritFromModel})
              </span>
            )}
          </div>
        </SelectItem>
      )}

      {models.map((model) => (
        <SelectItem
          key={model.id}
          value={model.id}
          className="cursor-pointer"
        >
          <ModelOption model={model} />
        </SelectItem>
      ))}

      {models.length === 0 && (
        <div className="py-6 text-center text-sm text-muted-foreground">
          No models available
        </div>
      )}
    </SelectContent>
  )

  // Compact mode: icon-only with tooltip
  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Select
              value={value || '__inherit__'}
              onValueChange={handleValueChange}
              disabled={disabled}
            >
              <SelectTrigger
                className={cn(
                  "h-7 w-auto gap-1 px-2 border-0 bg-transparent hover:bg-muted/50",
                  className
                )}
              >
                <SelectValue>
                  {currentModel ? (
                    <CategoryIcon category={currentModel.category} hasVision={currentModel.capabilities.vision} className="h-4 w-4" />
                  ) : (
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                  )}
                </SelectValue>
              </SelectTrigger>
              {selectContent}
            </Select>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  // Full mode: standard dropdown
  return (
    <Select
      value={value || '__inherit__'}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue>
          {value ? (
            <ModelDisplayValue model={currentModel} />
          ) : (
            <span className="text-muted-foreground">
              {inheritLabel}
              {inheritFromModel && (
                <span className="ml-2 text-xs">
                  ({inheritFromModel})
                </span>
              )}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      {selectContent}
    </Select>
  )
}

function ModelDisplayValue({ model }: { model: ModelMetadata | null | undefined }) {
  if (!model) return null

  return (
    <div className="flex items-center gap-2">
      <CategoryIcon category={model.category} hasVision={model.capabilities.vision} className="h-4 w-4" />
      <span className="truncate">{model.name}</span>
      <TierBadge tier={model.tier} />
    </div>
  )
}

function ModelOption({ model }: { model: ModelMetadata }) {
  return (
    <div className="flex flex-col gap-1.5 py-1">
      <div className="flex items-center gap-2">
        <CategoryIcon category={model.category} hasVision={model.capabilities.vision} className="h-4 w-4" />
        <span className="font-medium">{model.name}</span>
        <TierBadge tier={model.tier} />
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{model.contextWindow.toLocaleString()} ctx</span>
        <span>•</span>
        <span>
          ${model.pricing.inputPer1M.toFixed(2)}/
          ${model.pricing.outputPer1M.toFixed(2)} per 1M
        </span>
      </div>

      <div className="flex flex-wrap gap-1 mt-1">
        {model.capabilities.toolCalling && (
          <Badge variant="secondary" className="text-xs">
            Tool Calling
          </Badge>
        )}
        {model.capabilities.streaming && (
          <Badge variant="secondary" className="text-xs">
            Streaming
          </Badge>
        )}
        {model.capabilities.jsonMode && (
          <Badge variant="secondary" className="text-xs">
            JSON Mode
          </Badge>
        )}
        {model.capabilities.vision && (
          <Badge variant="secondary" className="text-xs">
            Vision
          </Badge>
        )}
      </div>
    </div>
  )
}

function CategoryIcon({ category, hasVision, className }: {
  category: 'fast' | 'balanced' | 'advanced'
  hasVision?: boolean
  className?: string
}) {
  // Vision models get Eye icon regardless of category
  if (hasVision) {
    return <Eye className={cn("text-emerald-500", className)} />
  }

  switch (category) {
    case 'fast':
      return <Zap className={cn("text-yellow-500", className)} />
    case 'balanced':
      return <Target className={cn("text-blue-500", className)} />
    case 'advanced':
      return <Sparkles className={cn("text-purple-500", className)} />
  }
}

function TierBadge({ tier }: { tier: 'free' | 'pro' | 'max' | 'enterprise' }) {
  if (tier === 'free') return null

  const colors = {
    pro: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    max: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    enterprise: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  }

  return (
    <Badge variant="secondary" className={cn("text-xs", colors[tier])}>
      {tier.toUpperCase()}
    </Badge>
  )
}
