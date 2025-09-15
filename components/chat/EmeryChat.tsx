'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { generateId } from 'ai'
import {
  ChatSection,
  ChatMessages,
  useChatCanvas
} from '@llamaindex/chat-ui'
import { 
  ChevronLeft, 
  ChevronRight, 
  Database,
  BarChart,
  Users,
  Code,
  Lightbulb
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLayout } from '@/components/layout/LayoutProvider'
import { ChatCanvas } from './ChatCanvas'
import CustomChatInput from './CustomChatInput'
import { ChatHistoryDropdown } from './ChatHistoryDropdown'
import { createChatContextForPage } from '@/components/layout/types'
import type { DomainType } from '@/ddd/domain/rag/value-objects'
import { useEmery } from '@/contexts/EmeryStoreProvider'
import { ToolPanel } from './ToolPanel'
import { resolveReferences } from '@/app/actions/references'
import { ReferenceCategory } from '@/ddd/domain/chat/value-objects/reference-types'
import { createDocumentArtifact, createFileArtifact } from './types/chat-artifacts'
import type { DocumentFieldValue, FileFieldValue } from '@/ddd/domain/tables/value-objects/field-values'
import { fetchDocumentArtifactData, fetchFileArtifactData, getFileDownloadUrl } from '@/app/actions/artifacts'
import { mapReferenceToolToDTO, type ReferenceToolDTO } from '@/app/mappers/reference-tool-mapper'
import type { ToolDTO } from '@/app/mappers/tool-mapper'

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
  const { chatState, toggleChat, canvasState, toggleCanvas } = useLayout()
  
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
    <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Emery
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

