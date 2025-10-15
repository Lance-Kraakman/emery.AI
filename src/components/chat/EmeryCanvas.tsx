'use client'

import React from 'react'
import { ChatCanvas as LlamaIndexChatCanvas } from '@llamaindex/chat-ui'
import { X, Code, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DocumentArtifactViewer, FileArtifactViewer } from './artifacts'
import {
  isDocumentArtifact,
  isFileArtifact,
  isEmeryArtifact
} from './types/chat-artifacts'
import { useStore } from '@tanstack/react-store'
import { uiStateStore, uiStateSelectors, uiStateActions } from '@/stores/ui-state.store'

/**
 * EmeryCanvas - Standalone canvas component using global UI state
 *
 * Unlike ChatCanvas, this component does NOT require ChatCanvasProvider.
 * It reads artifact state directly from the global UI state store,
 * allowing artifacts to be opened from anywhere in the app (including table cells).
 *
 * AIDEV-NOTE: This replaces ChatCanvas for use in EmeryLayout's MainContentWithCanvas.
 * The ChatCanvas component is still used inside ChatSection for LlamaIndex-generated artifacts.
 */

export function EmeryCanvas() {
  // Read artifact directly from UI state (no ChatCanvasProvider needed)
  const displayedArtifact = useStore(uiStateStore, uiStateSelectors.displayedArtifact)

  // Close handler
  const handleClose = () => {
    uiStateActions.closeArtifact()
  }

  // Don't render if no artifact
  if (!displayedArtifact) {
    return null
  }

  // Check if this is a custom Emery artifact
  if (isEmeryArtifact(displayedArtifact)) {
    return (
      <div className="h-full border-l border-border flex flex-col bg-card">
        {/* Custom Artifact Content - Document artifacts handle their own headers */}
        {isDocumentArtifact(displayedArtifact) ? (
          <DocumentArtifactViewer
            key={`doc-${displayedArtifact.data.documentField.id}-${displayedArtifact.data.tableId}-${displayedArtifact.data.fieldId}`}
            artifact={displayedArtifact}
            onClose={handleClose}
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
                onClick={handleClose}
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
    )
  }

  // Handle standard LlamaIndex artifacts (code, document, etc.)
  return (
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
          onClick={handleClose}
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
  )
}
