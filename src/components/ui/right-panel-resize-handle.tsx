"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface RightPanelResizeHandleProps {
  className?: string
  onResize?: (width: number) => void
  minWidth?: number
  maxWidth?: number
}

export const RightPanelResizeHandle = React.forwardRef<
  HTMLButtonElement,
  RightPanelResizeHandleProps
>(({ className, onResize, minWidth = 280, maxWidth = 600 }, ref) => {
  const [isDragging, setIsDragging] = React.useState(false)

  React.useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!onResize) return

      // Calculate width from right edge of viewport
      const width = window.innerWidth - e.clientX

      // Clamp between min and max
      const clampedWidth = Math.min(Math.max(width, minWidth), maxWidth)

      onResize(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    // Set cursor for entire document during drag
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [isDragging, onResize, minWidth, maxWidth])

  return (
    <button
      ref={ref}
      data-resize-handle="right-panel"
      aria-label="Resize Panel"
      tabIndex={-1}
      onMouseDown={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      className={cn(
        "absolute inset-y-0 left-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:right-1/2 after:w-[2px] hover:after:bg-border sm:flex",
        "cursor-col-resize",
        isDragging && "after:bg-border",
        className
      )}
    />
  )
})
RightPanelResizeHandle.displayName = "RightPanelResizeHandle"