// Context-aware suggestions component (extracted from mission-control)
function ChatSuggestions({ 
  onSuggestionClick, 
  selectedIndex = -1,
  domainType
}: { 
  onSuggestionClick: (suggestion: string) => void
  selectedIndex?: number
  domainType?: DomainType | 'organizations' | 'general'
}) {
  const suggestions = getSuggestionsForDomain(domainType)

  if (suggestions.length === 0) return null

  return (
    <div className="px-4">
      <div className="mb-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Lightbulb className="h-3 w-3" />
          Suggestions
        </div>
      </div>
      <div>
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            className={`w-full flex items-center gap-2 px-0 py-2.5 text-left text-sm transition-colors duration-150 focus:outline-none border-b border-border/30 last:border-b-0 ${
              selectedIndex === index 
                ? 'bg-muted/70 text-foreground' 
                : 'hover:bg-muted/50'
            }`}
            onClick={() => onSuggestionClick(suggestion.prompt)}
          >
            <div className="flex-shrink-0 text-muted-foreground">
              {suggestion.icon}
            </div>
            <span className="flex-1 text-foreground truncate">
              {suggestion.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// Component that can access useChatCanvas hook inside ChatSection
interface ChatContentWithCanvasProps {
  selectedTools: (ReferenceToolDTO | ToolDTO)[]
  onToolsChange: (tools: (ReferenceToolDTO | ToolDTO)[]) => void
  onAddTool: () => void
  onRemoveTool: (tool: ReferenceToolDTO | ToolDTO) => void
  showSuggestions: boolean
  selectedSuggestionIndex: number
  onSuggestionClick: (suggestion: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  isClient: boolean
  handler: any
  setShowSuggestions: (show: boolean) => void
  chatContext: any
}

function ChatContentWithCanvas({
  selectedTools,
  onToolsChange,
  onAddTool,
  onRemoveTool,
  showSuggestions,
  selectedSuggestionIndex,
  onSuggestionClick,
  onKeyDown,
  isClient,
  handler,
  setShowSuggestions,
  chatContext
}: ChatContentWithCanvasProps) {
  const { openArtifactInCanvas } = useChatCanvas()

  // Handle tool click using canvas hook
  const handleToolClick = async (tool: ReferenceToolDTO | ToolDTO) => {
    console.log('Tool clicked:', tool)

    // Only handle reference tools for artifact opening
    if (!('toolName' in tool)) {
      console.log('System tool clicked:', tool.name)
      return
    }

    if (tool.category === ReferenceCategory.DOC) {
      // Fetch real document data using DTO config
      const result = await fetchDocumentArtifactData(
        tool.config.documentId!,
        tool.config.organizationId,
        tool.config.documentFilename!,
        tool.config.documentMimeType!
      )

      if (result.success && result.data) {
        // Create artifact and open in canvas using tool config data
        const artifact = createDocumentArtifact(
          result.data,
          tool.config.organizationId,
          tool.config.documentTableId!,
          tool.config.documentFieldId!,
          'view'
        )
        openArtifactInCanvas(artifact)
        console.log('Document artifact opened in canvas:', artifact)
      } else {
        console.error('Failed to fetch document data:', result.error)
      }
    } else if (tool.category === ReferenceCategory.FILE) {
      // Fetch real file data using DTO config
      const fileResult = await fetchFileArtifactData(
        tool.config.fileId!,
        tool.config.organizationId,
        tool.config.filename!,
        tool.config.fileMimeType!
      )

      if (fileResult.success && fileResult.data) {
        // Get download URL for the file
        const urlResult = await getFileDownloadUrl(
          tool.config.fileId!,
          tool.config.organizationId
        )

        const downloadUrl = urlResult.success ? urlResult.data! : ''

        // Create artifact and open in canvas
        const artifact = createFileArtifact(fileResult.data, 1, 1, 'generic', downloadUrl)
        openArtifactInCanvas(artifact)
        console.log('File artifact opened in canvas:', artifact)
      } else {
        console.error('Failed to fetch file data:', fileResult.error)
      }
    }
    // Other tool types have different behaviors (agents, tables, databases)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Messages and suggestions container - scrollable */}
      <div ref={handler.scrollRef} className="flex-1 overflow-y-auto flex flex-col px-1">
        {/* Messages area */}
        <div className="flex-1">
          {/* Debug: Show message count */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-gray-500 p-2">
              Messages: {handler.messages?.length || 0}
            </div>
          )}

          {/* ChatMessages component */}
          <ChatMessages
            handler={handler}
            className="flex-1 h-full"
          />

        </div>

        {/* Suggestions at bottom of messages area when no messages */}
        {isClient && showSuggestions && handler.messages.length === 0 && (
          <div className="flex-shrink-0 mt-auto">
            <ChatSuggestions
              onSuggestionClick={onSuggestionClick}
              selectedIndex={selectedSuggestionIndex}
              domainType={chatContext?.domainType}
            />
          </div>
        )}
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
      <div className="flex-shrink-0 p-4 border-t border-border/10 bg-card" onKeyDown={onKeyDown}>
        <CustomChatInput
          onSendMessage={async (message) => {
            // Send message with tools
            handler.append({ content: message, role: 'user' })
            setShowSuggestions(false)
            // Keep tools visible after sending (don't clear them)
          }}
          onToolsChange={onToolsChange}
          placeholder="Ask Emery anything... (type @ to add tools, docs, agents, etc.)"
        />
      </div>
    </div>
  )
}


interface EmeryChatProps {
  handler: any; // Chat handler from layout
}

export function EmeryChat({ handler }: EmeryChatProps) {
  // ALL HOOKS MUST BE CALLED FIRST - NO CONDITIONAL RETURNS BEFORE THIS POINT
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const { chatState, canvasState, isMobile, chatContext, toggleCanvas, setChatContext } = useLayout()
  const { data: emeryData } = useEmery()

  // Chat session state
  const [currentChatId, setCurrentChatId] = useState<string | undefined>()
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [isClient, setIsClient] = useState(false)

  // Tools state for @ tool selection
  const [selectedTools, setSelectedTools] = useState<(ReferenceToolDTO | ToolDTO)[]>([])

  // Handle chat history updates (callback for forcing refresh)
  const handleChatHistoryUpdate = () => {
    // Trigger refresh of chat history dropdown
    if (typeof window !== 'undefined' && (window as any).refreshChatHistory) {
      (window as any).refreshChatHistory()
    }
  }

  // Handle chat created callback from useChatGRPC
  const handleChatCreated = (chatId: string) => {
    console.log('[EMERY-CHAT] New chat created:', chatId)
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

      console.log('[EMERY-CHAT] Auto-detecting context:', { pathname, pageName, domainId })

      // Create context based on detected page
      const detectedContext = createChatContextForPage(pageName, domainId, domainName)
      setChatContext(detectedContext)
    }
  }, [pathname, searchParams, chatContext, setChatContext])

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

  // AIDEV-NOTE: Removed complex text parsing - tools now come from explicit selection only
  // This eliminates the parseReferencesWithContext runtime error and simplifies the architecture

  // NOW ALL HOOKS ARE CALLED - CONDITIONAL RETURNS ARE SAFE BELOW THIS POINT

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
      <div className="w-96 h-full flex flex-col bg-card border-l border-border items-center justify-center p-8">
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
  
  // Collapsed state - just show header with expand button
  if (chatState === 'collapsed') {
    return (
      <div className="w-12 h-full flex flex-col bg-card border-l border-border">
        <EmeryChatHeader 
          domainType={chatContext?.domainType}
          domainName={chatContext?.domainName}
          currentChatId={currentChatId}
          onChatSelect={handleChatSelect}
          onNewChat={handleNewChat}
          onChatHistoryUpdate={handleChatHistoryUpdate}
          userId={userId || ''}
          organizationId={organizationId || 0}
        />
        <div className="flex-1" />
      </div>
    )
  }

  const suggestions = getSuggestionsPrompts(chatContext?.domainType)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Check if reference dropdown is open to avoid conflicts
    const referenceDropdownOpen = document.querySelector('[data-chat-search-dropdown]')
    if (referenceDropdownOpen) return // Let reference dropdown handle navigation
    
    if (!showSuggestions || suggestions.length === 0) return
    
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => {
        if (prev === -1) return suggestions.length - 1
        return prev > 0 ? prev - 1 : suggestions.length - 1
      })
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => {
        if (prev === -1) return 0
        return prev < suggestions.length - 1 ? prev + 1 : 0
      })
    } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
      e.preventDefault()
      handleSuggestionClick(suggestions[selectedSuggestionIndex])
    } else if (e.key === 'Escape') {
      setSelectedSuggestionIndex(-1)
    }
  }

  // Handle tool changes from chat input
  const handleToolsChange = (tools: (ReferenceToolDTO | ToolDTO)[]) => {
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

  // Handle removing tool from panel
  const handleRemoveTool = (toolToRemove: ReferenceToolDTO | ToolDTO) => {
    // Remove from selected tools
    const updatedTools = selectedTools.filter(tool => {
      if ('toolName' in tool && 'toolName' in toolToRemove) {
        return tool.id !== toolToRemove.id
      }
      if (!('toolName' in tool) && !('toolName' in toolToRemove)) {
        return tool.name !== toolToRemove.name
      }
      return true
    })
    setSelectedTools(updatedTools)

    // TODO: Also update the input text to remove the tool reference
    // This would require access to the input element's value and updating it
    console.log('Tool removed:', toolToRemove)
  }

  const handleSuggestionClick = (suggestion: string) => {
    console.log('Suggestion clicked:', suggestion)
    setSelectedSuggestionIndex(-1)
    setShowSuggestions(false) // Hide suggestions after selection

    // Use the chat handler to send the suggestion
    handler.append({ content: suggestion, role: 'user' })
  }




  // Determine layout based on canvas state
  const isFullWidth = canvasState === 'collapsed'
  
  return (
    <div className={`flex bg-card border-l border-border ${isFullWidth ? 'h-screen' : 'h-full'}`}>
      {/* Chat Section - now full width without sidebar */}
      <div className={`flex flex-col ${isFullWidth ? 'h-screen' : 'h-full'} ${isFullWidth ? 'flex-1' : 'w-96'}`}>
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
        <div className="flex-1 min-h-0 overflow-hidden" suppressHydrationWarning>
          <ChatContentWithCanvas
            selectedTools={selectedTools}
            onToolsChange={handleToolsChange}
            onAddTool={handleAddTool}
            onRemoveTool={handleRemoveTool}
            showSuggestions={showSuggestions}
            selectedSuggestionIndex={selectedSuggestionIndex}
            onSuggestionClick={handleSuggestionClick}
            onKeyDown={handleKeyDown}
            isClient={isClient}
            handler={handler}
            setShowSuggestions={setShowSuggestions}
            chatContext={chatContext}
          />
        </div>
      </div>
    </div>
  )
}

