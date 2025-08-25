'use client'

import { ChatCanvas as LlamaIndexChatCanvas, useChatCanvas } from '@llamaindex/chat-ui'
import { X, Code, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * ChatCanvas - Proper LlamaIndex ChatCanvas implementation
 * 
 * This component must be used within a ChatSection that provides ChatCanvasProvider.
 * It uses the useChatCanvas hook to access canvas state and artifacts.
 * 
 * AIDEV-NOTE: Fixed to use proper LlamaIndex ChatCanvas structure with provider context.
 */

export function ChatCanvas() {
  try {
    const { currentArtifact, isVisible, hideCanvas } = useChatCanvas()
    
    // If no artifact is visible, don't render anything
    if (!isVisible || !currentArtifact) {
      return null
    }

    // When artifact is present, show enhanced canvas with header
    return (
      <div className="flex-1 border-l border-border flex flex-col bg-card">
        {/* Canvas Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-foreground">
              {currentArtifact.title ||
                (currentArtifact.type === 'code'
                  ? currentArtifact.data?.file_name || 'Code'
                  : 'Document')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {currentArtifact.type === 'code' ? (
                <span className="flex items-center gap-1">
                  <Code className="h-3 w-3" />
                  {currentArtifact.data?.language || 'Code'} • Code Editor
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Document Editor
                </span>
              )}
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={hideCanvas}
            className="h-8 w-8 p-0"
            title="Close canvas"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Canvas Content Area - This is where LlamaIndex renders the actual canvas */}
        <div className="flex-1 overflow-hidden relative">
          <LlamaIndexChatCanvas className="h-full w-full rounded-none border-0" />
        </div>
      </div>
    )
  } catch (error) {
    // If useChatCanvas hook is not available, return null (no canvas)
    console.warn('ChatCanvas: useChatCanvas hook not available:', error)
    return null
  }
}