/**
 * S3 Path Registry — Single source of truth for all S3 key patterns.
 *
 * Every service that constructs or parses S3 keys should import from here
 * instead of hardcoding path patterns. This ensures the storage calculator
 * scans exactly the same prefixes that writers create.
 *
 * Bucket layout:
 *   org_{orgId}/                                       → database storage (tables, files)
 *     db_{dbId}/table_{tableId}/                       → delta-lake table data
 *     table_{tableId}/field_{fieldId}/{fileId}_{name}  → legacy file uploads
 *   chat-attachments/{orgId}/{chatId}/{msgId}/{uuid}.{ext}
 *   skill-attachments/{orgId}/{skillId}/{uuid}.{ext}
 *   task-attachments/{orgId}/{agentId}/{uuid}.{ext}
 *   workspaces/{orgId}/
 *     agents/{agentId}.tar.gz
 *     users/{userId}.tar.gz
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StorageCategory = 'database' | 'chat' | 'skill' | 'workspace';

export interface OrgStoragePrefixes {
  /** org_{id}/ — tables, files, delta-lake data */
  database: string;
  /** chat-attachments/{id}/ — chat message attachments */
  chat: string;
  /** skill-attachments/{id}/ — skill attachments */
  skill: string;
}

// ---------------------------------------------------------------------------
// Prefix constants (shared with Python via convention — see workspace_sync.py)
// ---------------------------------------------------------------------------

export const WORKSPACES_PREFIX = 'workspaces';
export const CHAT_ATTACHMENTS_PREFIX = 'chat-attachments';
export const SKILL_ATTACHMENTS_PREFIX = 'skill-attachments';
export const TASK_ATTACHMENTS_PREFIX = 'task-attachments';

// ---------------------------------------------------------------------------
// Org-scoped prefixes
// ---------------------------------------------------------------------------

/**
 * Returns the S3 prefixes that contain data owned by an organization.
 * The storage calculator must scan all of these to get an accurate total.
 */
export function getOrgPrefixes(organizationId: number): OrgStoragePrefixes {
  return {
    database: `org_${organizationId}/`,
    chat: `${CHAT_ATTACHMENTS_PREFIX}/${organizationId}/`,
    skill: `${SKILL_ATTACHMENTS_PREFIX}/${organizationId}/`,
  };
}

/**
 * Returns the task-attachments prefix for an organization.
 * Separate from OrgStoragePrefixes because task attachments are counted
 * as database storage (no dedicated StorageCategory).
 */
export function getTaskAttachmentPrefix(organizationId: number): string {
  return `${TASK_ATTACHMENTS_PREFIX}/${organizationId}/`;
}

// ---------------------------------------------------------------------------
// Key builders — used by writers
// ---------------------------------------------------------------------------

/** org_{orgId}/db_{dbId}/table_{tableId}/ */
export function getTableDataPrefix(
  organizationId: number,
  databaseId: number,
  tableId: number,
): string {
  return `org_${organizationId}/db_${databaseId}/table_${tableId}/`;
}

/** org_{orgId}/table_{tableId}/field_{fieldId}/{fileId}_{sanitizedFilename} */
export function getDatabaseFileKey(
  organizationId: number,
  tableId: number,
  fieldId: number,
  fileId: string,
  sanitizedFilename: string,
): string {
  return `org_${organizationId}/table_${tableId}/field_${fieldId}/${fileId}_${sanitizedFilename}`;
}

/** chat-attachments/{orgId}/{chatId}/{msgId}/{fileId}.{ext} */
export function getChatAttachmentKey(
  organizationId: number,
  chatId: string,
  messageId: string,
  fileId: string,
  sanitizedExt: string,
): string {
  return `${CHAT_ATTACHMENTS_PREFIX}/${organizationId}/${chatId}/${messageId}/${fileId}.${sanitizedExt}`;
}

