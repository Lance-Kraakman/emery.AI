"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface HorizontalResizeHandleProps {
  className?: string
  onResize?: (height: number) => void
  minHeight?: number
  maxHeight?: number
}

export const HorizontalResizeHandle = React.forwardRef<
  HTMLButtonElement,
  HorizontalResizeHandleProps
>(({ className, onResize, minHeight = 200, maxHeight = 800 }, ref) => {
  const [isDragging, setIsDragging] = React.useState(false)

  React.useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!onResize) return

      // Calculate height from mouse Y position
      // We need to know the container's top position
      const containerTop = 0 // Will be set dynamically
      const height = e.clientY - containerTop

      // Clamp between min and max
      const clampedHeight = Math.min(Math.max(height, minHeight), maxHeight)

      onResize(clampedHeight)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    // Set cursor for entire document during drag
    document.body.style.cursor = "row-resize"
    document.body.style.userSelect = "none"

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [isDragging, onResize, minHeight, maxHeight])

  return (
    <button
      ref={ref}
      data-resize-handle="horizontal"
      aria-label="Resize Panel Height"
      tabIndex={-1}
      onMouseDown={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      className={cn(
        "absolute inset-x-0 bottom-0 z-20 hidden h-4 -translate-y-1/2 transition-all ease-linear after:absolute after:inset-x-0 after:top-1/2 after:h-[2px] hover:after:bg-border sm:flex",
        "cursor-row-resize",
        isDragging && "after:bg-border",
        className
      )}
    />
  )
})
HorizontalResizeHandle.displayName = "HorizontalResizeHandle"
