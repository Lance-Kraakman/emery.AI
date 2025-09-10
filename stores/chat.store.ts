/**
 * Chat Store - Replaces use-chat-grpc hooks and mission control state
 * 
 * Centralizes all chat-related state including messages, streaming, context,
 * and real-time communication. This store replaces the complex useState patterns
 * in use-chat-grpc hooks with performant, type-safe state management.
 * 
 * AIDEV-NOTE: This replaces 12+ useState calls across use-chat-grpc hooks and
 * provides fine-grained reactivity for chat and mission control features.
 */

import { Store } from '@tanstack/react-store'
import { generateId } from 'ai'

export interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant' | 'system'
  timestamp: Date
  metadata?: {
    tokens?: number
    model?: string
    duration?: number
    context?: ChatContext
  }
}

export interface ChatContext {
  chatId?: string
  domainType?: string
  domainId?: number
  tableId?: number
  organizationId?: number
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  context?: ChatContext
  createdAt: Date
  updatedAt: Date
  archived: boolean
}

export interface StreamingState {
  isStreaming: boolean
  streamingMessageId: string | null
  currentChunk: string
  totalChunks: number
  chunksReceived: number
}

export interface ChatState {
  // Current session
  currentSessionId: string | null
  sessions: Record<string, ChatSession>
  
  // Messages
  messages: ChatMessage[]
  input: string
  
  // Streaming state
  streaming: StreamingState
  
  // Loading and error states
  isLoading: boolean
  isConnecting: boolean
  isReconnecting: boolean
  error: string | null
  connectionError: string | null
  
  // Chat context
  context: ChatContext | null
  
  // UI state
  isChatOpen: boolean
  isChatMinimized: boolean
  chatPosition: 'left' | 'right' | 'bottom'
  chatSize: { width: number; height: number }
  
  // Scroll management
  isAutoScrollEnabled: boolean
  shouldScrollToBottom: boolean
  isAtBottom: boolean
  
  // Message management
  selectedMessageIds: string[]
  editingMessageId: string | null
  replyToMessageId: string | null
  
  // Session management
  sessionListOpen: boolean
  searchQuery: string
  sessionFilter: 'all' | 'recent' | 'archived'
  
  // Advanced features
  typingIndicator: {
    isTyping: boolean
    user?: string
  }
  
  // Voice features
  voiceInput: {
    isRecording: boolean
    isProcessing: boolean
    audioLevel: number
  }
  
  voiceOutput: {
    isEnabled: boolean
    isSpeaking: boolean
    rate: number
    pitch: number
    voice?: string
  }
  
  // Collaboration
  activeUsers: Array<{
    id: string
    name: string
    avatar?: string
    lastSeen: Date
  }>
  
  // Performance
  messageLoadLimit: number
  messageLoadOffset: number
  hasMoreMessages: boolean
  
  // Settings
  settings: {
    theme: 'light' | 'dark' | 'auto'
    fontSize: 'small' | 'medium' | 'large'
    soundEnabled: boolean
    notificationsEnabled: boolean
    autoSave: boolean
    maxMessages: number
  }
  
  // Analytics
  analytics: {
    totalMessages: number
    totalSessions: number
    averageSessionLength: number
    mostUsedContext?: string
    responseTimeHistory: number[]
  }
}

