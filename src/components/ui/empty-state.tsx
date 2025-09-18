import * as React from "react"
import { LucideIcon } from "lucide-react"
import { Button } from "@/src/components/ui/button"
import { cn } from "@/src/lib/utils"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: "default" | "secondary" | "outline"
  }
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("text-center py-12", className)}>
      {Icon && (
        <Icon className="mx-auto text-muted-foreground mb-4" size={48} />
      )}
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      {description && (
        <p className="text-muted-foreground mb-4 max-w-sm mx-auto">{description}</p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          variant={action.variant || "default"}
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}