'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { ChatCanvas as LlamaIndexChatCanvas, useChatCanvas } from '@llamaindex/chat-ui'
import { X, Code, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLayout } from '@/components/layout/LayoutProvider'
import { useArtifact } from '@/contexts/ArtifactContext'
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
 * the canvas based on artifact visibility. Can be used within ChatSection or
 * in the main layout when artifacts should be displayed as primary content.
 * 
 * AIDEV-NOTE: Enhanced to work both inside ChatSection and as main content.
 */

interface ChatCanvasProps {
  isMainContent?: boolean
}

export function ChatCanvas({ isMainContent = false }: ChatCanvasProps) {
  const { toggleCanvas } = useLayout()
  const { shouldShowChatCanvas } = useArtifact()
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null)
  
  // Find the portal element for main content rendering
  useEffect(() => {
    if (shouldShowChatCanvas) {
      const element = document.getElementById('chat-canvas-portal')
      setPortalElement(element)
    } else {
      setPortalElement(null)
    }
  }, [shouldShowChatCanvas])
  
  try {
    const canvasContext = useChatCanvas()
    
    // Check if canvas context is available and get the displayed artifact
    if (!canvasContext) {
      // Fallback to simple canvas when no artifact context available
      return (
        <div className="flex-1 border-l border-border">
          <LlamaIndexChatCanvas className="h-full w-full" />
        </div>
      )
    }

    // Use the correct interface properties from ChatCanvasContextType
    const { displayedArtifact, allArtifacts } = canvasContext
    
    // Only render enhanced version when there's a displayed artifact
    if (!displayedArtifact) {
      return (
        <div className="flex-1 border-l border-border">
          <LlamaIndexChatCanvas className="h-full w-full" />
        </div>
      )
    }

    // Check if this is a custom Emery artifact
    const isCustomArtifact = isEmeryArtifact(displayedArtifact)
    
    // Render the canvas content
    const canvasContent = isCustomArtifact ? (
      <div className="flex-1 border-l border-border flex flex-col bg-card">
          {/* Custom Artifact Header */}
          <div className="flex items-center justify-between p-3 border-b border-border bg-muted/10">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {isDocumentArtifact(displayedArtifact) ? (
                <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
              ) : (
                <FileText className="h-4 w-4 text-green-600 flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-sm truncate">
                  {isDocumentArtifact(displayedArtifact) 
                    ? displayedArtifact.data.documentField.documentMetadata?.title || displayedArtifact.data.documentField.name
                    : isFileArtifact(displayedArtifact)
                    ? displayedArtifact.data.fileField.name
                    : 'Artifact'
                  }
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isDocumentArtifact(displayedArtifact) ? 'Document' : 'File'}
                </p>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCanvas}
              className="h-7 w-7 p-0 flex-shrink-0"
              title="Close canvas"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          {/* Custom Artifact Content */}
          <div className="flex-1 overflow-auto p-4">
            {isDocumentArtifact(displayedArtifact) ? (
              <DocumentArtifactViewer 
                artifact={displayedArtifact}
                className="h-full"
              />
            ) : isFileArtifact(displayedArtifact) ? (
              <FileArtifactViewer 
                artifact={displayedArtifact}
                className="h-full"
              />
            ) : null}
          </div>
        </div>
    ) : (
      <div className="flex-1 border-l border-border flex flex-col bg-card">
        {/* Canvas Header with Artifact Info */}
        <div className="flex items-center justify-between p-3 border-b border-border bg-muted/10">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {displayedArtifact.type === 'code' ? (
              <Code className="h-4 w-4 text-primary flex-shrink-0" />
            ) : (
              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm truncate">
                {(displayedArtifact as any).title || 
                 (displayedArtifact.type === 'code' ? 'Code Editor' : 'Document')}
              </h3>
              {displayedArtifact.type === 'code' && (displayedArtifact.data as any)?.language && (
                <p className="text-xs text-muted-foreground">
                  {(displayedArtifact.data as any).language}
                </p>
              )}
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCanvas}
            className="h-7 w-7 p-0 flex-shrink-0"
            title="Close canvas"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* LlamaIndex Canvas Content */}
        <div className="flex-1 overflow-hidden">
          <LlamaIndexChatCanvas className="h-full w-full border-0" />
        </div>
      </div>
    )
    
    // Use portal if should be shown as main content
    if (shouldShowChatCanvas && portalElement) {
      return createPortal(canvasContent, portalElement)
    }
    
    // Otherwise render normally in chat panel
    return canvasContent
    
  } catch (error) {
    // Fallback: If useChatCanvas fails, render basic canvas
    // This prevents the "must be used within ChatCanvasProvider" error
    console.warn('[ChatCanvas] useChatCanvas hook not available, using fallback:', error)
    
    // If should show as main content but no context, don't render
    if (shouldShowChatCanvas) {
      return null
    }
    
    return (
      <div className="flex-1 border-l border-border">
        <LlamaIndexChatCanvas className="h-full w-full" />
      </div>
    )
  }
}