const initialState: ChatState = {
  // Session
  currentSessionId: null,
  sessions: {},
  
  // Messages
  messages: [],
  input: '',
  
  // Streaming
  streaming: {
    isStreaming: false,
    streamingMessageId: null,
    currentChunk: '',
    totalChunks: 0,
    chunksReceived: 0
  },
  
  // Loading
  isLoading: false,
  isConnecting: false,
  isReconnecting: false,
  error: null,
  connectionError: null,
  
  // Context
  context: null,
  
  // UI
  isChatOpen: false,
  isChatMinimized: false,
  chatPosition: 'right',
  chatSize: { width: 400, height: 600 },
  
  // Scroll
  isAutoScrollEnabled: true,
  shouldScrollToBottom: false,
  isAtBottom: true,
  
  // Message management
  selectedMessageIds: [],
  editingMessageId: null,
  replyToMessageId: null,
  
  // Session management
  sessionListOpen: false,
  searchQuery: '',
  sessionFilter: 'all',
  
  // Advanced features
  typingIndicator: {
    isTyping: false
  },
  
  // Voice
  voiceInput: {
    isRecording: false,
    isProcessing: false,
    audioLevel: 0
  },
  
  voiceOutput: {
    isEnabled: false,
    isSpeaking: false,
    rate: 1,
    pitch: 1
  },
  
  // Collaboration
  activeUsers: [],
  
  // Performance
  messageLoadLimit: 50,
  messageLoadOffset: 0,
  hasMoreMessages: false,
  
  // Settings
  settings: {
    theme: 'auto',
    fontSize: 'medium',
    soundEnabled: true,
    notificationsEnabled: true,
    autoSave: true,
    maxMessages: 1000
  },
  
  // Analytics
  analytics: {
    totalMessages: 0,
    totalSessions: 0,
    averageSessionLength: 0,
    responseTimeHistory: []
  }
}

// Create the chat store
export const chatStore = new Store(initialState)

