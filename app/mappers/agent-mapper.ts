import type { Agent, AgentType, AgentSpecialization, CapabilityConfig } from '@/ddd/domain/agents/entities/agent';
import { TriggerConfig } from '@/ddd/domain/scheduling/value-objects/trigger-config';

export interface AgentDTO {
  id: number;
  name: string;
  role: string;
  description: string;
  persona: string;
  tools: any[];
  servers: any[];
  trigger?: TriggerConfig;
  capabilities: CapabilityConfig[];
  databaseId?: string | null;
  status: string;
  organizationId: number;
  ownerId: string;
  apiKey?: string | null;
  agentType?: AgentType;
  specialization?: AgentSpecialization;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export class AgentMapper {
  static toDTO(agent: Agent): AgentDTO {
    return {
      id: agent.id.value,
      name: agent.name,
      role: agent.role,
      description: agent.description,
      persona: agent.persona,
      tools: agent.tools,
      servers: agent.servers,
      trigger: agent.trigger,
      capabilities: agent.capabilities,
      databaseId: agent.databaseId,
      status: agent.status.value,
      organizationId: agent.organizationId.value,
      ownerId: agent.ownerId.value,
      apiKey: agent.apiKey?.value || null,
      agentType: agent.agentType,
      specialization: agent.specialization,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt
    };
  }
}