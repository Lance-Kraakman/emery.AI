import type { Agent } from '@/ddd/domain/agents/entities/agent';
import { TriggerConfig } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import { ScheduleMapper } from './schedule-mapper';
import type { ScheduleConfigurationDTO } from '@/app/dtos/schedule.dto';

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
  schedules: ScheduleConfigurationDTO[];
  databaseId?: string | null;
  status: string;
  organizationId: number;
  ownerId: string; // Used for OAuth resolution via proxy
  apiKey?: string | null;
  defaultModel?: string | null; // AI model override for this agent
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
      // Use ScheduleMapper to convert ScheduleConfiguration to ScheduleConfigurationDTO
      schedules: agent.schedules.map(schedule => ScheduleMapper.toDTO(schedule)),
      databaseId: agent.databaseId,
      status: agent.status.value,
      organizationId: agent.organizationId.value,
      ownerId: agent.ownerId.value,
      apiKey: agent.apiKey?.value || null,
      defaultModel: agent.defaultModel || null,
      // Convert Date objects to ISO strings for server component serialization
      createdAt: agent.createdAt ? agent.createdAt.toISOString() : null,
      updatedAt: agent.updatedAt ? agent.updatedAt.toISOString() : null
    };
  }
}