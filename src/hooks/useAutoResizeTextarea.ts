import { useEffect, useCallback, RefObject } from 'react'

interface UseAutoResizeTextareaOptions {
  /** Minimum height in pixels (default: 44px for single line) */
  minHeight?: number
  /** Maximum height in pixels before scrolling */
  maxHeight?: number
  /** Additional dependencies that should trigger resize */
  dependencies?: any[]
}

/**
 * Auto-resize textarea hook for single-line input that grows with content
 *
 * Automatically adjusts textarea height based on content using scrollHeight.
 * Starts at minHeight (single line) and grows up to maxHeight.
 * Perfect for chat inputs similar to Claude/ChatGPT.
 *
 * @param textareaRef - React ref to the textarea element
 * @param value - Current textarea value (triggers resize on change)
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * const textareaRef = useRef<HTMLTextAreaElement>(null)
 * useAutoResizeTextarea(textareaRef, inputValue, {
 *   minHeight: 44,  // Single line height
 *   maxHeight: 400  // Max before scrolling
 * })
 * ```
 *
 * AIDEV-NOTE: This hook uses scrollHeight to calculate the natural height
 * of the textarea content. We reset height to 'auto' first to get accurate
 * scrollHeight, then set it to the calculated value. This ensures smooth
 * auto-growth as the user types or adds lines with Shift+Enter.
 */
export function useAutoResizeTextarea(
  textareaRef: RefObject<HTMLTextAreaElement>,
  value: string,
  options: UseAutoResizeTextareaOptions = {}
) {
  const { minHeight = 44, maxHeight = 400, dependencies = [] } = options

  const resize = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to 'auto' to get accurate scrollHeight measurement
    // Without this, scrollHeight would be constrained by current height
    textarea.style.height = 'auto'

    // Calculate new height based on content
    // Constrain between minHeight and maxHeight
    const newHeight = Math.min(
      Math.max(textarea.scrollHeight, minHeight),
      maxHeight
    )

    // Apply the calculated height
    textarea.style.height = `${newHeight}px`

    // Only show scrollbar if content exceeds max height
    textarea.style.overflowY = newHeight >= maxHeight ? 'auto' : 'hidden'
  }, [textareaRef, minHeight, maxHeight])

  // Resize whenever value changes (user types, paste, etc.)
  useEffect(() => {
    resize()
  }, [value, ...dependencies, resize])

  // Resize on mount and when window is resized
  useEffect(() => {
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [resize])

  // Return resize function for manual triggering if needed
  return resize
}
