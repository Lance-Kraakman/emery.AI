import * as React from "react"
import { Label } from "@/src/components/ui/label"
import { cn } from "@/src/lib/utils"

interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  description?: string
  className?: string
  children: React.ReactNode
}

export function FormField({
  label,
  required = false,
  error,
  description,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}