// AIDEV-NOTE: Agent domain entity
// Represents an AI agent with capabilities, tools, and trigger configuration
// Uses DDD Value Objects for type-safe identity management

import type { TriggerConfig } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import { TriggerConfigFromJSON } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import {
  AgentId,
  OrganizationId,
  UserId,
  AgentStatus,
  ApiKey
} from '@/ddd/domain/shared/value-objects';
import type { AvatarConfig } from '@/lib/avatars';
import type { AgentPlan } from '@/ddd/domain/agents/types/plan';

// Domain-specific configuration types for Agent

/**
 * Maps trigger payload fields to skill inputs
 * Used to extract data from trigger events and pass to skill execution
 */
export interface AutomationInputMapping {
  triggerField: string;              // Path in trigger payload: "data.from", "rowData.email"
  skillInputName: string;            // Skill input name to map to
}

/**
 * Automation Configuration
 * Combines trigger (WHEN) with skill reference (WHAT)
 *
 * AIDEV-NOTE: Replaces old ScheduleConfiguration
 * - Skills determine HOW to execute (agent, operation, tool, write)
 * - Automations just wire up triggers to skills with input mappings
 */
export interface AutomationConfiguration {
  trigger: TriggerConfig;              // WHEN to execute
  skillId: number;                     // Reference to skill (WHAT to execute)
  inputMappings?: AutomationInputMapping[]; // Map trigger payload → skill inputs
  enabled: boolean;
  name?: string;                       // Descriptive name (e.g., "Sync Gmail to Table")
  description?: string;                // Optional description
}

/**
 * JSON representation of AutomationInputMapping for database persistence
 */
export interface AutomationInputMappingJSON {
  triggerField: string;
  skillInputName: string;
}

/**
 * JSON representation of AutomationConfiguration for database persistence
 * Plain JSON structure with all Value Objects converted to primitives
 */
export interface AutomationConfigurationJSON {
  trigger: {
    type: string;
    enabled: boolean;
    description?: string;
    // Calendar trigger fields
    rrule?: string;
    timezone?: string;
    startDate?: string;
    endDate?: string;
    // Database event trigger fields
    operations?: string[];
    tableId?: string;
    conditions?: Record<string, any>;
    // Webhook trigger fields
    webhookSecret?: string;
    allowedOrigins?: string[];
    requiresSignature?: boolean;
    // Pipedream event trigger fields (NEW)
    connectionId?: string;
    triggerType?: string;
    props?: Record<string, any>;
    pipedreamSourceId?: string;
    pipedreamWebhookId?: string;
    pipedreamSubscriptionId?: string;
  };
  skillId: number;
  inputMappings?: AutomationInputMappingJSON[];
  enabled: boolean;
  name?: string;
  description?: string;
}

