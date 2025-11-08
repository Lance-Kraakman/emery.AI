'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { generateId } from 'ai'
import {
  ChatMessages,
  ChatMessage,
  useChatCanvas,
} from '@llamaindex/chat-ui'
import { 
  ChevronLeft, 
  ChevronRight, 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useStore } from '@tanstack/react-store'
import { uiStateStore, uiStateSelectors, uiStateActions } from '@/stores/ui-state.store'
import { RightPanelResizeHandle } from '@/components/ui/right-panel-resize-handle'
// import { ChatCanvas } from './ChatCanvas'
import CustomChatInput from './CustomChatInput'
import { ChatHistoryDropdown } from './ChatHistoryDropdown'
import { createChatContextForPage, type ChatContextConfig } from '@/components/layout/types'
import type { DomainType } from '@/ddd/domain/shared/types/domain-type'
import { useEmery } from '@/contexts/EmeryStoreProvider'
import { ToolPanel } from './ToolPanel'
import { useChatHandler } from './ChatProvider'
import { ToolCategory } from '@/ddd/domain/tools/value-objects/tool-metadata'
import { createDocumentArtifact, createFileArtifact } from './types/chat-artifacts'
import { fetchFileArtifactData, getFileDownloadUrl, getDocumentFieldValue, getDocumentDownloadUrl } from '@/app/actions/artifacts'
import type { ToolDTO } from '@/app/mappers/tool-mapper'
import { StepProgressIndicator } from './StepProgressIndicator'
import { StepHistoryDisplay } from './StepHistoryDisplay'
import { createDebugLogger } from '@/lib/utils/debug-logger'
import type { ExecutionStep } from '@/app/dtos/chat.dto'
import type { ChatMessage as EmeryChatMessage } from './types/extended-chat-handler'

const logger = createDebugLogger('EmeryChat')

/**
 * EmeryChat - Main chat component with LlamaIndex integration
 * 
 * Features:
 * - "Emery" branding at the top
 * - LlamaIndex ChatSection with ChatMessages and ChatInput
 * - Canvas expand/collapse controls
 * - Context-aware suggestions based on page/domain
 * - Responsive behavior for mobile
 * 
 * AIDEV-NOTE: This replaces the placeholder chat component with full
 * LlamaIndex integration and domain-aware functionality.
 */

interface EmeryChatHeaderProps {
  domainType?: DomainType | 'organizations' | 'general'
  domainName?: string
  currentChatId?: string
  onChatSelect: (chatId: string) => void
  onNewChat: () => void
  onChatHistoryUpdate?: () => void
  userId: string
  organizationId: number
}

