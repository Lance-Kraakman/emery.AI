'use client'

import React from 'react'
import { useChatCanvas, ChatCanvas as LlamaIndexChatCanvas } from '@llamaindex/chat-ui'
import { X, Code, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DocumentArtifactViewer, FileArtifactViewer } from './artifacts'
import {
  isDocumentArtifact,
  isFileArtifact,
  isEmeryArtifact
} from './types/chat-artifacts'

/**
 * CanvasOverlay - Overlays canvas over main content when artifact is displayed
 *
 * This component reads artifact state from ChatCanvas context (via useChatCanvas hook)
 * and renders an overlay when an artifact is open. It handles both:
 * - Custom Emery artifacts (emery-document, emery-file) with custom viewers
 * - Standard LlamaIndex artifacts (code, document) with ChatCanvas
 *
 * AIDEV-NOTE: This component must be used inside ChatSection/ChatCanvasProvider.
 * It replaces the previous EmeryCanvas component which used global UI state.
 */
export function CanvasOverlay() {
  const { displayedArtifact, closeCanvas } = useChatCanvas()

  // Don't render overlay if no artifact is displayed
  if (!displayedArtifact) {
    return null
  }

  // Check if this is a custom Emery artifact
  if (isEmeryArtifact(displayedArtifact)) {
    return (
      <div className="absolute inset-0 bg-card z-10">
        <div className="h-full border-l border-border flex flex-col bg-card">
          {/* Custom Artifact Content - Document artifacts handle their own headers */}
          {isDocumentArtifact(displayedArtifact) ? (
            <DocumentArtifactViewer
              key={`doc-${displayedArtifact.data.documentField.id}-${displayedArtifact.data.tableId}-${displayedArtifact.data.fieldId}`}
              artifact={displayedArtifact}
              onClose={closeCanvas}
              className="h-full"
            />
          ) : isFileArtifact(displayedArtifact) ? (
            <>
              {/* Header for file artifacts */}
              <div className="flex items-center justify-between p-3 border-b border-border bg-muted/10">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileText className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm truncate">
                      {displayedArtifact.data.fileField.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">File</p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeCanvas}
                  className="h-7 w-7 p-0 flex-shrink-0"
                  title="Close canvas"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

              {/* Content for file artifacts */}
              <div className="flex-1 overflow-auto p-4">
                <FileArtifactViewer
                  artifact={displayedArtifact}
                  className="h-full"
                />
              </div>
            </>
          ) : null}
        </div>
      </div>
    )
  }

  // Handle standard LlamaIndex artifacts (code, document, etc.)
  return (
    <div className="absolute inset-0 bg-card z-10">
      <div className="h-full border-l border-border flex flex-col bg-card">
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
            onClick={closeCanvas}
            className="h-7 w-7 p-0 flex-shrink-0"
            title="Close canvas"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Use LlamaIndex ChatCanvas for standard artifacts */}
        <div className="flex-1 overflow-hidden">
          <LlamaIndexChatCanvas className="h-full w-full border-0" />
        </div>
      </div>
    </div>
  )
}
