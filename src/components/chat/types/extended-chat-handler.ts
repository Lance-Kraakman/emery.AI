import type { ChatHandler, Message } from '@llamaindex/chat-ui'
import type { ToolDTO } from '@/app/mappers/tool-mapper'
import type { ExecutionStep } from '@/ddd/domain/chat/value-objects/execution-step'

/**
 * ChatMessage with ID and metadata support for execution steps
 */
export interface ChatMessage extends Message {
  id: string
  experimental_metadata?: {
    executionSteps?: ExecutionStep[]
  }
}

/**
 * Current step progress information during streaming
 */
export interface CurrentStepProgress {
  type: string
  name: string
  index: number
  content?: string
}

/**
 * Extended ChatHandler interface with Emery-specific functionality
 *
 * Extends LlamaIndex ChatHandler with:
 * - Chat session management (persistence, switching)
 * - Tool selection and management
 * - File attachment handling
 * - Real-time step progress tracking
 * - Message cancellation
 */
export interface ExtendedChatHandler extends ChatHandler {
  // Base ChatHandler required fields
  isLoading: boolean
  messages: ChatMessage[]
  append: (message: Message, attachments?: File[]) => Promise<string>
  setMessages: (messages: ChatMessage[]) => void

  // Chat session management
  scrollRef?: React.RefObject<HTMLDivElement>
  scrollToBottom?: () => void
  clearMessages?: () => void
  currentChatId?: string
  switchToChat?: (chatId: string) => Promise<void>
  createNewChat?: () => Promise<void>

  // Tool management
  selectedTools: ToolDTO[]
  availableTools: ToolDTO[]
  addTool: (tool: ToolDTO) => void
  removeTool: (tool: ToolDTO) => void

  // Attachment management
  pendingAttachments: File[]
  addAttachment: (file: File) => void
  removeAttachment: (index: number) => void
  clearAttachments: () => void

  // Step progress tracking
  currentStep: CurrentStepProgress | null
  streamingSteps: ExecutionStep[]

  // Cancellation
  cancelMessage?: () => Promise<void>
}
