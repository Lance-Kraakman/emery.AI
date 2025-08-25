import React, { Suspense } from 'react'
import { EmerySidebar } from '@/components/EmerySidebar'
import { Loading } from '@/components/ui/loading'
import { EmeryChat } from '@/components/chat/EmeryChat'
import { useLayout } from './LayoutProvider'
import type { EmeryLayoutProps, ChatContextConfig } from './types'

/**
 * EmeryLayout - Core layout component with canvas expansion logic
 * 
 * Layout modes based on canvas state:
 * - Canvas Expanded: 3-panel (sidebar | canvas | chat)
 * - Canvas Collapsed: 2-panel (sidebar | chat-as-main)
 * 
 * The main content area becomes a canvas object that can be collapsed,
 * allowing the chat to expand to fill the main view area.
 * 
 * AIDEV-NOTE: This implements the canvas expansion logic where chat can
 * become the main view when canvas is collapsed, like current mission-control.
 */

interface EmeryLayoutInnerProps extends EmeryLayoutProps {
  // This component needs layout context, so it must be wrapped by LayoutProvider
}

function EmeryLayoutInner({ 
  children, 
  chatContext,
  enableChat = true 
}: EmeryLayoutInnerProps) {
  const {
    sidebarState,
    chatState,
    canvasState,
    isMobile,
    breakpoint,
    setChatContext,
    setSidebarState,
    setChatState
  } = useLayout()

  // Set chat context when provided
  React.useEffect(() => {
    if (chatContext) {
      setChatContext(chatContext)
    }
  }, [chatContext, setChatContext])

  // Calculate responsive classes and layout mode
  const sidebarWidth = getSidebarWidth(sidebarState, isMobile)
  const showSidebarOverlay = isMobile && sidebarState === 'expanded'
  
  // Determine layout mode based on canvas state
  const isCanvasMode = canvasState === 'expanded'
  const isChatMainMode = canvasState === 'collapsed'

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile Overlay for Sidebar */}
      {showSidebarOverlay && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarState('collapsed')}
        />
      )}

      {/* Left Panel - Sidebar */}
      <aside 
        className={`
          ${sidebarWidth}
          ${isMobile ? 'fixed left-0 top-0 h-full z-30 transform transition-transform duration-300' : ''}
          ${isMobile && sidebarState === 'collapsed' ? '-translate-x-full' : 'translate-x-0'}
          bg-card border-r border-border
        `}
      >
        <Suspense fallback={<SidebarSkeleton />}>
          <EmerySidebar />
        </Suspense>
      </aside>

      {/* Main Content Area - Layout changes based on canvas state */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Canvas Mode: Traditional 3-panel (sidebar | canvas | chat) */}
        {isCanvasMode && (
          <>
            {/* Center Panel - Canvas/Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden min-w-0">
              {children}
            </main>

            {/* Right Panel - Chat Interface */}
            {enableChat && chatState !== 'hidden' && (
              <div className={`${getChatWidth(chatState)} ${isMobile ? 'hidden' : 'block'}`}>
                <Suspense fallback={<ChatSkeleton />}>
                  <EmeryChat />
                </Suspense>
              </div>
            )}
          </>
        )}
        
        {/* Chat Main Mode: 2-panel (sidebar | chat-as-main) */}
        {isChatMainMode && enableChat && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <Suspense fallback={<ChatSkeleton />}>
              <EmeryChat />
            </Suspense>
          </div>
        )}
        
        {/* Fallback: Show main content if chat disabled */}
        {isChatMainMode && !enableChat && (
          <main className="flex-1 flex flex-col overflow-hidden min-w-0">
            {children}
          </main>
        )}
      </div>
      
      {/* Mobile Chat Overlay */}
      {isMobile && enableChat && chatState === 'expanded' && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-20"
            onClick={() => setChatState('collapsed')}
          />
          <div className="fixed right-0 top-0 h-full w-80 z-30 bg-card border-l border-border">
            <Suspense fallback={<ChatSkeleton />}>
              <EmeryChat />
            </Suspense>
          </div>
        </>
      )}
    </div>
  )
}

// Main exported component that ensures LayoutProvider is available
export function EmeryLayout(props: EmeryLayoutProps) {
  return (
    <EmeryLayoutInner {...props} />
  )
}

// Utility functions for responsive widths
function getSidebarWidth(state: string, isMobile: boolean): string {
  if (isMobile) {
    return 'w-64' // Fixed width on mobile (overlay)
  }
  
  switch (state) {
    case 'collapsed':
      return 'w-16'
    case 'expanded':
      return 'w-64'
    case 'hidden':
      return 'w-0'
    default:
      return 'w-64'
  }
}

// Utility function for chat width based on state
function getChatWidth(state: string): string {
  switch (state) {
    case 'collapsed':
      return 'w-12' // Just show minimal collapsed width
    case 'expanded':
      return 'w-96' // Full chat width
    case 'hidden':
      return 'w-0' // Hidden
    default:
      return 'w-96'
  }
}

// Loading skeletons
function SidebarSkeleton() {
  return (
    <div className="w-64 h-full bg-card border-r border-border animate-pulse">
      <div className="p-4 space-y-4">
        <div className="h-8 bg-muted rounded" />
        <div className="space-y-2">
          <div className="h-6 bg-muted rounded" />
          <div className="h-6 bg-muted rounded" />
          <div className="h-6 bg-muted rounded" />
        </div>
      </div>
    </div>
  )
}

function ChatSkeleton() {
  return (
    <div className="h-full bg-card border-l border-border animate-pulse">
      <div className="p-4 space-y-4">
        <div className="h-8 bg-muted rounded" />
        <div className="flex-1 space-y-2">
          <div className="h-16 bg-muted rounded" />
          <div className="h-16 bg-muted rounded" />
          <div className="h-16 bg-muted rounded" />
        </div>
        <div className="h-10 bg-muted rounded" />
      </div>
    </div>
  )
}

// Removed duplicate React import