'use client'

import { ChatCanvas as LlamaIndexChatCanvas, useChatCanvas } from '@llamaindex/chat-ui'
import { X, Code, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DocumentArtifactViewer, FileArtifactViewer } from './artifacts'
import { 
  isDocumentArtifact, 
  isFileArtifact, 
  isEmeryArtifact 
} from './types/chat-artifacts'

/**
 * ChatCanvas - Proper LlamaIndex ChatCanvas implementation
 * 
 * Uses the useChatCanvas hook to manage canvas state and conditionally render
 * the canvas based on artifact visibility. Must be used within ChatSection.
 * 
 * AIDEV-NOTE: Fixed to follow LlamaIndex documentation pattern for reliable canvas rendering.
 */

export function ChatCanvas() {
  try {
    const canvasContext = useChatCanvas()
    
    // Check if canvas context is available and has the expected properties
    // Different LlamaIndex versions might have different API shapes
    const hasArtifact = canvasContext && 
                       typeof canvasContext === 'object' && 
                       ('currentArtifact' in canvasContext || 'isVisible' in canvasContext)
    
    if (!hasArtifact) {
      // Fallback to simple canvas when no artifact context available
      return (
        <div className="flex-1 border-l border-border">
          <LlamaIndexChatCanvas className="h-full w-full" />
        </div>
      )
    }

    // Type assertion for known properties (defensive)
    const context = canvasContext as any
    const currentArtifact = context.currentArtifact
    const isVisible = context.isVisible
    const hideCanvas = context.hideCanvas

    // Only render enhanced version when there's a visible artifact
    if (!isVisible || !currentArtifact) {
      return (
        <div className="flex-1 border-l border-border">
          <LlamaIndexChatCanvas className="h-full w-full" />
        </div>
      )
    }

    // Check if this is a custom Emery artifact
    const isCustomArtifact = isEmeryArtifact(currentArtifact)
    
    if (isCustomArtifact) {
      // Render custom artifact viewer instead of LlamaIndex canvas
      return (
        <div className="flex-1 border-l border-border flex flex-col bg-card">
          {/* Custom Artifact Header */}
          <div className="flex items-center justify-between p-3 border-b border-border bg-muted/10">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {isDocumentArtifact(currentArtifact) ? (
                <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
              ) : (
                <FileText className="h-4 w-4 text-green-600 flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-sm truncate">
                  {isDocumentArtifact(currentArtifact) 
                    ? currentArtifact.data.documentField.documentMetadata?.title || currentArtifact.data.documentField.name
                    : isFileArtifact(currentArtifact)
                    ? currentArtifact.data.fileField.name
                    : 'Artifact'
                  }
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isDocumentArtifact(currentArtifact) ? 'Document' : 'File'}
                </p>
              </div>
            </div>
            
            {hideCanvas && (
              <Button
                variant="ghost"
                size="sm"
                onClick={hideCanvas}
                className="h-7 w-7 p-0 flex-shrink-0"
                title="Close canvas"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Custom Artifact Content */}
          <div className="flex-1 overflow-auto p-4">
            {isDocumentArtifact(currentArtifact) ? (
              <DocumentArtifactViewer 
                artifact={currentArtifact}
                className="h-full"
              />
            ) : isFileArtifact(currentArtifact) ? (
              <FileArtifactViewer 
                artifact={currentArtifact}
                className="h-full"
              />
            ) : null}
          </div>
        </div>
      )
    }

    // Enhanced canvas with header and artifact information for standard artifacts
    return (
      <div className="flex-1 border-l border-border flex flex-col bg-card">
        {/* Canvas Header with Artifact Info */}
        <div className="flex items-center justify-between p-3 border-b border-border bg-muted/10">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {currentArtifact.type === 'code' ? (
              <Code className="h-4 w-4 text-primary flex-shrink-0" />
            ) : (
              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm truncate">
                {currentArtifact.title || 
                 (currentArtifact.type === 'code' ? 'Code Editor' : 'Document')}
              </h3>
              {currentArtifact.type === 'code' && currentArtifact.data?.language && (
                <p className="text-xs text-muted-foreground">
                  {currentArtifact.data.language}
                </p>
              )}
            </div>
          </div>
          
          {hideCanvas && (
            <Button
              variant="ghost"
              size="sm"
              onClick={hideCanvas}
              className="h-7 w-7 p-0 flex-shrink-0"
              title="Close canvas"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* LlamaIndex Canvas Content */}
        <div className="flex-1 overflow-hidden">
          <LlamaIndexChatCanvas className="h-full w-full border-0" />
        </div>
      </div>
    )
  } catch (error) {
    // Fallback: If useChatCanvas fails, render basic canvas
    // This prevents the "must be used within ChatCanvasProvider" error
    console.warn('[ChatCanvas] useChatCanvas hook not available, using fallback:', error)
    return (
      <div className="flex-1 border-l border-border">
        <LlamaIndexChatCanvas className="h-full w-full" />
      </div>
    )
  }
}