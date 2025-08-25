'use client'

import { ChatCanvas as LlamaIndexChatCanvas } from '@llamaindex/chat-ui'

/**
 * ChatCanvas - Proper LlamaIndex ChatCanvas implementation
 * 
 * This component must be used within a ChatSection that provides ChatCanvasProvider.
 * It uses the useChatCanvas hook to access canvas state and artifacts.
 * 
 * AIDEV-NOTE: Fixed to use proper LlamaIndex ChatCanvas structure with provider context.
 */

export function ChatCanvas() {
  // Simplified ChatCanvas - just render the LlamaIndex canvas
  // The useChatCanvas hook will be handled internally by LlamaIndex
  return (
    <div className="flex-1 border-l border-border">
      <LlamaIndexChatCanvas className="h-full w-full" />
    </div>
  )
}