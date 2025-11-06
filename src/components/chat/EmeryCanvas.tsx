'use client'

import React from 'react'
import {
  ChatCanvas,
  useChatCanvas
} from '@llamaindex/chat-ui'
import { X, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DocumentArtifactViewer, FileArtifactViewer } from './artifacts'
import {
  isDocumentArtifact,
  isFileArtifact,
  type DocumentArtifact,
  type FileArtifact
} from './types/chat-artifacts'

/**
 * EmeryCanvas - Custom Canvas with Emery-specific artifact viewers
 *
 * This component wraps LlamaIndex's ChatCanvas and adds custom standalone
 * viewers for Emery document and file artifacts while maintaining support
 * for standard artifacts (code, etc.).
 *
 * AIDEV-NOTE: Custom viewers use useChatCanvas() directly as standalone
 * components rather than wrapping in ChatCanvas.DocumentArtifact to avoid
 * type filtering that would reject custom artifact types like 'emery-document'.
 */

// Standalone viewer for Emery Document artifacts
function EmeryDocumentViewer() {
  const { displayedArtifact, closeCanvas } = useChatCanvas()

  if (!displayedArtifact || !isDocumentArtifact(displayedArtifact)) {
    return null
  }

  return (
    <DocumentArtifactViewer
      key={`doc-${displayedArtifact.data.documentField.id}-${displayedArtifact.data.tableId}-${displayedArtifact.data.fieldId}`}
      artifact={displayedArtifact as DocumentArtifact}
      onClose={closeCanvas}
      className="h-full"
    />
  )
}

// Standalone viewer for Emery File artifacts
function EmeryFileViewer() {
  const { displayedArtifact, closeCanvas } = useChatCanvas()

  if (!displayedArtifact || !isFileArtifact(displayedArtifact)) {
    return null
  }

  const artifact = displayedArtifact as FileArtifact

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
          artifact={artifact}
          className="h-full"
        />
      </div>
    </div>
  )
}

export function EmeryCanvas() {
  return (
    <div className="h-full flex flex-col bg-card">
      <ChatCanvas className="h-full w-full border-0">
        {/* Custom Emery artifact viewers - standalone components */}
        <EmeryDocumentViewer />
        <EmeryFileViewer />

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
