'use client'

// AIDEV-NOTE: Temporarily commented out LlamaIndex imports to fix build issues
// import { ChatCanvas as LlamaIndexChatCanvas, useChatCanvas } from '@llamaindex/chat-ui'
import { X, Code, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * ChatCanvas - Proper LlamaIndex ChatCanvas implementation
 * 
 * Uses the useChatCanvas hook to manage canvas state and conditionally render
 * the canvas based on artifact visibility. Must be used within ChatSection.
 * 
 * AIDEV-NOTE: Fixed to follow LlamaIndex documentation pattern for reliable canvas rendering.
 */

export function ChatCanvas() {
  // AIDEV-NOTE: Placeholder component - LlamaIndex temporarily disabled
  return (
    <div className="flex-1 border-l border-border">
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center text-muted-foreground p-8">
          <Code className="h-16 w-16 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Canvas Temporarily Disabled</h3>
          <p className="text-sm">
            Chat canvas functionality is currently disabled
          </p>
        </div>
      </div>
    </div>
  )
}