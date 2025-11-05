'use client'

import React, { Suspense, useEffect } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { Loading } from '@/components/ui/loading'
import { EmeryCanvas } from '@/components/chat/EmeryCanvas'
import { EmeryChat } from '@/components/chat/EmeryChat'
import { useStore } from '@tanstack/react-store'
import { uiStateStore, uiStateSelectors, uiStateActions } from '@/stores/ui-state.store'
import type { EmeryLayoutProps, ChatContextConfig} from './types'
import { ChatProvider, useChatHandler } from '@/components/chat/ChatProvider'
import { ChatSection, useChatCanvas } from '@llamaindex/chat-ui'

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

interface SidebarData {
  apps: any[]
  agents: any[]
  teams: any[]
  skills: any[]
  databases: any[]
}

interface EmeryLayoutInnerProps extends EmeryLayoutProps {
  // This component needs layout context, so it must be wrapped by LayoutProvider
  sidebarData?: SidebarData
}


function EmeryLayoutInner({
  children,
  chatContext,
  enableChat = true,
  sidebarData
}: EmeryLayoutInnerProps) {
  // AIDEV-NOTE: Use fine-grained store subscriptions to prevent re-renders when unrelated state changes
  const sidebarState = useStore(uiStateStore, uiStateSelectors.sidebarState)
  const chatState = useStore(uiStateStore, uiStateSelectors.chatState)
  const isMobile = useStore(uiStateStore, uiStateSelectors.isMobile)
  const setChatContext = uiStateActions.setChatContext
  const setSidebarState = uiStateActions.setSidebarState
  const setChatState = uiStateActions.setChatState

  // Set chat context when provided
  React.useEffect(() => {
    if (chatContext) {
      setChatContext(chatContext)
    }
  }, [setChatContext]) // AIDEV-NOTE: Removed chatContext to prevent infinite re-render loop

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-transparent">
        {/* Sidebar - now receives server-fetched data */}
        <Suspense fallback={<SidebarSkeleton />}>
          <AppSidebar
            apps={sidebarData?.apps || []}
            agents={sidebarData?.agents || []}
            teams={sidebarData?.teams || []}
            skills={sidebarData?.skills || []}
            databases={sidebarData?.databases || []}
          />
        </Suspense>

        {/* Main Content Area + Chat - wrapped in ChatProvider for canvas context */}
        <SidebarInset className="flex-1 flex min-h-0 overflow-hidden">
          {enableChat ? (
            <ChatProvider chatContext={chatContext}>
              <Suspense fallback={<div className="flex-1 flex min-h-0 overflow-hidden"><ChatSkeleton /></div>}>
                <EmeryLayoutWithChat>{children}</EmeryLayoutWithChat>
              </Suspense>
            </ChatProvider>
          ) : (
            <div className="flex-1 flex min-h-0 overflow-hidden">
              <main className="flex-1 overflow-x-hidden min-h-0">
                {children || (
                  <div className="h-full flex items-center justify-center p-6">
                    <div className="text-center text-muted-foreground">
                      <p>Select a page from the sidebar to get started</p>
                    </div>
                  </div>
                )}
              </main>
            </div>
          )}
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

// Component that has access to ChatProvider context
function EmeryLayoutWithChat({ children }: { children: React.ReactNode }) {
  const handler = useChatHandler()
  const displayedArtifact = useStore(uiStateStore, uiStateSelectors.displayedArtifact)

  return (
    <ChatSection
      handler={handler}
      className="flex-1 flex min-h-0 overflow-hidden"
      autoOpenCanvas={false}
    >
      <EmeryLayoutContent displayedArtifact={displayedArtifact}>
        {children}
      </EmeryLayoutContent>
    </ChatSection>
  )
}

// Inner component with canvas bridge logic
function EmeryLayoutContent({
  children,
  displayedArtifact
}: {
  children: React.ReactNode
  displayedArtifact: any
}) {
  const { openArtifactInCanvas, displayedArtifact: canvasArtifact } = useChatCanvas()

  // AIDEV-NOTE: Bridge global UI state artifacts to ChatCanvas context
  // This allows table cell clicks (which set global state) to open artifacts in ChatCanvas
  useEffect(() => {
    if (displayedArtifact) {
      console.log('[EMERY-LAYOUT] Bridge: Opening artifact from global state in ChatCanvas:', displayedArtifact)
      openArtifactInCanvas(displayedArtifact)
      // Clear global state after bridging to ChatCanvas
      uiStateActions.closeArtifact()
    }
  }, [displayedArtifact, openArtifactInCanvas])

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* Show Canvas on LHS when artifact is open, otherwise show Main Content */}
      {canvasArtifact ? (
        <div className="flex-1 overflow-x-hidden min-h-0">
          <EmeryCanvas />
        </div>
      ) : (
        <main className="flex-1 overflow-x-hidden min-h-0">
          {children || (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center text-muted-foreground">
                <p>Select a page from the sidebar to get started</p>
              </div>
            </div>
          )}
        </main>
      )}

      {/* Chat Area - EmeryChat controls its own width based on chatState */}
      <Suspense fallback={<ChatSkeleton />}>
        <EmeryChat />
      </Suspense>
    </div>
  )
}

// Main exported component that ensures LayoutProvider is available
export function EmeryLayout(props: EmeryLayoutInnerProps) {
  return (
    <EmeryLayoutInner {...props} />
  )
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