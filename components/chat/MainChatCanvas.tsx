'use client'

import { useArtifact } from '@/contexts/ArtifactContext'

/**
 * MainChatCanvas - Portal for ChatCanvas as main content when artifact is displayed
 * 
 * This component acts as a placeholder/portal for the ChatCanvas that's actually 
 * rendered inside the ChatSection context. The actual ChatCanvas rendering is 
 * coordinated via the ArtifactContext.
 * 
 * AIDEV-NOTE: This enables the sidebar | chat-canvas | chat layout by serving as
 * the main content area when artifacts should be displayed.
 */

export function MainChatCanvas() {
  const { shouldShowChatCanvas } = useArtifact()

  // Only render when we should show the ChatCanvas as main content
  if (!shouldShowChatCanvas) {
    return null
  }

  // This is a portal/placeholder - the actual ChatCanvas is rendered by the 
  // ChatSection but positioned here via CSS or portal techniques
  return (
    <div id="chat-canvas-portal" className="h-full flex flex-col bg-card">
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Chat Canvas will appear here...
      </div>
    </div>
  )
}