// Store actions for chat management
export const chatActions = {
  // Session actions
  createSession: (context?: ChatContext) => {
    const sessionId = generateId()
    const session: ChatSession = {
      id: sessionId,
      title: `Chat ${new Date().toLocaleDateString()}`,
      messages: [],
      context,
      createdAt: new Date(),
      updatedAt: new Date(),
      archived: false
    }

    chatStore.setState((state) => ({
      ...state,
      currentSessionId: sessionId,
      sessions: {
        ...state.sessions,
        [sessionId]: session
      },
      messages: [],
      context
    }))

    return sessionId
  },

  setCurrentSession: (sessionId: string | null) => {
    chatStore.setState((state) => {
      if (!sessionId) {
        return {
          ...state,
          currentSessionId: null,
          messages: [],
          context: null
        }
      }

      const session = state.sessions[sessionId]
      if (!session) return state

      return {
        ...state,
        currentSessionId: sessionId,
        messages: session.messages,
        context: session.context || null
      }
    })
  },

  updateSession: (sessionId: string, updates: Partial<ChatSession>) => {
    chatStore.setState((state) => ({
      ...state,
      sessions: {
        ...state.sessions,
        [sessionId]: {
          ...state.sessions[sessionId],
          ...updates,
          updatedAt: new Date()
        }
      }
    }))
  },

  deleteSession: (sessionId: string) => {
    chatStore.setState((state) => {
      const newSessions = { ...state.sessions }
      delete newSessions[sessionId]

      return {
        ...state,
        sessions: newSessions,
        currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
        messages: state.currentSessionId === sessionId ? [] : state.messages
      }
    })
  },

  archiveSession: (sessionId: string) => {
    chatActions.updateSession(sessionId, { archived: true })
  },

  // Message actions
  setInput: (input: string) => {
    chatStore.setState((state) => ({ ...state, input }))
  },

  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: generateId(),
      timestamp: new Date()
    }

    chatStore.setState((state) => {
      const newMessages = [...state.messages, newMessage]
      
      // Update current session if exists
      const updatedSessions = state.currentSessionId ? {
        ...state.sessions,
        [state.currentSessionId]: {
          ...state.sessions[state.currentSessionId],
          messages: newMessages,
          updatedAt: new Date()
        }
      } : state.sessions

      return {
        ...state,
        messages: newMessages,
        sessions: updatedSessions,
        shouldScrollToBottom: true,
        analytics: {
          ...state.analytics,
          totalMessages: state.analytics.totalMessages + 1
        }
      }
    })

    return newMessage.id
  },

  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => {
    chatStore.setState((state) => {
      const newMessages = state.messages.map(msg =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      )

      // Update current session if exists
      const updatedSessions = state.currentSessionId ? {
        ...state.sessions,
        [state.currentSessionId]: {
          ...state.sessions[state.currentSessionId],
          messages: newMessages,
          updatedAt: new Date()
        }
      } : state.sessions

      return {
        ...state,
        messages: newMessages,
        sessions: updatedSessions
      }
    })
  },

  deleteMessage: (messageId: string) => {
    chatStore.setState((state) => {
      const newMessages = state.messages.filter(msg => msg.id !== messageId)
      
      // Update current session if exists
      const updatedSessions = state.currentSessionId ? {
        ...state.sessions,
        [state.currentSessionId]: {
          ...state.sessions[state.currentSessionId],
          messages: newMessages,
          updatedAt: new Date()
        }
      } : state.sessions

      return {
        ...state,
        messages: newMessages,
        sessions: updatedSessions,
        selectedMessageIds: state.selectedMessageIds.filter(id => id !== messageId)
      }
    })
  },

  setMessages: (messages: ChatMessage[]) => {
    chatStore.setState((state) => {
      // Update current session if exists
      const updatedSessions = state.currentSessionId ? {
        ...state.sessions,
        [state.currentSessionId]: {
          ...state.sessions[state.currentSessionId],
          messages,
          updatedAt: new Date()
        }
      } : state.sessions

      return {
        ...state,
        messages,
        sessions: updatedSessions
      }
    })
  },

  clearMessages: () => {
    chatActions.setMessages([])
  },

  // Streaming actions
  startStreaming: (messageId: string) => {
    chatStore.setState((state) => ({
      ...state,
      streaming: {
        ...state.streaming,
        isStreaming: true,
        streamingMessageId: messageId,
        currentChunk: '',
        chunksReceived: 0
      }
    }))
  },

  updateStreamingChunk: (chunk: string) => {
    chatStore.setState((state) => ({
      ...state,
      streaming: {
        ...state.streaming,
        currentChunk: state.streaming.currentChunk + chunk,
        chunksReceived: state.streaming.chunksReceived + 1
      }
    }))

    // Update the streaming message
    const state = chatStore.state
    if (state.streaming.streamingMessageId) {
      chatActions.updateMessage(state.streaming.streamingMessageId, {
        content: state.streaming.currentChunk
      })
    }
  },

  endStreaming: () => {
    chatStore.setState((state) => ({
      ...state,
      streaming: {
        isStreaming: false,
        streamingMessageId: null,
        currentChunk: '',
        totalChunks: 0,
        chunksReceived: 0
      },
      isLoading: false,
      shouldScrollToBottom: true
    }))
  },

  // Loading and error actions
  setLoading: (isLoading: boolean) => {
    chatStore.setState((state) => ({ 
      ...state, 
      isLoading,
      error: isLoading ? null : state.error
    }))
  },

  setConnecting: (isConnecting: boolean) => {
    chatStore.setState((state) => ({ ...state, isConnecting }))
  },

  setReconnecting: (isReconnecting: boolean) => {
    chatStore.setState((state) => ({ ...state, isReconnecting }))
  },

  setError: (error: string | null) => {
    chatStore.setState((state) => ({
      ...state,
      error,
      isLoading: false,
      streaming: error ? {
        isStreaming: false,
        streamingMessageId: null,
        currentChunk: '',
        totalChunks: 0,
        chunksReceived: 0
      } : state.streaming
    }))
  },

  setConnectionError: (error: string | null) => {
    chatStore.setState((state) => ({ 
      ...state, 
      connectionError: error,
      isConnecting: false,
      isReconnecting: false
    }))
  },

  // Context actions
  setContext: (context: ChatContext | null) => {
    chatStore.setState((state) => ({ ...state, context }))
  },

  updateContext: (updates: Partial<ChatContext>) => {
    chatStore.setState((state) => ({
      ...state,
      context: state.context ? { ...state.context, ...updates } : updates as ChatContext
    }))
  },

  // UI actions
  toggleChat: () => {
    chatStore.setState((state) => ({ ...state, isChatOpen: !state.isChatOpen }))
  },

  setChatOpen: (isOpen: boolean) => {
    chatStore.setState((state) => ({ ...state, isChatOpen: isOpen }))
  },

  setChatMinimized: (isMinimized: boolean) => {
    chatStore.setState((state) => ({ ...state, isChatMinimized: isMinimized }))
  },

  setChatPosition: (position: ChatState['chatPosition']) => {
    chatStore.setState((state) => ({ ...state, chatPosition: position }))
  },

  setChatSize: (size: { width: number; height: number }) => {
    chatStore.setState((state) => ({ ...state, chatSize: size }))
  },

  // Scroll actions
  setAutoScrollEnabled: (enabled: boolean) => {
    chatStore.setState((state) => ({ ...state, isAutoScrollEnabled: enabled }))
  },

  setShouldScrollToBottom: (should: boolean) => {
    chatStore.setState((state) => ({ ...state, shouldScrollToBottom: should }))
  },

  setIsAtBottom: (isAtBottom: boolean) => {
    chatStore.setState((state) => ({ ...state, isAtBottom }))
  },

  // Message selection actions
  setSelectedMessageIds: (messageIds: string[]) => {
    chatStore.setState((state) => ({ ...state, selectedMessageIds: messageIds }))
  },

  toggleMessageSelection: (messageId: string) => {
    chatStore.setState((state) => ({
      ...state,
      selectedMessageIds: state.selectedMessageIds.includes(messageId)
        ? state.selectedMessageIds.filter(id => id !== messageId)
        : [...state.selectedMessageIds, messageId]
    }))
  },

  setEditingMessageId: (messageId: string | null) => {
    chatStore.setState((state) => ({ ...state, editingMessageId: messageId }))
  },

  setReplyToMessageId: (messageId: string | null) => {
    chatStore.setState((state) => ({ ...state, replyToMessageId: messageId }))
  },

  // Session management actions
  setSessionListOpen: (isOpen: boolean) => {
    chatStore.setState((state) => ({ ...state, sessionListOpen: isOpen }))
  },

  setSearchQuery: (query: string) => {
    chatStore.setState((state) => ({ ...state, searchQuery: query }))
  },

  setSessionFilter: (filter: ChatState['sessionFilter']) => {
    chatStore.setState((state) => ({ ...state, sessionFilter: filter }))
  },

  // Voice actions
  setVoiceRecording: (isRecording: boolean) => {
    chatStore.setState((state) => ({
      ...state,
      voiceInput: {
        ...state.voiceInput,
        isRecording
      }
    }))
  },

  setVoiceProcessing: (isProcessing: boolean) => {
    chatStore.setState((state) => ({
      ...state,
      voiceInput: {
        ...state.voiceInput,
        isProcessing
      }
    }))
  },

  setAudioLevel: (level: number) => {
    chatStore.setState((state) => ({
      ...state,
      voiceInput: {
        ...state.voiceInput,
        audioLevel: level
      }
    }))
  },

  setVoiceOutputEnabled: (enabled: boolean) => {
    chatStore.setState((state) => ({
      ...state,
      voiceOutput: {
        ...state.voiceOutput,
        isEnabled: enabled
      }
    }))
  },

  setVoiceSpeaking: (isSpeaking: boolean) => {
    chatStore.setState((state) => ({
      ...state,
      voiceOutput: {
        ...state.voiceOutput,
        isSpeaking
      }
    }))
  },

  // Settings actions
  updateSettings: (settings: Partial<ChatState['settings']>) => {
    chatStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        ...settings
      }
    }))
  },

  // Analytics actions
  updateAnalytics: (analytics: Partial<ChatState['analytics']>) => {
    chatStore.setState((state) => ({
      ...state,
      analytics: {
        ...state.analytics,
        ...analytics
      }
    }))
  },

  addResponseTime: (time: number) => {
    chatStore.setState((state) => ({
      ...state,
      analytics: {
        ...state.analytics,
        responseTimeHistory: [time, ...state.analytics.responseTimeHistory.slice(0, 99)]
      }
    }))
  },

  // Reset actions
  reset: () => {
    chatStore.setState(initialState)
  },

  resetCurrentSession: () => {
    chatStore.setState((state) => ({
      ...state,
      messages: [],
      input: '',
      streaming: {
        isStreaming: false,
        streamingMessageId: null,
        currentChunk: '',
        totalChunks: 0,
        chunksReceived: 0
      },
      error: null,
      selectedMessageIds: [],
      editingMessageId: null,
      replyToMessageId: null
    }))
  }
}

