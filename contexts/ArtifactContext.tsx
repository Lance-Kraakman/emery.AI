'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

/**
 * ArtifactContext - Shared context for managing chat artifacts across the app
 * 
 * This context allows coordination between the chat section and the main layout
 * to display artifacts as the main content when needed.
 * 
 * AIDEV-NOTE: This enables the sidebar | chat-canvas | chat layout by providing
 * a way for the layout to know when to show ChatCanvas as the main content.
 */

interface ArtifactContextType {
  shouldShowChatCanvas: boolean
  setShouldShowChatCanvas: (show: boolean) => void
}

const ArtifactContext = createContext<ArtifactContextType | undefined>(undefined)

export function useArtifact(): ArtifactContextType {
  const context = useContext(ArtifactContext)
  if (!context) {
    throw new Error('useArtifact must be used within an ArtifactProvider')
  }
  return context
}

interface ArtifactProviderProps {
  children: ReactNode
}

export function ArtifactProvider({ children }: ArtifactProviderProps) {
  const [shouldShowChatCanvas, setShouldShowChatCanvas] = useState(false)

  const contextValue: ArtifactContextType = {
    shouldShowChatCanvas,
    setShouldShowChatCanvas
  }

  return (
    <ArtifactContext.Provider value={contextValue}>
      {children}
    </ArtifactContext.Provider>
  )
}