export interface Agent {
  id: AgentId;                                // DDD Value Object for type safety
  name: string;
  role: string;                               // required with default 'assistant'
  description: string;                        // required with default ''
  persona: string;                            // required with default ''
  automations: AutomationConfiguration[];     // array of automation configurations (0 to many)
  databaseId?: string | null;                 // optional - can be null
  status: AgentStatus;                        // required with default 'active'
  organizationId: OrganizationId;             // DDD Value Object for type safety
  ownerId: UserId;                            // DDD Value Object for type safety - used for OAuth resolution via proxy
  apiKey?: ApiKey | null;                     // Stores hash (not plaintext)
  apiKeyPrefix?: string | null;              // First 12 chars for display
  previousApiKeyHash?: string | null;
  previousApiKeyExpiresAt?: Date | null;
  webhookToken?: string | null;               // For webhook authentication (Pipedream, etc.)
  defaultModel?: string | null;               // AI model override for this agent
  avatarConfig?: AvatarConfig | null;         // Avatar configuration with icon + color (versioned JSON)
  // Plan file - generated detailed execution plan for orchestration
  plan?: AgentPlan | null;
  planGeneratedAt?: Date | null;
  planApprovedAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// Persistence record type for database operations
export interface AgentPersistenceRecord {
  id: number;
  name: string;
  role: string;
  description: string;
  persona: string;
  automations: AutomationConfigurationJSON[];
  databaseId?: string | null;
  status: string;
  organizationId: number;
  ownerId: string;
  apiKeyHash?: string | null;
  apiKeyPrefix?: string | null;
  previousApiKeyHash?: string | null;
  previousApiKeyExpiresAt?: Date | null;
  webhookToken?: string | null;
  defaultModel?: string | null;
  avatarConfig?: AvatarConfig | null;
  plan?: AgentPlan | null;
  planGeneratedAt?: Date | null;
  planApprovedAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// Static factory pattern for creating Agent from persistence
export class AgentFactory {
  static fromPersistence(record: AgentPersistenceRecord): Agent {
    return {
      id: AgentId.fromNumber(record.id),
      name: record.name,
      role: record.role,
      description: record.description,
      persona: record.persona,
      automations: (record.automations || []).map((a: AutomationConfigurationJSON) => ({
        trigger: TriggerConfigFromJSON(a.trigger),
        skillId: a.skillId,
        inputMappings: a.inputMappings?.map((m: AutomationInputMappingJSON) => ({
          triggerField: m.triggerField,
          skillInputName: m.skillInputName
        })),
        enabled: a.enabled !== false,
        name: a.name,
        description: a.description
      })),
      databaseId: record.databaseId,
      status: AgentStatus.fromString(record.status),
      organizationId: OrganizationId.fromNumber(record.organizationId),
      ownerId: UserId.fromString(record.ownerId),
      apiKey: record.apiKeyHash ? ApiKey.fromString(record.apiKeyHash) : null,
      apiKeyPrefix: record.apiKeyPrefix || null,
      previousApiKeyHash: record.previousApiKeyHash || null,
      previousApiKeyExpiresAt: record.previousApiKeyExpiresAt || null,
      webhookToken: record.webhookToken || null,
      defaultModel: record.defaultModel || null,
      avatarConfig: record.avatarConfig || null,
      plan: record.plan || null,
      planGeneratedAt: record.planGeneratedAt || null,
      planApprovedAt: record.planApprovedAt || null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  static toPersistence(agent: Agent): AgentPersistenceRecord {
    return {
      id: agent.id.value,
      name: agent.name,
      role: agent.role,
      description: agent.description,
      persona: agent.persona,
      automations: agent.automations.map(automation => ({
        trigger: automation.trigger.toJSON() as AutomationConfigurationJSON['trigger'],
        skillId: automation.skillId,
        inputMappings: automation.inputMappings?.map(m => ({
          triggerField: m.triggerField,
          skillInputName: m.skillInputName
        })),
        enabled: automation.enabled,
        name: automation.name,
        description: automation.description
      })),
      databaseId: agent.databaseId,
      status: agent.status.value,
      organizationId: agent.organizationId.value,
      ownerId: agent.ownerId.value,
      apiKeyHash: agent.apiKey?.value || null,
      apiKeyPrefix: agent.apiKeyPrefix || null,
      previousApiKeyHash: agent.previousApiKeyHash || null,
      previousApiKeyExpiresAt: agent.previousApiKeyExpiresAt || null,
      webhookToken: agent.webhookToken || null,
      defaultModel: agent.defaultModel || null,
      avatarConfig: agent.avatarConfig || null,
      plan: agent.plan || null,
      planGeneratedAt: agent.planGeneratedAt || null,
      planApprovedAt: agent.planApprovedAt || null,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt
    };
  }
}

export interface CreateAgentData {
  name: string;
  role?: string;                              // defaults to 'assistant'
  description?: string;                       // defaults to ''
  persona?: string;                           // defaults to ''
  automations?: AutomationConfiguration[];    // array of automations (defaults to [])
  databaseId?: string;
  status?: AgentStatus;                       // defaults to 'active'
  organizationId?: OrganizationId;            // Set by application layer from session
  ownerId?: UserId;                           // Set by application layer from session - used for OAuth resolution
  avatarConfig?: AvatarConfig | null;         // Avatar configuration with icon + color (versioned JSON)
}

export interface UpdateAgentData {
  name?: string;
  role?: string;
  description?: string;
  persona?: string;
  ownerId?: UserId;
  automations?: AutomationConfiguration[];    // Automations (trigger + skill reference)
  databaseId?: string;
  status?: AgentStatus;
  apiKeyHash?: string;
  apiKeyPrefix?: string;
  previousApiKeyHash?: string | null;
  previousApiKeyExpiresAt?: Date | null;
  avatarConfig?: AvatarConfig | null;  // Avatar configuration with icon + color (versioned JSON)
  defaultModel?: string | null;  // AI model override for this agent
  // Note: organizationId typically not changed after creation
}

// AIDEV-NOTE: Agent status constants moved to Value Object
// Import AgentStatus and AGENT_STATUS from shared value-objects

// Default agent roles
export const AGENT_ROLES = {
  ASSISTANT: 'assistant',
  ANALYST: 'analyst', 
  EXECUTOR: 'executor',
  MONITOR: 'monitor',
  COORDINATOR: 'coordinator'
} as const;

export type AgentRole = typeof AGENT_ROLES[keyof typeof AGENT_ROLES];

// Helper functions for working with agents
export const isActiveAgent = (agent: Agent): boolean => {
  return agent.status.isActive();
};

export const getAgentDisplayName = (agent: Agent): string => {
  return agent.role !== 'assistant' ? `${agent.name} (${agent.role})` : agent.name;
};

export const getAutomationsCount = (agent: Agent): number => {
  return agent.automations?.length || 0;
};

// Default values for agent creation - ensures all required fields have defaults
export const createAgentDefaults = (data: CreateAgentData): Omit<CreateAgentData, 'organizationId' | 'ownerId'> & {
  role: string;
  description: string;
  persona: string;
  automations: AutomationConfiguration[];
  status: AgentStatus;
  organizationId?: OrganizationId;
  ownerId?: UserId;
} => {
  const role: string = data.role || AGENT_ROLES.ASSISTANT;
  const description: string = data.description || '';
  const persona: string = data.persona || '';

  return {
    name: data.name,
    role,
    description,
    persona,
    automations: data.automations || [],
    status: data.status || AgentStatus.active(),
    organizationId: data.organizationId, // Should be provided by application layer
    ownerId: data.ownerId, // Should be provided by application layer - used for OAuth resolution
    databaseId: data.databaseId,
  };
};