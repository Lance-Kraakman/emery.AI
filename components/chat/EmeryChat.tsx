'use client'

import { useState, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
// AIDEV-NOTE: Temporarily commented out LlamaIndex imports to fix build issues
// import { ChatSection, ChatMessages } from '@llamaindex/chat-ui'
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

// AIDEV-NOTE: Temporary interface definitions for LlamaIndex compatibility
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
}

interface ExtendedChatHandler {
  messages?: Message[];
  append?: (message: Message) => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
  currentChatId?: string;
  switchToChat?: (chatId: string) => Promise<void>;
  createNewChat?: () => Promise<void>;
}
import { useChatGRPC } from './useChatGRPC'
import { ChatCanvas } from './ChatCanvas'
import { CustomChatInput } from './CustomChatInput'
import { ChatHistoryDropdown } from './ChatHistoryDropdown'
import { createChatContextForPage } from '@/components/layout/types'
import type { DomainType } from '@/ddd/domain/rag/value-objects'

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

export function EmeryChat() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const { chatState, canvasState, canvasType, chatContext, toggleCanvas, setChatContext } = useLayout()
  
  // Chat session state
  const [currentChatId, setCurrentChatId] = useState<string | undefined>()
  
  // Auto-detect page context if not already set
  useEffect(() => {
    if (!chatContext) {
      // Extract page name from pathname
      const pageName = pathname.split('/')[1] || 'mission-control'
      
      // Extract domain ID from search params or pathname segments
      let domainId: number | undefined
      let domainName: string | undefined
      
      if (searchParams.has('tableId')) {
        domainId = parseInt(searchParams.get('tableId')!)
      } else if (searchParams.has('agentId')) {
        domainId = parseInt(searchParams.get('agentId')!)
      } else if (searchParams.has('teamId')) {
        domainId = parseInt(searchParams.get('teamId')!)
      } else {
        // Try to extract from URL segments like /agents/123
        const segments = pathname.split('/').filter(Boolean)
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
  
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [isClient, setIsClient] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  
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
  
  const handler = useChatGRPC({
    domainType: chatContext?.domainType,
    domainId: chatContext?.domainId,
    chatId: currentChatId
  }, handleChatCreated)
  
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
  
  // Don't render if hidden
  if (chatState === 'hidden') {
    return null
  }
  
  // Get user info for chat history
  const userId = session?.user?.id
  const organizationId = session?.user?.currentOrganizationId
  
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

  const handleSuggestionClick = (suggestion: string) => {
    console.log('Suggestion clicked:', suggestion)
    setSelectedSuggestionIndex(-1)
    setShowSuggestions(false) // Hide suggestions after selection
    
    // Use the chat handler to send the suggestion
    if (handler.append) {
      handler.append({ id: '', content: suggestion, role: 'user' })
    }
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
          <div className="h-full flex flex-col p-0">
            <div className="h-full flex flex-col">
              {/* Messages and suggestions container - scrollable */}
              <div ref={handler.scrollRef || undefined} className="flex-1 overflow-y-auto flex flex-col">
                {/* Messages area */}
                <div className="flex-1">
                  <div className="bg-transparent px-4 py-2">
                    {/* AIDEV-NOTE: LlamaIndex ChatMessages placeholder */}
                    <div className="text-center text-muted-foreground p-8">
                      Chat functionality temporarily disabled
                    </div>
                  </div>
                </div>
                
                {/* Suggestions at bottom of messages area when no messages */}
                {isClient && showSuggestions && handler.messages && handler.messages.length === 0 && (
                  <div className="flex-shrink-0 mt-auto">
                    <ChatSuggestions 
                      onSuggestionClick={handleSuggestionClick} 
                      selectedIndex={selectedSuggestionIndex}
                      domainType={chatContext?.domainType}
                    />
                  </div>
                )}
              </div>
              
              {/* Input area - always fixed at very bottom */}
              <div className="flex-shrink-0 p-4 border-t border-border/10 bg-card" onKeyDown={handleKeyDown}>
                <CustomChatInput 
                  onSendMessage={(message) => {
                    if (handler.append) {
                      handler.append({ id: '', content: message, role: 'user' })
                    }
                    setShowSuggestions(false)
                  }}
                  placeholder="Ask Emery anything..."
                />
              </div>
            </div>
            
            {/* Canvas Section placeholder */}
            {canvasState === 'expanded' && canvasType === 'chat' && (
              <div className="p-4">
                {/* AIDEV-NOTE: ChatCanvas placeholder */}
                <div className="text-center text-muted-foreground">
                  Canvas functionality temporarily disabled
                </div>
              </div>
            )}
          </div>
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