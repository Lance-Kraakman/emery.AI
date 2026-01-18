/**
 * Shared Hooks for Skill Components
 *
 * Reusable hooks for agentic components (AgenticSkillEditor, AgenticConfig)
 */

export {
  useSkillAttachments,
  type SkillAttachment,
} from './useSkillAttachments';

export {
  useChatVariables,
  inputsToChatVariables,
  dataSourcesToChatVariables,
  workflowVariablesToChatVariables,
  type ChatVariable,
} from './useChatVariables';
