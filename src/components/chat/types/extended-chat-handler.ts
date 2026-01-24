import type { ChatHandler, Message } from '@llamaindex/chat-ui'
import type { ToolDTO } from '@/app/mappers/tool-mapper'
import type { ExecutionStep } from '@/ddd/domain/chat/value-objects/execution-step'
import type { PlanStepData, InputOption, PermissionRequestEvent } from '@/lib/chat/types/sse-events'

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
 * Pending plan approval state
 */
export interface PendingPlanApproval {
  planId: string
  goal: string
  steps: PlanStepData[]
  estimatedActions?: number
  contextTables?: string[]
  context?: string   // What was discovered (existing databases, tables, etc.)
  analysis?: string  // Analysis/reasoning about what will be done
}

/**
 * Plan execution status
 */
export type PlanExecutionStatus = 'draft' | 'awaiting_approval' | 'approved' | 'executing' | 'completed' | 'failed' | 'cancelled'

/**
 * Active plan execution state
 */
export interface ActivePlanExecution {
  planId: string
  status: PlanExecutionStatus
  currentStepIndex?: number
  completedSteps: number[]
  failedSteps: number[]
  error?: string
}

/**
 * Question from a sub-agent during cascading planning
 */
export interface BatchedQuestion {
  questionId: string
  question: string
  options?: string[]  // For multiple choice
  context?: string    // Why the agent needs this info
}

/**
 * User's answers to batched questions (maps questionId → answer)
 * Sent as JSON to backend for cascade planning resume
 */
export type BatchedQuestionAnswers = Record<string, string>

/**
 * Group of questions from a single agent
 */
export interface QuestionSection {
  agentName: string
  stepId: string
  questions: BatchedQuestion[]
}

/**
 * Awaiting input state for HITL (plan approval or questions)
 *
 * AIDEV-NOTE: Simplified HITL state with just 2 types:
 * - plan_approval: Shows approve/reject buttons (plan content in chat message above)
 * - questions: Shows all clarifying questions with structured UI
 */
export interface AwaitingInputState {
  inputType: 'plan_approval' | 'questions'
  title: string
  content: string
  options: InputOption[]
  planJson?: string
  // For questions input type - structured question data
  questionSections?: QuestionSection[]
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

  // Model selection (for new chats - locked after first message)
  selectedModel?: string
  setModel?: (model: string | undefined) => void

  // Plan approval workflow
  pendingPlanApproval: PendingPlanApproval | null
  activePlanExecution: ActivePlanExecution | null
  approvePlan?: () => Promise<void>
  rejectPlan?: () => Promise<void>

  // Unified HITL awaiting input (plan approval or questions)
  awaitingInput: AwaitingInputState | null
  respondToInput?: (response: string) => Promise<void>

  // Permission request (RBAC errors)
  permissionRequest: PermissionRequestEvent | null
  clearPermissionRequest?: () => void
}
