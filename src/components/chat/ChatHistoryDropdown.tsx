'use client'

/**
 * ChatHistoryDropdown Component
 *
 * Header-based dropdown for chat history that's space-efficient and mobile-friendly.
 * Renamed from "Chat History" to "Chats" with improved UI and model selection.
 */

import React, { useState, useEffect } from 'react'
import { History, Plus, Search, Archive, MessageSquare, Calendar, Settings2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getChatSessions, createNewChatSession, archiveChatSession, updateChatModel } from '@/app/actions/chat-history'
import { ModelSelector } from '@/components/ai/ModelSelector'
import type { ChatSessionDTO, ChatContextDTO } from '@/app/mappers/chat-mapper'
import type { DomainType } from '@/ddd/domain/shared/types/domain-type'

interface ChatHistoryDropdownProps {
  currentChatId?: string
  onChatSelect: (chatId: string) => void
  onNewChat: () => void
  onChatHistoryUpdate?: () => void // Callback to notify parent of changes

  // Context for filtering chats
  domainType?: DomainType | 'organizations' | 'general'
  domainId?: number
  domainName?: string
  userId: string
  organizationId: number
  organizationTier?: 'free' | 'pro' | 'enterprise'
}

interface ChatItemProps {
  session: ChatSessionDTO
  isActive: boolean
  onClick: (sessionId: string) => void
  onArchive?: (sessionId: string) => void
  onSettings?: (session: ChatSessionDTO) => void
}

