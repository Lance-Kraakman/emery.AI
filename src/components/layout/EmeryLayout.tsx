'use client'

import React, { Suspense } from 'react'
import { EmerySidebar } from '@/components/EmerySidebar'
import { Loading } from '@/components/ui/loading'
import { EmeryChat } from '@/components/chat/EmeryChat'
import { ChatSection, useChatCanvas } from '@llamaindex/chat-ui'
import { ChatCanvas } from '@/components/chat/ChatCanvas'
import { useLayout } from './LayoutProvider'
import type { EmeryLayoutProps, ChatContextConfig } from './types'
import { useChatGRPC } from '@/components/chat/useChatGRPC'

/** p p
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
    isMobile,
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

  // Create basic chat handler for canvas functionality in main content
  const canvasHandler = useChatGRPC({
    domainType: chatContext?.domainType,
    domainId: chatContext?.domainId,
    chatId: undefined
  })

  // Component that conditionally renders canvas or main content
  function MainContentWithCanvas({ children }: { children: React.ReactNode }) {
    const { displayedArtifact } = useChatCanvas()

    // Show canvas when artifact is displayed, otherwise show children
    return displayedArtifact ? <div className="h-full"><ChatCanvas /></div> : <>{children}</>
  }

  // Calculate responsive classes
  const sidebarWidth = getSidebarWidth(sidebarState, isMobile)
  const showSidebarOverlay = isMobile && sidebarState === 'expanded'

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
          h-screen
          ${sidebarWidth}
          ${isMobile ? 'fixed left-0 top-0 h-screen z-30 transform transition-transform duration-300' : ''}
          ${isMobile && sidebarState === 'collapsed' ? '-translate-x-full' : 'translate-x-0'}
          bg-card border-r border-border
        `}
      >
        <Suspense fallback={<SidebarSkeleton />}>
          <EmerySidebar />
        </Suspense>
      </aside>

      {/* Main Content Area + Chat - 3-panel layout wrapped in ChatSection */}
      <ChatSection
        handler={canvasHandler}
        className="flex-1 flex min-h-0 overflow-hidden h-screen"
        autoOpenCanvas={false}
      >
        <div className="flex-1 flex min-h-0 overflow-hidden h-screen">
          {/* Main Content Area with Canvas */}
          <main className="flex-1 overflow-y-auto h-full">
            <MainContentWithCanvas>
              {children || (
                <div className="h-full flex items-center justify-center p-6">
                  <div className="text-center text-muted-foreground">
                    <p>Select a page from the sidebar to get started</p>
                  </div>
                </div>
              )}
            </MainContentWithCanvas>
          </main>

          {/* Chat Area - always visible */}
          {enableChat && (
            <div className="w-96 border-l border-border">
              <Suspense fallback={<ChatSkeleton />}>
                <EmeryChat handler={canvasHandler} />
              </Suspense>
            </div>
          )}
        </div>
      </ChatSection>

      {/* Mobile Chat Overlay - Remove since EmeryChat handles everything */}
      {isMobile && enableChat && chatState === 'expanded' && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-20"
            onClick={() => setChatState('collapsed')}
          />
          <div className="fixed right-0 top-0 h-screen w-80 z-30 bg-card border-l border-border">
            <Suspense fallback={<ChatSkeleton />}>
              <EmeryChat handler={canvasHandler} />
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