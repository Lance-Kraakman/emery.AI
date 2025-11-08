import { useEffect, useCallback, useState, RefObject } from 'react'

interface UseChatInputStateOptions {
  /** Minimum height in pixels (default: 44px for single line) */
  minHeight?: number
  /** Maximum height in pixels before scrolling */
  maxHeight?: number
  /** Additional dependencies that should trigger resize */
  dependencies?: any[]
}

interface ChatInputState {
  /** Whether the textarea is in single-line mode (at minimum height) */
  isSingleLine: boolean
  /** Manual resize function if needed */
  resize: () => void
}

/**
 * Chat input state hook - manages auto-resize and layout mode detection
 *
 * Automatically adjusts textarea height based on content using scrollHeight
 * and tracks whether the input is in single-line mode for conditional layouts.
 * Perfect for chat inputs with dynamic layouts (ChatGPT/Claude style).
 *
 * @param textareaRef - React ref to the textarea element
 * @param value - Current textarea value (triggers resize on change)
 * @param options - Configuration options
 *
 * @returns Object with isSingleLine boolean and resize function
 *
 * @example
 * ```tsx
 * const textareaRef = useRef<HTMLTextAreaElement>(null)
 * const { isSingleLine } = useChatInputState(textareaRef, inputValue, {
 *   minHeight: 44,  // Single line height
 *   maxHeight: 400  // Max before scrolling
 * })
 *
 * // Use isSingleLine for conditional layout
 * <div className={isSingleLine ? "flex flex-row" : "relative"}>
 *   {isSingleLine && <Button>Icon</Button>}
 *   <Textarea ref={textareaRef} />
 * </div>
 * ```
 *
 * AIDEV-NOTE: This hook manages both auto-resize and single-line detection.
 * Uses scrollHeight to calculate natural height of textarea content.
 * We reset height to 'auto' first to get accurate scrollHeight, then set
 * it to the calculated value. Also tracks whether textarea is at minimum
 * height (single-line mode) to enable conditional layouts in components.
 */
export function useChatInputState(
  textareaRef: RefObject<HTMLTextAreaElement>,
  value: string,
  options: UseChatInputStateOptions = {}
): ChatInputState {
  const { minHeight = 44, maxHeight = 400, dependencies = [] } = options

  // Track whether textarea is in single-line mode
  const [isSingleLine, setIsSingleLine] = useState(true)

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

    // Update single-line state (true if at minimum height)
    setIsSingleLine(newHeight <= minHeight)
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

  // Return both state and resize function
  return { isSingleLine, resize }
}
