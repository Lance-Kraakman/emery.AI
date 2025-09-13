'use client'

import { useEffect } from 'react'
import { useChatCanvas } from '@llamaindex/chat-ui'
import { useArtifact } from '@/contexts/ArtifactContext'

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
  const { setShouldShowChatCanvas } = useArtifact()

  useEffect(() => {
    if (selectedArtifact && canvasContext?.openArtifactInCanvas) {
      console.log('[CANVAS-ARTIFACT-HANDLER] Opening artifact in canvas:', selectedArtifact)
      try {
        canvasContext.openArtifactInCanvas(selectedArtifact)
        onArtifactHandled() // Clear the selectedArtifact
        
        // Signal that the ChatCanvas should be shown as main content
        setShouldShowChatCanvas(true)
      } catch (error) {
        console.error('[CANVAS-ARTIFACT-HANDLER] Error opening artifact in canvas:', error)
        onArtifactHandled() // Clear anyway to prevent infinite loop
      }
    }
  }, [selectedArtifact, canvasContext, onArtifactHandled, setShouldShowChatCanvas])

  // Monitor canvas state to update our context
  useEffect(() => {
    if (canvasContext) {
      // If canvas is closed or no artifact is displayed, hide ChatCanvas from main content
      const hasDisplayedArtifact = Boolean(canvasContext.displayedArtifact && canvasContext.isCanvasOpen)
      setShouldShowChatCanvas(hasDisplayedArtifact)
    }
  }, [canvasContext?.displayedArtifact, canvasContext?.isCanvasOpen, setShouldShowChatCanvas])

  // This component doesn't render anything
  return null
}