'use client'

import React from 'react'
import {
  ChatCanvas,
} from '@llamaindex/chat-ui'
import { X, Code, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DocumentArtifactViewer, FileArtifactViewer } from './artifacts'
import {
  isDocumentArtifact,
  isFileArtifact,
  isEmeryArtifact,
  type DocumentArtifact,
  type FileArtifact
} from './types/chat-artifacts'

/**
 * EmeryCanvas - Custom Canvas with Emery-specific artifact viewers
 *
 * This component wraps LlamaIndex's ChatCanvas and adds custom renderers
 * for Emery document and file artifacts while maintaining support for
 * standard artifacts (code, etc.).
 *
 * AIDEV-NOTE: Must be used inside ChatSection context. For LHS positioning,
 * the parent container (EmeryLayout) handles CSS positioning.
 */

// Custom renderer for Document artifacts
function DocumentArtifactRenderer() {
  const renderFn = ({ artifact, closeCanvas }: { artifact: any; closeCanvas: () => void }) => {
    if (!isDocumentArtifact(artifact)) return null

    return (
      <DocumentArtifactViewer
        key={`doc-${artifact.data.documentField.id}-${artifact.data.tableId}-${artifact.data.fieldId}`}
        artifact={artifact as DocumentArtifact}
        onClose={closeCanvas}
        className="h-full"
      />
    )
  }

  return (
    <ChatCanvas.DocumentArtifact>
      {renderFn as any}
    </ChatCanvas.DocumentArtifact>
  )
}

// Custom renderer for File artifacts (using document type as workaround)
function FileArtifactRenderer() {
  const renderFn = ({ artifact, closeCanvas }: { artifact: any; closeCanvas: () => void }) => {
    if (!isFileArtifact(artifact)) return null

    return (
      <div className="h-full flex flex-col">
        {/* Header for file artifacts */}
        <div className="flex items-center justify-between p-3 border-b border-border bg-muted/10">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileText className="h-4 w-4 text-green-600 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm truncate">
                {artifact.data.fileField.name}
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
            artifact={artifact as FileArtifact}
            className="h-full"
          />
        </div>
      </div>
    )
  }

  return (
    <ChatCanvas.DocumentArtifact>
      {renderFn as any}
    </ChatCanvas.DocumentArtifact>
  )
}

export function EmeryCanvas() {
  return (
    <div className="h-full flex flex-col bg-card">
      <ChatCanvas className="h-full w-full border-0">
        {/* Custom Emery artifact renderers */}
        <DocumentArtifactRenderer />
        <FileArtifactRenderer />

        {/* Standard LlamaIndex artifact renderers */}
        <ChatCanvas.CodeArtifact />

        {/* Canvas actions */}
        <ChatCanvas.Actions>
          <div className="flex gap-2">
            <ChatCanvas.Actions.Close />
            <ChatCanvas.Actions.Download />
            <ChatCanvas.Actions.Copy />
          </div>
        </ChatCanvas.Actions>
      </ChatCanvas>
    </div>
  )
}
