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
  ChevronsLeft,
  ChevronsRight,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ModelSelector } from '@/components/ai/ModelSelector'
import { updateChatModel } from '@/app/actions/chat-history'
import { cn } from '@/lib/utils'
import { useStore } from '@tanstack/react-store'
import { uiStateStore, uiStateSelectors, uiStateActions } from '@/stores/ui-state.store'
import { useOrganizationPlan } from '@/stores/app-state.store'
// import { ChatCanvas } from './ChatCanvas'
import { UnifiedChatInput } from '@/components/shared/UnifiedChatInput'
import { ChatHistoryDropdown } from './ChatHistoryDropdown'
import { createChatContextForPage, type ChatContextConfig } from '@/components/layout/types'

import { useEmery } from '@/contexts/EmeryStoreProvider'
import { ToolPanel } from './ToolPanel'
import { useChatHandler } from './ChatProvider'
import { ToolCategory } from '@/ddd/domain/tools/value-objects/tool-metadata'
import { determineViewerType } from '@/ddd/domain/tables/value-objects/file-viewer-types'
import { createDocumentArtifact, createFileArtifact } from './types/chat-artifacts'
import { fetchFileArtifactData, getFileDownloadUrl, getDocumentFieldValue, getDocumentDownloadUrl } from '@/app/actions/artifacts'
import type { ToolDTO } from '@/app/mappers/tool-mapper'
import { StepProgressIndicator } from './StepProgressIndicator'
import { StepHistoryDisplay } from './StepHistoryDisplay'
import { ApprovalInputBar } from './ApprovalInputBar'
import { SaveToSkillDialog } from './SaveToSkillDialog'
import { savePlanToSkill } from '@/app/actions/skills'
import { createDebugLogger } from '@/lib/utils/debug-logger'
import type { ExecutionStep } from '@/app/dtos/chat.dto'
import type { ChatMessage as EmeryChatMessage } from './types/extended-chat-handler'

const logger = createDebugLogger('EmeryChat')

// Chat panel width constants - shared across chat components
export const CHAT_COLLAPSED_WIDTH = 'w-12'  // 48px
export const CHAT_HISTORY_EXPANDED_WIDTH = 'w-80'  // 320px

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
  currentChatId?: string
  currentChatModel?: string
  onChatSelect: (chatId: string, model?: string) => void
  onNewChat: () => void
  onChatHistoryUpdate?: () => void
  onModelChange?: (model: string | null) => void
  userId: string
  organizationId: number
}

