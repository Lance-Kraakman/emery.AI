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
 *   workspaces/
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

export const WORKSPACE_AGENTS_PREFIX = 'workspaces/agents';
export const WORKSPACE_USERS_PREFIX = 'workspaces/users';
export const CHAT_ATTACHMENTS_PREFIX = 'chat-attachments';
export const SKILL_ATTACHMENTS_PREFIX = 'skill-attachments';

// ---------------------------------------------------------------------------
// Org-scoped prefixes
// ---------------------------------------------------------------------------

/**
 * Returns the three S3 prefixes that contain data owned by an organization.
 * The storage calculator must scan all three to get an accurate total.
 */
export function getOrgPrefixes(organizationId: number): OrgStoragePrefixes {
  return {
    database: `org_${organizationId}/`,
    chat: `${CHAT_ATTACHMENTS_PREFIX}/${organizationId}/`,
    skill: `${SKILL_ATTACHMENTS_PREFIX}/${organizationId}/`,
  };
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

/** workspaces/agents/{agentId}.tar.gz */
export function getAgentWorkspaceKey(agentId: number): string {
  return `${WORKSPACE_AGENTS_PREFIX}/${agentId}.tar.gz`;
}

/** workspaces/users/{userId}.tar.gz */
export function getUserWorkspaceKey(userId: string): string {
  return `${WORKSPACE_USERS_PREFIX}/${userId}.tar.gz`;
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
 *   workspaces/...              → 'workspace'
 */
export function categorizeS3Key(key: string): StorageCategory {
  if (key.startsWith(`${CHAT_ATTACHMENTS_PREFIX}/`)) return 'chat';
  if (key.startsWith(`${SKILL_ATTACHMENTS_PREFIX}/`)) return 'skill';
  if (key.startsWith('workspaces/')) return 'workspace';
  // Everything under org_{id}/ (tables, files, delta-lake) is database storage
  return 'database';
}

/**
 * Extract the organization ID from an S3 key when the key encodes it directly.
 *
 * Returns `null` for workspace keys (workspaces/agents/{agentId}.tar.gz)
 * because those require a DB lookup to resolve the owning organization.
 */
export function extractOrgIdFromKey(key: string): number | null {
  // chat-attachments/{orgId}/...
  const chatMatch = key.match(new RegExp(`^${CHAT_ATTACHMENTS_PREFIX}/(\\d+)/`));
  if (chatMatch) return parseInt(chatMatch[1], 10);

  // skill-attachments/{orgId}/...
  const skillMatch = key.match(new RegExp(`^${SKILL_ATTACHMENTS_PREFIX}/(\\d+)/`));
  if (skillMatch) return parseInt(skillMatch[1], 10);

  // org_{orgId}/...
  const orgMatch = key.match(/^org_(\d+)\//);
  if (orgMatch) return parseInt(orgMatch[1], 10);

  // workspaces/ — no org ID in the key
  return null;
}