function ChatItem({ session, isActive, onClick, onArchive, onSettings }: ChatItemProps) {
  const [isArchiving, setIsArchiving] = useState(false)

  const handleArchive = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isArchiving) return

    setIsArchiving(true)
    try {
      const result = await archiveChatSession(session.id)
      if (result.success) {
        onArchive?.(session.id)
      }
    } catch (error) {
      console.error('Failed to archive chat:', error)
    } finally {
      setIsArchiving(false)
    }
  }

  const handleSettings = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onSettings?.(session)
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = diff / (1000 * 60 * 60)
    const days = diff / (1000 * 60 * 60 * 24)

    if (hours < 1) return 'Just now'
    if (hours < 24) return `${Math.floor(hours)}h ago`
    if (days < 7) return `${Math.floor(days)}d ago`
    return date.toLocaleDateString()
  }

  const getDomainIcon = () => {
    const contextType = session.contextMetadata?.contextType
    switch (contextType) {
      case 'agents': return '🤖'
      case 'tables': return '📊'
      case 'teams': return '👥'
      case 'files': return '📁'
      default: return '💬'
    }
  }

  return (
    <div
      className={`group flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer text-sm transition-colors ${
        isActive ? 'bg-primary/10 border border-primary/20' : ''
      }`}
      onClick={() => onClick(session.id)}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span className="text-base flex-shrink-0">{getDomainIcon()}</span>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="font-medium truncate">{session.title}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {session.messageCount}
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {session.lastMessageAt
                ? formatDate(new Date(session.lastMessageAt))
                : formatDate(new Date(session.createdAt))
              }
            </div>
            {session.model && (
              <div className="truncate max-w-[80px] bg-muted/50 px-1.5 py-0.5 rounded text-[10px]">
                {session.model.split('/').pop()?.substring(0, 12)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSettings}
          className="h-7 w-7"
          title="Chat settings"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleArchive}
          disabled={isArchiving}
          className="h-7 w-7"
          title="Archive chat"
        >
          <Archive className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

interface ChatSettingsDialogProps {
  session: ChatSessionDTO | null
  isOpen: boolean
  onClose: () => void
  onModelChange: (chatId: string, model: string | null) => void
  organizationTier: 'free' | 'pro' | 'enterprise'
}

function ChatSettingsDialog({
  session,
  isOpen,
  onClose,
  onModelChange,
  organizationTier
}: ChatSettingsDialogProps) {
  const [model, setModel] = useState<string | null>(session?.model || null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (session) {
      setModel(session.model || null)
    }
  }, [session])

  const handleSave = async () => {
    if (!session) return

    setIsSaving(true)
    try {
      const result = await updateChatModel(session.id, model)
      if (result.success) {
        onModelChange(session.id, model)
        onClose()
      }
    } catch (error) {
      console.error('Failed to update chat model:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!session) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Chat Settings
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Chat Title</label>
            <p className="text-sm text-muted-foreground truncate">{session.title}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">AI Model</label>
            <p className="text-xs text-muted-foreground mb-2">
              Select a model for this chat. Leave as "Inherit" to use the organization default.
            </p>
            <ModelSelector
              value={model}
              onChange={setModel}
              organizationTier={organizationTier}
              showInherit={true}
              inheritLabel="Inherit from organization"
              requiredCapabilities={['toolCalling']}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ChatHistoryDropdown({
  currentChatId,
  onChatSelect,
  onNewChat,
  onChatHistoryUpdate,
  domainType,
  domainId,
  domainName,
  userId,
  organizationId,
  organizationTier = 'free'
}: ChatHistoryDropdownProps) {
  const [sessions, setSessions] = useState<ChatSessionDTO[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [settingsSession, setSettingsSession] = useState<ChatSessionDTO | null>(null)

  // Load chat sessions for current context
  const loadChatSessions = async () => {
    try {
      setIsLoading(true)

      const context: ChatContextDTO = {
        domainType: domainType === 'general' ? undefined : domainType,
        domainId,
        organizationId,
        userId,
        limit: 20
      }

      const result = await getChatSessions(context)

      if (result.success && result.data) {
        setSessions(result.data)
      }
    } catch (error) {
      console.error('Failed to load chat sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Load sessions when context changes or when explicitly refreshed
  useEffect(() => {
    if (isOpen) {
      loadChatSessions()
    }
  }, [domainType, domainId, organizationId, userId, isOpen])

  // Public method to refresh from parent
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).refreshChatHistory = loadChatSessions
    }
  }, [])

  // Handle creating new chat
  const handleNewChat = async () => {
    try {
      setIsCreatingNew(true)
      setIsOpen(false)

      const result = await createNewChatSession({
        domainType: domainType === 'general' ? undefined : domainType,
        domainId,
        domainName,
        organizationId,
        userId
      })

      if (result.success && result.data) {
        setSessions([result.data, ...sessions])
        onChatSelect(result.data.id)
        await loadChatSessions()
      }

      onNewChat()
    } catch (error) {
      console.error('Failed to create new chat:', error)
      onNewChat()
    } finally {
      setIsCreatingNew(false)
    }
  }

  // Handle archiving a chat
  const handleArchiveChat = (sessionId: string) => {
    setSessions(sessions.filter(s => s.id !== sessionId))
    if (currentChatId === sessionId) {
      onNewChat()
    }
  }

  // Handle model change
  const handleModelChange = (chatId: string, model: string | null) => {
    setSessions(sessions.map(s =>
      s.id === chatId ? { ...s, model: model || undefined } : s
    ))
  }

  // Filter sessions based on search query
  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeChatTitle = sessions.find(s => s.id === currentChatId)?.title

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground px-2"
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline font-medium">Chats</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className="w-80 p-0"
          align="start"
          side="bottom"
          sideOffset={8}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b bg-muted/30">
            <div className="font-semibold text-sm">Chats</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewChat}
              disabled={isCreatingNew}
              className="h-7 gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
          </div>

          {/* Search */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* Chat List */}
          <ScrollArea className="h-80">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="p-6 text-center">
                {searchQuery ? (
                  <p className="text-sm text-muted-foreground">
                    No chats match "{searchQuery}"
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
                      <MessageSquare className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">No chats yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Start a new conversation
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNewChat}
                      disabled={isCreatingNew}
                      className="text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1.5" />
                      New Chat
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredSessions.map((session) => (
                  <ChatItem
                    key={session.id}
                    session={session}
                    isActive={session.id === currentChatId}
                    onClick={(chatId) => {
                      onChatSelect(chatId)
                      setIsOpen(false)
                    }}
                    onArchive={handleArchiveChat}
                    onSettings={setSettingsSession}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Chat Settings Dialog */}
      <ChatSettingsDialog
        session={settingsSession}
        isOpen={!!settingsSession}
        onClose={() => setSettingsSession(null)}
        onModelChange={handleModelChange}
        organizationTier={organizationTier}
      />
    </>
  )
}