function EmeryChatHeader({
  currentChatId,
  currentChatModel,
  onChatSelect,
  onNewChat,
  onChatHistoryUpdate,
  onModelChange,
  userId,
  organizationId
}: EmeryChatHeaderProps) {
  // AIDEV-NOTE: Use fine-grained store subscriptions to prevent re-renders
  const chatState = useStore(uiStateStore, uiStateSelectors.chatState)
  const chatWidthMode = useStore(uiStateStore, uiStateSelectors.chatWidthMode)
  const toggleChat = uiStateActions.toggleChat
  const toggleChatWidthMode = uiStateActions.toggleChatWidthMode
  const organizationPlan = useOrganizationPlan()

  // Handle model change - only for new chats (disabled after first message like ChatGPT)
  const handleModelSelect = async (newModel: string | null) => {
    if (currentChatId) {
      // Chat exists - model changes disabled (like ChatGPT)
      // Model is locked after first message to avoid session cache issues
      return
    }
    // No chat yet - store as pre-selection for when chat is created
    onModelChange?.(newModel)
  }

  return (
    <div className="flex items-center justify-between py-3 px-4 bg-muted/20">
      {/* Left side: Dash + Model Selector */}
      <div className="flex items-center gap-2 min-w-0">
        <h3 className="font-bold text-lg bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent flex-shrink-0">
          Dash
        </h3>
        <ModelSelector
          value={currentChatModel || null}
          onChange={handleModelSelect}
          organizationTier={organizationPlan}
          showInherit={true}
          inheritLabel="Default"
          requiredCapabilities={['toolCalling']}
          compact={true}
          disabled={!!currentChatId}  // Disable after first message (model locked for session)
        />
      </div>

      {/* Right side: New chat + Chats + Width toggle + Collapse */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* New chat button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNewChat}
              className="h-7 w-7"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">New chat</p>
          </TooltipContent>
        </Tooltip>

        {/* Chat history dropdown */}
        <ChatHistoryDropdown
          currentChatId={currentChatId}
          onChatSelect={onChatSelect}
          onNewChat={onNewChat}
          onChatHistoryUpdate={onChatHistoryUpdate}
          userId={userId}
          organizationId={organizationId}
        />

        {/* Width toggle button (only when chat is expanded) */}
        {chatState === 'expanded' && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleChatWidthMode}
            className="h-7 w-7"
            title={chatWidthMode === 'normal' ? 'Expand to half width' : 'Shrink to normal width'}
          >
            {chatWidthMode === 'normal' ? (
              <ChevronsLeft className="h-4 w-4" />
            ) : (
              <ChevronsRight className="h-4 w-4" />
            )}
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
  chatContext,
}: ChatContentWithCanvasProps) {
  // AIDEV-NOTE: useChatCanvas must be called at component level, not inside handlers
  const { openArtifactInCanvas } = useChatCanvas()

  // State for Save to Skill dialog
  const [showSaveToSkillDialog, setShowSaveToSkillDialog] = useState(false)

  // Get agentId from chat context if available (domainType is 'agents' plural)
  const agentId = chatContext?.domainType === 'agents' ? chatContext.domainId : undefined

  // Handle saving plan to skill
  const handleSaveToSkill = async (skillId: number | null, skillName?: string, selectedAgentId?: number) => {
    if (!handler.awaitingInput?.planJson) {
      throw new Error('No plan data available')
    }

    // Use selected agent ID from dialog, fallback to context agentId
    const effectiveAgentId = selectedAgentId ?? agentId

    const result = await savePlanToSkill({
      skillId,
      planJson: handler.awaitingInput.planJson,
      agentId: effectiveAgentId,
      skillName,
    })

    if (!result.success) {
      throw new Error(result.error || 'Failed to save plan to skill')
    }

    logger.debug('Plan saved to skill', { skillId: result.data?.id })
  }

  // Get plan goal from awaiting input for dialog
  const planGoal = useMemo(() => {
    if (!handler.awaitingInput?.planJson) return ''
    try {
      const plan = JSON.parse(handler.awaitingInput.planJson)
      return plan.goal || ''
    } catch {
      return ''
    }
  }, [handler.awaitingInput?.planJson])

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
        const viewerType = determineViewerType(tool.mimeType!)
        const artifact = createFileArtifact(
          fileResult.data,
          tool.tableId as number,
          tool.fieldId!,
          viewerType,
          downloadUrl,
          tool.rowId  // Pass rowId for save functionality
        )
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
      {/* Tool Panel - under header */}
      <ToolPanel
        tools={selectedTools}
        onToolClick={handleToolClick}
        onAddTool={onAddTool}
        onRemoveTool={onRemoveTool}
        className="border-b border-border/10"
      />

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
                      <div className="mx-4 mb-0.5">
                        <StepHistoryDisplay steps={steps} />
                      </div>
                    )}
                    <ChatMessage
                      message={message}
                      isLast={index === handler.messages.length - 1}
                      className={cn(
                        "my-0.5 mx-2",
                        message.role === 'assistant' && "rounded-md py-1 transition-colors"
                      )}
                    >
                      <ChatMessage.Avatar />
                      <ChatMessage.Content
                        className={cn(
                          message.role === 'user' && "rounded-md px-2 py-0.5 inline-block"
                        )}
                      >
                        <ChatMessage.Part.Markdown
                          className="max-w-none text-sm leading-snug [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_pre]:my-1.5 [&_pre]:p-2 [&_code]:text-xs [&_h1]:mt-2 [&_h1]:mb-1 [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:mt-2 [&_h3]:mb-1 [&_blockquote]:my-1.5 [&_blockquote]:pl-3"
                        />
                        <ChatMessage.Part.File className="my-2" />
                        <ChatMessage.Part.Source className="my-2" />
                      </ChatMessage.Content>
                      <ChatMessage.Actions />
                    </ChatMessage>
                  </React.Fragment>
                )
              })}

              {/* Real-time streaming steps - display accumulated steps during execution */}
              {handler.isLoading && handler.streamingSteps && handler.streamingSteps.length > 0 && (
                <div className="mx-4 mb-0.5">
                  <StepHistoryDisplay steps={handler.streamingSteps} />
                </div>
              )}

              {/* Inline loading indicator - appears after last message (Claude-like) */}
              {handler.isLoading && handler.currentStep && (
                <div className="flex gap-3 px-4 py-1 mx-4 mb-0.5">
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

      {/* Input area */}
      <div className="flex-shrink-0 py-2 px-3 bg-card">
        {/* HITL: Approval options - appears above chat input when awaiting response */}
        {handler.awaitingInput && (
          <ApprovalInputBar
            awaitingInput={handler.awaitingInput}
            onRespond={(response) => handler.respondToInput?.(response)}
            disabled={handler.isLoading}
            onSaveToSkill={
              handler.awaitingInput.planJson
                ? () => setShowSaveToSkillDialog(true)
                : undefined
            }
          />
        )}

        {/* Save to Skill Dialog */}
        <SaveToSkillDialog
          open={showSaveToSkillDialog}
          onClose={() => setShowSaveToSkillDialog(false)}
          onSave={handleSaveToSkill}
          planGoal={planGoal}
          agentId={agentId}
        />

        {/* Hide main input when awaiting user response (Claude Code-style) */}
        {!handler.awaitingInput && (
          <UnifiedChatInput
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
        )}
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
  const chatWidthMode = useStore(uiStateStore, uiStateSelectors.chatWidthMode)
  const isMobile = useStore(uiStateStore, uiStateSelectors.isMobile)
  const chatContext = useStore(uiStateStore, uiStateSelectors.chatContext)
  const setChatContext = uiStateActions.setChatContext
  const organizationPlan = useOrganizationPlan()

  const { data: emeryData } = useEmery()

  // Chat session state
  const [currentChatId, setCurrentChatId] = useState<string | undefined>()
  const [currentChatModel, setCurrentChatModel] = useState<string | undefined>()
  const [isClient, setIsClient] = useState(false)

  // Sync currentChatModel with handler.selectedModel when it changes (e.g., when loading a chat)
  useEffect(() => {
    if (handler.selectedModel !== currentChatModel) {
      setCurrentChatModel(handler.selectedModel)
    }
  }, [handler.selectedModel])

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
  const handleChatCreated = async (chatId: string) => {
    logger.summary('New chat created', { chatId })
    setCurrentChatId(chatId)

    // Apply pre-selected model to new chat (if one was selected before chat existed)
    if (currentChatModel) {
      try {
        await updateChatModel(chatId, currentChatModel)
        logger.debug('Applied pre-selected model to new chat', { chatId, model: currentChatModel })
      } catch (error) {
        console.error('Failed to apply pre-selected model:', error)
      }
    }

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
  const handleChatSelect = async (chatId: string, model?: string) => {
    if (handler.switchToChat) {
      await handler.switchToChat(chatId)
      setCurrentChatId(chatId)
      setCurrentChatModel(model) // Load the chat's model
      handler.setModel?.(model)  // Sync to handler for future messages
    }
  }

  // Handle new chat creation
  const handleNewChat = async () => {
    if (handler.createNewChat) {
      await handler.createNewChat()
      setCurrentChatId(undefined)
      setCurrentChatModel(undefined)
      handler.setModel?.(undefined)  // Clear model selection for new chat
    }
  }

  // Handle model change from settings - also syncs to chat hook
  const handleModelChange = (model: string | null) => {
    setCurrentChatModel(model || undefined)
    // Sync to chat hook so model is included in request
    handler.setModel?.(model || undefined)
  }
  
  // Collapsed state - show minimal icon strip with braintable logo
  if (chatState === 'collapsed') {
    return (
      <div className={`${CHAT_COLLAPSED_WIDTH} h-full flex flex-col bg-card flex-shrink-0 items-center py-4 gap-4`}>
        {/* Braintable logo */}
        <button
          onClick={() => uiStateActions.toggleChat()}
          className="flex items-center justify-center hover:opacity-80 transition-opacity"
          title="Expand chat"
        >
          <img
            src="/assets/braintable/logo_logo.png"
            alt="Braintable"
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

    // Sync with handler's state so tools are sent to backend
    const currentTools = new Set(handler.selectedTools.map(t => t.name))
    const newTools = new Set(tools.map(t => t.name))

    // Remove tools no longer selected
    for (const tool of handler.selectedTools) {
      if (!newTools.has(tool.name)) {
        handler.removeTool(tool)
      }
    }

    // Add newly selected tools
    for (const tool of tools) {
      if (!currentTools.has(tool.name)) {
        handler.addTool(tool)
      }
    }
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
    // Also update local state so ToolPanel re-renders
    setSelectedTools(prev => prev.filter(t => t.name !== toolToRemove.name))
    logger.debug('Tool removed via handler', { tool: toolToRemove.name })
  }

  // Calculate if we should use full width (50% of available space)
  const isFullWidth = chatWidthMode === 'full'

  return (
    <div
      className={cn(
        "relative flex bg-card h-full",
        !isFullWidth && "w-96"
      )}
      style={isFullWidth ? {
        // 50% of available space (viewport minus sidebar)
        width: 'calc((100vw - var(--sidebar-width, 256px)) / 2)'
      } : undefined}
    >
      {/* Chat Section - dynamic width based on chatWidthMode */}
      <div className={`flex flex-col w-full h-full`}>
        <EmeryChatHeader
          currentChatId={currentChatId}
          currentChatModel={currentChatModel}
          onChatSelect={handleChatSelect}
          onNewChat={handleNewChat}
          onChatHistoryUpdate={handleChatHistoryUpdate}
          onModelChange={handleModelChange}
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