/** skill-attachments/{orgId}/{skillId}/{fileId}.{ext} */
export function getSkillAttachmentKey(
  organizationId: number,
  skillId: number,
  fileId: string,
  sanitizedExt: string,
): string {
  return `${SKILL_ATTACHMENTS_PREFIX}/${organizationId}/${skillId}/${fileId}.${sanitizedExt}`;
}

/** task-attachments/{orgId}/{agentId}/{fileId}.{ext} */
export function getTaskAttachmentKey(
  organizationId: number,
  agentId: number,
  fileId: string,
  sanitizedExt: string,
): string {
  return `${TASK_ATTACHMENTS_PREFIX}/${organizationId}/${agentId}/${fileId}.${sanitizedExt}`;
}

/** workspaces/{orgId}/ — prefix for ListObjectsV2 scanning */
export function getWorkspacePrefix(organizationId: number): string {
  return `${WORKSPACES_PREFIX}/${organizationId}/`;
}

/** workspaces/{orgId}/agents/{agentId}.tar.gz */
export function getAgentWorkspaceKey(organizationId: number, agentId: number): string {
  return `${WORKSPACES_PREFIX}/${organizationId}/agents/${agentId}.tar.gz`;
}

/** workspaces/{orgId}/users/{userId}.tar.gz */
export function getUserWorkspaceKey(organizationId: number, userId: string): string {
  return `${WORKSPACES_PREFIX}/${organizationId}/users/${userId}.tar.gz`;
}

// ---------------------------------------------------------------------------
// Key classifiers — used by the storage calculator
// ---------------------------------------------------------------------------

/**
 * Classify any S3 key into a storage category.
 *
 * Handles all known prefix patterns:
 *   org_{id}/...                 → 'database'
 *   chat-attachments/{id}/...   → 'chat'
 *   skill-attachments/{id}/...  → 'skill'
 *   task-attachments/{id}/...   → 'database' (counted with database storage)
 *   workspaces/...              → 'workspace'
 */
export function categorizeS3Key(key: string): StorageCategory {
  if (key.startsWith(`${CHAT_ATTACHMENTS_PREFIX}/`)) return 'chat';
  if (key.startsWith(`${SKILL_ATTACHMENTS_PREFIX}/`)) return 'skill';
  if (key.startsWith('workspaces/')) return 'workspace';
  // task-attachments and org_{id}/ both count as database storage
  return 'database';
}

/**
 * Extract the organization ID from an S3 key when the key encodes it directly.
 *
 * All key patterns now include the org ID:
 *   org_{id}/...                       → database
 *   chat-attachments/{id}/...          → chat
 *   skill-attachments/{id}/...         → skill
 *   task-attachments/{id}/...          → database
 *   workspaces/{id}/agents/...         → workspace
 *   workspaces/{id}/users/...          → workspace
 */
export function extractOrgIdFromKey(key: string): number | null {
  // chat-attachments/{orgId}/...
  const chatMatch = key.match(new RegExp(`^${CHAT_ATTACHMENTS_PREFIX}/(\\d+)/`));
  if (chatMatch) return parseInt(chatMatch[1], 10);

  // skill-attachments/{orgId}/...
  const skillMatch = key.match(new RegExp(`^${SKILL_ATTACHMENTS_PREFIX}/(\\d+)/`));
  if (skillMatch) return parseInt(skillMatch[1], 10);

  // task-attachments/{orgId}/...
  const taskMatch = key.match(new RegExp(`^${TASK_ATTACHMENTS_PREFIX}/(\\d+)/`));
  if (taskMatch) return parseInt(taskMatch[1], 10);

  // workspaces/{orgId}/...
  const wsMatch = key.match(new RegExp(`^${WORKSPACES_PREFIX}/(\\d+)/`));
  if (wsMatch) return parseInt(wsMatch[1], 10);

  // org_{orgId}/...
  const orgMatch = key.match(/^org_(\d+)\//);
  if (orgMatch) return parseInt(orgMatch[1], 10);

  return null;
}
