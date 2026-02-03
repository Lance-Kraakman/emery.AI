'use client'

import React from 'react'
import {
  ChatCanvas,
  useChatCanvas
} from '@llamaindex/chat-ui'
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
 * type filtering that would reject custom artifact types like 'enhancd-document'.
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

  return (
    <FileArtifactViewer
      artifact={displayedArtifact as FileArtifact}
      onClose={closeCanvas}
      className="h-full"
    />
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
      </ChatCanvas>
    </div>
  )
}