function EmeryChatHeader({ 
  domainType, 
  domainName, 
  currentChatId, 
  onChatSelect, 
  onNewChat, 
  onChatHistoryUpdate,
  userId,
  organizationId
}: EmeryChatHeaderProps) {
  // AIDEV-NOTE: Use fine-grained store subscriptions to prevent re-renders
  const chatState = useStore(uiStateStore, uiStateSelectors.chatState)
  const canvasState = useStore(uiStateStore, uiStateSelectors.canvasState)
  const toggleChat = uiStateActions.toggleChat
  const toggleCanvas = uiStateActions.toggleCanvas
  
  // Determine context subtitle based on domain
  const getSubtitle = () => {
    if (domainType && domainName) {
      switch (domainType) {
        case 'agents': return `Agent: ${domainName}`
        case 'teams': return `Team: ${domainName}`
        case 'tables': return `Table: ${domainName}`
        case 'files': return `File: ${domainName}`
        case 'organizations': return 'Organization Assistant'
        default: return 'AI Assistant'
      }
    }
    return 'AI Assistant'
  }

  return (
    <div className="flex items-center justify-between py-4 px-4 bg-muted/20">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Dash
            </h3>
            <ChatHistoryDropdown
              currentChatId={currentChatId}
              onChatSelect={onChatSelect}
              onNewChat={onNewChat}
              onChatHistoryUpdate={onChatHistoryUpdate}
              domainType={domainType}
              domainName={domainName}
              userId={userId}
              organizationId={organizationId}
            />
          </div>
          <p className="text-xs text-muted-foreground truncate">{getSubtitle()}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Canvas expand button (only when canvas collapsed) - points right > */}
        {canvasState === 'collapsed' && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCanvas}
            className="h-7 w-7"
            title="Expand canvas"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
        
        {/* Chat collapse button (only show when expanded) - points right > */}
        {chatState === 'expanded' && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleChat}
            className="h-7 w-7"
            title="Collapse chat"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
        
        {/* Chat expand button (only show when collapsed) - points left < */}
        {chatState === 'collapsed' && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleChat}
            className="h-7 w-7"
            title="Expand chat"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

// Component that can access useChatCanvas hook inside ChatSection
interface ChatContentWithCanvasProps {
  selectedTools: ToolDTO[]
  onToolsChange: (tools: ToolDTO[]) => void
  onAddTool: () => void
  onRemoveTool: (tool: ToolDTO) => void
  isClient: boolean
  handler: ReturnType<typeof useChatHandler>
  chatContext: ChatContextConfig | undefined
}

function ChatContentWithCanvas({
  selectedTools,
  onToolsChange,
  onAddTool,
  onRemoveTool,
  handler,
}: ChatContentWithCanvasProps) {
  // AIDEV-NOTE: useChatCanvas must be called at component level, not inside handlers
  const { openArtifactInCanvas } = useChatCanvas()

  // Handle tool click using global UI state for artifacts
  const handleToolClick = async (tool: ToolDTO) => {
    logger.debug('Tool clicked', { tool: tool.name, category: tool.category })

    // Only handle reference tools for artifact opening (check via category or insertText pattern)
    if (!tool.insertText?.includes('@') || tool.insertText?.startsWith('@tool:')) {
      logger.debug('System tool clicked', { tool: tool.name })
      return
    }

    if (tool.category === ToolCategory.DOCUMENTS) {
      // Fetch real document data using server action
      // Note: Runtime values are now in ToolDTO root level, not in config
      const result = await getDocumentFieldValue(
        tool.documentId!,
        tool.organizationId!,
        tool.tableId as number,
        tool.fieldId!
      )

      if (result.success && result.data) {
        // Get download URL for the document
        const urlResult = await getDocumentDownloadUrl(
          tool.documentId!,
          tool.organizationId!,
          tool.tableId as number,
          tool.fieldId!
        )

        const downloadUrl = urlResult.success ? urlResult.data! : undefined

        // Create artifact and open in canvas using LlamaIndex ChatCanvas
        const artifact = createDocumentArtifact(
          result.data,
          tool.organizationId!,
          tool.tableId as number,
          tool.fieldId!,
          'view',
          downloadUrl
        )
        // Open the artifact in canvas using hook from component level
        openArtifactInCanvas(artifact)
        logger.debug('Document artifact opened', { documentId: tool.documentId, tableId: tool.tableId })
      } else {
        logger.error('Failed to fetch document data', result.error)
      }
    } else if (tool.category === ToolCategory.FILES) {
      // Fetch real file data using DTO runtime values
      const fileResult = await fetchFileArtifactData(
        tool.fileId!,
        tool.organizationId!,
        tool.filename!,
        tool.mimeType!
      )

      if (fileResult.success && fileResult.data) {
        // Get download URL for the file
        const urlResult = await getFileDownloadUrl(
          tool.fileId!,
          tool.organizationId!
        )

        const downloadUrl = urlResult.success ? urlResult.data! : ''

        // Create artifact and open in canvas using LlamaIndex ChatCanvas
        const artifact = createFileArtifact(fileResult.data, 1, 1, 'generic', downloadUrl)
        openArtifactInCanvas(artifact)
        logger.debug('File artifact opened', { fileId: tool.fileId, filename: tool.filename })
      } else {
        logger.error('Failed to fetch file data', fileResult.error)
      }
    }
    // Other tool types have different behaviors (agents, tables, databases)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Messages and suggestions container - scrollable */}
      <div ref={handler.scrollRef} className="flex-1 overflow-y-auto flex flex-col">
        {/* Messages area */}
        <div className="flex-1">
          {/* Debug: Show message count */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-gray-500 py-2">
              Messages: {handler.messages?.length || 0}
            </div>
          )}

          {/* ChatMessages component with inline loading indicator */}
          <ChatMessages className="flex-1 h-full bg-transparent">
            <ChatMessages.List>
              {/* Render all messages using library's ChatMessage component */}
              {handler.messages.map((message: EmeryChatMessage, index) => {
                // Extract execution steps from message metadata
                const steps = message.experimental_metadata?.executionSteps

                return (
                  <React.Fragment key={message.id || index}>
                    {/* Show step history for assistant messages with steps - BEFORE the message */}
                    {message.role === 'assistant' && steps && steps.length > 0 && (
                      <div className="mx-4 mb-1">
                        <StepHistoryDisplay steps={steps} />
                      </div>
                    )}
                    <ChatMessage
                      message={message}
                      isLast={index === handler.messages.length - 1}
                      className={cn(
                        "px-4 py-2 rounded-lg my-1 mx-4 transition-colors",
                        message.role === 'user' && "bg-primary text-primary-foreground",
                        message.role === 'assistant' && "bg-muted"
                      )}
                    >
                      <ChatMessage.Avatar />
                      <ChatMessage.Content className="[&_p]:text-sm [&_p]:leading-snug [&_p]:my-0.5" />
                      <ChatMessage.Actions />
                    </ChatMessage>
                  </React.Fragment>
                )
              })}

              {/* Real-time streaming steps - display accumulated steps during execution */}
              {handler.isLoading && handler.streamingSteps && handler.streamingSteps.length > 0 && (
                <div className="mx-4 mb-1">
                  <StepHistoryDisplay steps={handler.streamingSteps} />
                </div>
              )}

              {/* Inline loading indicator - appears after last message (Claude-like) */}
              {handler.isLoading && handler.currentStep && (
                <div className="flex gap-3 px-4 py-1 mx-4 mb-1">
                  {/* Bot Avatar */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  {/* Step Progress */}
                  <div className="flex-1 min-w-0">
                    <StepProgressIndicator
                      currentStep={handler.currentStep}
                      isLoading={handler.isLoading}
                      onCancel={handler.cancelMessage}
                    />
                  </div>
                </div>
              )}

              {/* Empty state when no messages */}
              <ChatMessages.Empty />
            </ChatMessages.List>
          </ChatMessages>
        </div>
      </div>

      {/* Tool Panel - with direct canvas access */}
      <ToolPanel
        tools={selectedTools}
        onToolClick={handleToolClick}
        onAddTool={onAddTool}
        onRemoveTool={onRemoveTool}
        className="border-t border-border/10"
      />

      {/* Input area */}
      <div className="flex-shrink-0 py-2 px-3 border-t border-border/10 bg-card">
        <CustomChatInput
          onSendMessage={async (message) => {
            // Send message with proper MessagePart format
            handler.append({
              role: 'user',
              parts: [{ type: 'text', text: message }],
              id: generateId() // Add id for type compatibility
            })
          }}
          onToolsChange={onToolsChange}
          placeholder="Ask Emery anything... (type @ to add tools, docs, agents, etc.)"
          pendingAttachments={handler.pendingAttachments}
          onAttachmentAdd={handler.addAttachment}
          onAttachmentRemove={handler.removeAttachment}
        />
      </div>
    </div>
  )
}


// AIDEV-NOTE: Handler now comes from ChatProvider context, not props
export function EmeryChat() {
  // ALL HOOKS MUST BE CALLED FIRST - NO CONDITIONAL RETURNS BEFORE THIS POINT
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: session } = useSession()

  // Get chat handler from context
  const handler = useChatHandler()

  // AIDEV-NOTE: Use fine-grained store subscriptions to prevent re-renders
  const chatState = useStore(uiStateStore, uiStateSelectors.chatState)
  const chatWidth = useStore(uiStateStore, uiStateSelectors.chatWidth)
  const canvasState = useStore(uiStateStore, uiStateSelectors.canvasState)
  const isMobile = useStore(uiStateStore, uiStateSelectors.isMobile)
  const chatContext = useStore(uiStateStore, uiStateSelectors.chatContext)
  const toggleCanvas = uiStateActions.toggleCanvas
  const setChatContext = uiStateActions.setChatContext
  const setChatWidth = uiStateActions.setChatWidth

  const { data: emeryData } = useEmery()

  // Chat session state
  const [currentChatId, setCurrentChatId] = useState<string | undefined>()
  const [isClient, setIsClient] = useState(false)

  // Tools state for @ tool selection
  const [selectedTools, setSelectedTools] = useState<ToolDTO[]>([])

  // Handle chat history updates (callback for forcing refresh)
  const handleChatHistoryUpdate = () => {
    // Trigger refresh of chat history dropdown
    if (typeof window !== 'undefined' && (window as any).refreshChatHistory) {
      (window as any).refreshChatHistory()
    }
  }

  // Handle chat created callback from useChatGRPC
  const handleChatCreated = (chatId: string) => {
    logger.summary('New chat created', { chatId })
    setCurrentChatId(chatId)
    // Trigger refresh of chat history dropdown
    handleChatHistoryUpdate()
  }

  // Handler is now passed as prop from layout - no local creation needed

  // Auto-detect page context if not already set
  useEffect(() => {
    if (!chatContext) {
      // Extract page name from pathname
      const pageName = pathname?.split('/')[1] || 'mission-control'

      // Extract domain ID from search params or pathname segments
      let domainId: number | undefined
      let domainName: string | undefined

      if (searchParams?.has('tableId')) {
        domainId = parseInt(searchParams?.get('tableId')!)
      } else if (searchParams?.has('agentId')) {
        domainId = parseInt(searchParams?.get('agentId')!)
      } else if (searchParams?.has('teamId')) {
        domainId = parseInt(searchParams?.get('teamId')!)
      } else {
        // Try to extract from URL segments like /agents/123
        const segments = pathname?.split('/').filter(Boolean) ?? []
        if (segments.length >= 2 && !isNaN(parseInt(segments[1]))) {
          domainId = parseInt(segments[1])
        }
      }

      logger.debug('Auto-detecting context', { pathname, pageName, domainId })

      // Create context based on detected page
      const detectedContext = createChatContextForPage(pageName, domainId, domainName)
      setChatContext(detectedContext)
    }
  }, [pathname, searchParams, setChatContext]) // AIDEV-NOTE: Removed chatContext to prevent infinite re-render loop

  // Update currentChatId when handler provides one
  useEffect(() => {
    if (handler.currentChatId && handler.currentChatId !== currentChatId) {
      setCurrentChatId(handler.currentChatId)
    }
  }, [handler.currentChatId, currentChatId])

  // Fix hydration by ensuring client-only rendering of dynamic content
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Don't render if hidden - return hidden div instead of null to avoid hook rule violations
  if (chatState === 'hidden') {
    return <div className="hidden" />
  }

  // Get user info for chat history
  const userId = useMemo(() => session?.user?.id, [session?.user?.id])
  const organizationId = useMemo(() => session?.user?.currentOrganizationId, [session?.user?.currentOrganizationId])

  // Don't render if user is not authenticated
  if (!userId || !organizationId) {
    return (
      <div className="w-96 h-full flex flex-col bg-card items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">Please sign in to use chat</p>
      </div>
    )
  }

  // Handle chat selection from history
  const handleChatSelect = async (chatId: string) => {
    if (handler.switchToChat) {
      await handler.switchToChat(chatId)
      setCurrentChatId(chatId)
    }
  }

  // Handle new chat creation
  const handleNewChat = async () => {
    if (handler.createNewChat) {
      await handler.createNewChat()
      setCurrentChatId(undefined)
    }
  }
  
  // Collapsed state - show minimal icon strip with dashlet logo
  if (chatState === 'collapsed') {
    return (
      <div className="w-12 h-full flex flex-col bg-card flex-shrink-0 items-center py-4 gap-4">
        {/* Dashlet logo */}
        <button
          onClick={() => uiStateActions.toggleChat()}
          className="flex items-center justify-center hover:opacity-80 transition-opacity"
          title="Expand chat"
        >
          <img
            src="/assets/dashlet/logo_icon.svg"
            alt="Dashlet"
            className="h-6 w-6"
          />
        </button>

        {/* Expand button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => uiStateActions.toggleChat()}
          className="h-8 w-8"
          title="Expand chat"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    )
  }


  // Handle tool changes from chat input
  const handleToolsChange = (tools: ToolDTO[]) => {
    setSelectedTools(tools)
  }


  // Handle adding tool via + button
  const handleAddTool = () => {
    // Focus the input and trigger @ character
    const inputElement = document.querySelector('input[placeholder*="Ask Emery"]') as HTMLInputElement
    if (inputElement) {
      inputElement.focus()
      // Simulate @ character input to trigger dropdown
      const event = new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '@' })
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      nativeInputValueSetter?.call(inputElement, inputElement.value + '@')
      inputElement.dispatchEvent(event)
    }
  }

  // Handle removing tool from panel - delegates to handler which also removes from input
  const handleRemoveTool = (toolToRemove: ToolDTO) => {
    handler.removeTool(toolToRemove)
    logger.debug('Tool removed via handler', { tool: toolToRemove.name })
  }

  // Determine layout based on canvas state
  const isFullWidth = canvasState === 'collapsed'

  return (
    <div
      className={`relative flex bg-card flex-shrink-0 h-full`}
      style={{
        width: isFullWidth ? '100%' : `${chatWidth}px`,
        // CSS-based responsive constraints (sidebar = 256px when expanded)
        maxWidth: 'calc((100vw - 256px) / 2)',  // 50% of available screen space
        minWidth: 'max(280px, calc((100vw - 256px) * 0.2))' // Larger of 280px or 20% of available space
      }}
    >
      {/* Resize handle */}
      {!isFullWidth && (
        <RightPanelResizeHandle
          onResize={setChatWidth}
        />
      )}

      {/* Chat Section - now full width without sidebar */}
      <div className={`flex flex-col w-full h-full`}>
        <EmeryChatHeader 
          domainType={chatContext?.domainType}
          domainName={chatContext?.domainName}
          currentChatId={currentChatId}
          onChatSelect={handleChatSelect}
          onNewChat={handleNewChat}
          onChatHistoryUpdate={handleChatHistoryUpdate}
          userId={userId}
          organizationId={organizationId}
        />
        
        {/* Chat content area - takes remaining height after header */}
        {/* AIDEV-NOTE: ChatSection is now in EmeryLayout, wrapping the entire app */}
        {/* This allows canvas to work across main content and chat areas */}
        <div className="flex-1 min-h-0 overflow-hidden" suppressHydrationWarning>
          <ChatContentWithCanvas
            selectedTools={selectedTools}
            onToolsChange={handleToolsChange}
            onAddTool={handleAddTool}
            onRemoveTool={handleRemoveTool}
            isClient={isClient}
            handler={handler}
            chatContext={chatContext}
          />
        </div>
      </div>
    </div>
  )
}