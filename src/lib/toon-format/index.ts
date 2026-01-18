/**
 * TOON Format for LLM Responses
 *
 * Converts API responses to TOON format for minimal token usage.
 * Supports: ?format=llm (key fields only) or ?format=llm&meta=1 (with metadata)
 */

export { toToon, type ToonConfig } from './formatter';
export { tableToToon, tablesToToon } from './formatters/table';
export { fieldToToon, fieldsToToon } from './formatters/field';
export { databaseToToon, databasesToToon } from './formatters/database';
export { rowToToon, rowsToToon } from './formatters/row';
export { operationToToon, type OperationResult } from './formatters/operation';
export { auditEventToToon, auditEventsToToon } from './formatters/audit';
export { appToToon, appsToToon } from './formatters/app';
export { pageToToon, pagesToToon } from './formatters/page';
export { agentToToon, agentsToToon, type AgentForToon } from './formatters/agent';
export { skillToToon, skillsToToon } from './formatters/skill';
export { withToonFormat } from './middleware';
