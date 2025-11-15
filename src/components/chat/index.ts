/**
 * Chat components and utilities
 * AIDEV-NOTE: Centralized exports for the chat system components
 */

// Main chat components
export { EmeryChat } from './EmeryChat'
export { ChatCanvas } from './ChatCanvas'
export { useChatGRPC, useChatForPage } from './useChatGRPC'

// Chat Mention System (+ button and @ mentions)
export { ChatPlusButton } from './ChatPlusButton'

// Mention types
export type * from './types/chat-mentions'