// Common selectors for chat state
export const chatSelectors = {
  // Session selectors
  currentSessionId: (state: ChatState) => state.currentSessionId,
  currentSession: (state: ChatState) => 
    state.currentSessionId ? state.sessions[state.currentSessionId] : null,
  sessions: (state: ChatState) => Object.values(state.sessions),
  filteredSessions: (state: ChatState) => {
    let sessions = Object.values(state.sessions)

    // Apply search filter
    if (state.searchQuery) {
      sessions = sessions.filter(session =>
        session.title.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        session.messages.some(msg => 
          msg.content.toLowerCase().includes(state.searchQuery.toLowerCase())
        )
      )
    }

    // Apply status filter
    switch (state.sessionFilter) {
      case 'recent':
        sessions = sessions.filter(session => {
          const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
          return session.updatedAt > dayAgo
        })
        break
      case 'archived':
        sessions = sessions.filter(session => session.archived)
        break
      case 'all':
      default:
        sessions = sessions.filter(session => !session.archived)
    }

    // Sort by updated date
    return sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  },

  // Message selectors
  messages: (state: ChatState) => state.messages,
  input: (state: ChatState) => state.input,
  lastMessage: (state: ChatState) => state.messages[state.messages.length - 1],
  messageCount: (state: ChatState) => state.messages.length,
  hasMessages: (state: ChatState) => state.messages.length > 0,

  // Streaming selectors
  isStreaming: (state: ChatState) => state.streaming.isStreaming,
  streamingMessage: (state: ChatState) => 
    state.streaming.streamingMessageId 
      ? state.messages.find(m => m.id === state.streaming.streamingMessageId)
      : null,

  // Loading and error selectors
  isLoading: (state: ChatState) => state.isLoading,
  isConnecting: (state: ChatState) => state.isConnecting,
  isReconnecting: (state: ChatState) => state.isReconnecting,
  error: (state: ChatState) => state.error,
  connectionError: (state: ChatState) => state.connectionError,
  hasError: (state: ChatState) => !!state.error || !!state.connectionError,

  // Context selectors
  context: (state: ChatState) => state.context,
  hasContext: (state: ChatState) => !!state.context,

  // UI selectors
  isChatOpen: (state: ChatState) => state.isChatOpen,
  isChatMinimized: (state: ChatState) => state.isChatMinimized,
  chatPosition: (state: ChatState) => state.chatPosition,
  chatSize: (state: ChatState) => state.chatSize,

  // Scroll selectors
  isAutoScrollEnabled: (state: ChatState) => state.isAutoScrollEnabled,
  shouldScrollToBottom: (state: ChatState) => state.shouldScrollToBottom,
  isAtBottom: (state: ChatState) => state.isAtBottom,

  // Selection selectors
  selectedMessageIds: (state: ChatState) => state.selectedMessageIds,
  selectedMessages: (state: ChatState) => 
    state.messages.filter(msg => state.selectedMessageIds.includes(msg.id)),
  hasSelectedMessages: (state: ChatState) => state.selectedMessageIds.length > 0,
  editingMessageId: (state: ChatState) => state.editingMessageId,
  replyToMessageId: (state: ChatState) => state.replyToMessageId,

  // Voice selectors
  isRecording: (state: ChatState) => state.voiceInput.isRecording,
  isProcessingVoice: (state: ChatState) => state.voiceInput.isProcessing,
  audioLevel: (state: ChatState) => state.voiceInput.audioLevel,
  isVoiceEnabled: (state: ChatState) => state.voiceOutput.isEnabled,
  isSpeaking: (state: ChatState) => state.voiceOutput.isSpeaking,

  // Settings selectors
  settings: (state: ChatState) => state.settings,
  theme: (state: ChatState) => state.settings.theme,
  fontSize: (state: ChatState) => state.settings.fontSize,

  // Analytics selectors
  analytics: (state: ChatState) => state.analytics,
  averageResponseTime: (state: ChatState) => {
    const times = state.analytics.responseTimeHistory
    return times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0
  }
}

