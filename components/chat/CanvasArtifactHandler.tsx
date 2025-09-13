'use client'

import { useEffect } from 'react'
import { useChatCanvas } from '@llamaindex/chat-ui'

interface CanvasArtifactHandlerProps {
  selectedArtifact: any
  onArtifactHandled: () => void
}

/**
 * Helper component that has access to useChatCanvas hook
 * to programmatically open artifacts in the canvas
 */
export function CanvasArtifactHandler({ selectedArtifact, onArtifactHandled }: CanvasArtifactHandlerProps) {
  const canvasContext = useChatCanvas()

  useEffect(() => {
    if (selectedArtifact && canvasContext?.openArtifactInCanvas) {
      console.log('[CANVAS-ARTIFACT-HANDLER] Opening artifact in canvas:', selectedArtifact)
      try {
        canvasContext.openArtifactInCanvas(selectedArtifact)
        onArtifactHandled() // Clear the selectedArtifact
      } catch (error) {
        console.error('[CANVAS-ARTIFACT-HANDLER] Error opening artifact in canvas:', error)
        onArtifactHandled() // Clear anyway to prevent infinite loop
      }
    }
  }, [selectedArtifact, canvasContext, onArtifactHandled])

  // This component doesn't render anything
  return null
}