// Helper functions for domain-specific suggestions
function getSuggestionsForDomain(domainType?: DomainType | 'organizations' | 'general') {
  switch (domainType) {
    case 'agents':
      return [
        {
          icon: <Code className="h-3 w-3" />,
          title: "Help configure agent capabilities and tools",
          prompt: "Help me configure this agent's capabilities and available tools for optimal performance."
        },
        {
          icon: <BarChart className="h-3 w-3" />,
          title: "Analyze agent performance and task execution",
          prompt: "Analyze this agent's performance metrics and suggest optimizations for task execution."
        }
      ]
      
    case 'teams':
      return [
        {
          icon: <Users className="h-3 w-3" />,
          title: "Analyze team collaboration and productivity",
          prompt: "Analyze our team's collaboration patterns and suggest productivity improvements."
        },
        {
          icon: <BarChart className="h-3 w-3" />,
          title: "Review team performance metrics and goals",
          prompt: "Review our team's performance metrics and help optimize our goals and workflows."
        }
      ]
      
    case 'tables':
      return [
        {
          icon: <Database className="h-3 w-3" />,
          title: "Query table data with natural language",
          prompt: "Help me query this table's data using natural language commands."
        },
        {
          icon: <BarChart className="h-3 w-3" />,
          title: "Analyze data patterns and generate insights",
          prompt: "Analyze patterns in this table's data and generate actionable business insights."
        }
      ]
      
    case 'organizations':
      return [
        {
          icon: <BarChart className="h-3 w-3" />,
          title: "Generate organizational performance report",
          prompt: "Generate a comprehensive report on our organizational performance and key metrics."
        },
        {
          icon: <Users className="h-3 w-3" />,
          title: "Analyze resource allocation and optimization",
          prompt: "Analyze our current resource allocation and suggest optimization strategies."
        }
      ]
      
    default: // 'general' or mission-control
      return [
        {
          icon: <Database className="h-3 w-3" />,
          title: "Analyze database performance and optimization opportunities",
          prompt: "Analyze the current database performance and suggest optimizations for our main tables and queries."
        },
        {
          icon: <BarChart className="h-3 w-3" />,
          title: "Generate comprehensive analytics report with KPIs",
          prompt: "Generate a comprehensive analytics report showing key performance indicators, user engagement metrics, and business trends from our data."
        }
      ]
  }
}

function getSuggestionsPrompts(domainType?: DomainType | 'organizations' | 'general'): string[] {
  return getSuggestionsForDomain(domainType).map(s => s.prompt)
}