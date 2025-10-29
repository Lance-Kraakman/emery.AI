'use client'

import React, { Suspense } from 'react'
import { AppSidebarClient } from '@/components/app-sidebar-client'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { Loading } from '@/components/ui/loading'
import { EmeryCanvas } from '@/components/chat/EmeryCanvas'
import { EmeryChat } from '@/components/chat/EmeryChat'
import { useStore } from '@tanstack/react-store'
import { uiStateStore, uiStateSelectors, uiStateActions } from '@/stores/ui-state.store'
import type { EmeryLayoutProps, ChatContextConfig} from './types'
import { ChatProvider } from '@/components/chat/ChatProvider'

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
  // AIDEV-NOTE: Use fine-grained store subscriptions to prevent re-renders when unrelated state changes
  const sidebarState = useStore(uiStateStore, uiStateSelectors.sidebarState)
  const chatState = useStore(uiStateStore, uiStateSelectors.chatState)
  const isMobile = useStore(uiStateStore, uiStateSelectors.isMobile)
  const displayedArtifact = useStore(uiStateStore, uiStateSelectors.displayedArtifact)
  const setChatContext = uiStateActions.setChatContext
  const setSidebarState = uiStateActions.setSidebarState
  const setChatState = uiStateActions.setChatState

  // Set chat context when provided
  React.useEffect(() => {
    if (chatContext) {
      setChatContext(chatContext)
    }
  }, [setChatContext]) // AIDEV-NOTE: Removed chatContext to prevent infinite re-render loop

  // Component that conditionally renders canvas or main content
  // AIDEV-NOTE: Memoized to prevent re-renders when chat messages update
  // Now reads artifact from TanStack store and uses EmeryCanvas (no ChatCanvasProvider needed)
  const MainContentWithCanvas = React.memo(function MainContentWithCanvas({ children }: { children: React.ReactNode }) {
    // Show canvas when artifact is displayed, otherwise show children
    return displayedArtifact ? <div className="h-full"><EmeryCanvas /></div> : <>{children}</>
  })

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        {/* Sidebar */}
        <Suspense fallback={<SidebarSkeleton />}>
          <AppSidebarClient />
        </Suspense>

        {/* Main Content Area + Chat */}
        <SidebarInset className="flex-1 flex min-h-0 overflow-hidden">
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

            {/* Chat Area - EmeryChat controls its own width based on chatState */}
            {enableChat && (
              <ChatProvider chatContext={chatContext}>
                <Suspense fallback={<ChatSkeleton />}>
                  <EmeryChat />
                </Suspense>
              </ChatProvider>
            )}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
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

// Loading skeletons
function SidebarSkeleton() {
  return (
    <div className="w-64 h-full bg-card border-r border-border animate-pulse">
      <div>
        <div className="h-8 bg-muted rounded" />
        <div>
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
      <div >
        <div className="h-8 bg-muted rounded" />
        <div className="flex-1">
          <div className="h-16 bg-muted rounded" />
          <div className="h-16 bg-muted rounded" />
          <div className="h-16 bg-muted rounded" />
        </div>
        <div className="h-10 bg-muted rounded" />
      </div>
    </div>
  )
}