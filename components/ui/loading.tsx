import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingProps {
  className?: string
  size?: "sm" | "default" | "lg"
  text?: string
}

const sizeClasses = {
  sm: "h-4 w-4",
  default: "h-6 w-6", 
  lg: "h-8 w-8"
}

export function Loading({ className, size = "default", text }: LoadingProps) {
  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <Loader2 className={cn("animate-spin", sizeClasses[size])} />
      {text && <span className="text-sm text-muted-foreground">{text}</span>}
    </div>
  )
}

interface LoadingOverlayProps {
  isLoading: boolean
  text?: string
  children: React.ReactNode
}

export function LoadingOverlay({ isLoading, text = "Loading...", children }: LoadingOverlayProps) {
  if (!isLoading) return <>{children}</>
  
  return (
    <div className="relative">
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
        <Loading text={text} />
      </div>
    </div>
  )
}