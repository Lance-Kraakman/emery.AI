import type { Agent } from '@/ddd/domain/agents/entities/agent';
import { AutomationMapper } from './automation-mapper';
import type { AutomationConfigurationDTO } from '@/app/dtos/automation.dto';
import type { AvatarConfig } from '@/lib/avatars';

// AIDEV-NOTE: Serializable DTO types following the ToolMapper pattern
// ToolConfig class instances cannot be serialized by Next.js Server Actions
// We serialize to plain objects with name + config, matching ToolDTO pattern

export interface ToolConfigDTO {
  name: string;
  config: Record<string, any>;
}

export interface AgentDTO {
  id: number;
  name: string;
  role: string;
  description: string;
  persona: string;
  automations: AutomationConfigurationDTO[];
  databaseId?: string | null;
  status: string;
  organizationId: number;
  ownerId: string; // Used for OAuth resolution via proxy
  apiKeyPrefix?: string | null; // First 12 chars of API key (hash stored, never exposed)
  hasApiKey?: boolean; // Whether agent has an API key configured
  defaultModel?: string | null; // AI model override for this agent
  allowNetwork: boolean; // Network access for bash commands (git, curl, wget)
  avatarConfig?: AvatarConfig | null; // Avatar configuration with icon + color
  createdAt?: string | null; // ISO string for serialization
  updatedAt?: string | null; // ISO string for serialization
}

export class AgentMapper {
  static toDTO(agent: Agent): AgentDTO {
    return {
      id: agent.id.value,
      name: agent.name,
      role: agent.role,
      description: agent.description,
      persona: agent.persona,
      // Use AutomationMapper to convert AutomationConfiguration to AutomationConfigurationDTO
      automations: agent.automations.map(automation => AutomationMapper.toDTO(automation)),
      databaseId: agent.databaseId,
      status: agent.status.value,
      organizationId: agent.organizationId.value,
      ownerId: agent.ownerId.value,
      apiKeyPrefix: agent.apiKeyPrefix || null,
      hasApiKey: !!agent.apiKey,
      defaultModel: agent.defaultModel || null,
      allowNetwork: agent.allowNetwork,
      avatarConfig: agent.avatarConfig || null,
      // Convert Date objects to ISO strings for server component serialization
      createdAt: agent.createdAt ? agent.createdAt.toISOString() : null,
      updatedAt: agent.updatedAt ? agent.updatedAt.toISOString() : null
    };
  }
}
