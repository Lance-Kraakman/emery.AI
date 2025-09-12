'use client'

import { useLayout } from '@/components/layout/LayoutProvider'
import { BaseCanvas } from './BaseCanvas'
import { FileText, MessageCircle } from 'lucide-react'
import { FileViewerCanvas } from './FileViewerCanvas'
import { DocumentCanvas } from './DocumentCanvas'

/**
 * CanvasRenderer - Central canvas type switching component
 * 
 * This component handles switching between different canvas types:
 * - 'chat': Renders chat-focused content (handled by EmeryChat)
 * - 'document': Renders document editing canvas
 * - 'file-viewer': Renders file viewing canvas with LlamaIndex integration
 * 
 * AIDEV-NOTE: This replaces the main content area when canvas is expanded,
 * allowing different canvas types to be rendered in the center panel.
 */

interface CanvasRendererProps {
  children?: React.ReactNode
  fallbackContent?: React.ReactNode
}

export function CanvasRenderer({ children, fallbackContent }: CanvasRendererProps) {
  const { canvasState, canvasType, documentContext, fileViewerContext } = useLayout()

  console.log('CanvasRenderer - canvasState:', canvasState, 'canvasType:', canvasType)

  // When canvas is collapsed, render the fallback content (usually page content)
  if (canvasState !== 'expanded') {
    console.log('Canvas collapsed, showing fallback content')
    return (
      <div className="h-full w-full">
        {fallbackContent || children}
      </div>
    )
  }

  // When canvas is expanded, render based on canvas type
  switch (canvasType) {
    case 'file-viewer':
      return <FileViewerCanvas />
      
    case 'document':
      return <DocumentCanvas />
      
    case 'chat':
      // Chat canvas is handled by EmeryChat component, so we show a placeholder here
      // or redirect to the chat main mode
      return (
        <BaseCanvas
          title="Chat Canvas"
          icon={<MessageCircle className="h-5 w-5" />}
        >
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
              <MessageCircle className="h-16 w-16 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Chat Mode</h3>
              <p className="text-sm text-muted-foreground">
                Chat canvas content is managed by the chat component
              </p>
            </div>
          </div>
        </BaseCanvas>
      )
      
    default:
      // Fallback for unknown canvas types
      return (
        <div className="h-full w-full">
          {children || (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8">
                <h3 className="text-lg font-medium mb-2">Unknown Canvas Type</h3>
                <p className="text-sm text-muted-foreground">
                  Canvas type "{canvasType}" is not supported
                </p>
              </div>
            </div>
          )}
        </div>
      )
  }
}