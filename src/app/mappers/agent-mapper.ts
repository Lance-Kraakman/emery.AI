import type { Agent, AgentType, AgentSpecialization } from '@/ddd/domain/agents/entities/agent';
import { TriggerConfig } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';

// AIDEV-NOTE: Serializable DTO types following the ToolMapper pattern
// ToolConfig class instances cannot be serialized by Next.js Server Actions
// We serialize to plain objects with name + config, matching ToolDTO pattern

export interface ToolConfigDTO {
  name: string;
  config: Record<string, any>;
}

export interface StepConfigDTO {
  type: 'CODE_STEP' | 'TOOL_STEP';
  instructions: string;
  model?: string;
  tools?: ToolConfigDTO[];
  servers?: any[];
}

export interface SkillConfigDTO {
  name: string;
  description: string;
  steps: StepConfigDTO[];
}

export interface AgentDTO {
  id: number;
  name: string;
  role: string;
  description: string;
  persona: string;
  tools: ToolConfigDTO[];
  servers: any[];
  trigger?: TriggerConfig;
  skills: SkillConfigDTO[];
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
      // Serialize ToolConfig instances to plain DTOs
      tools: agent.tools.map(tool => tool.toPlain()),
      servers: agent.servers,
      trigger: agent.trigger,
      // Serialize skills with nested ToolConfig instances
      skills: agent.skills.map(skill => ({
        name: skill.name,
        description: skill.description,
        steps: skill.steps.map(step => ({
          type: step.type,
          instructions: step.instructions,
          model: step.model,
          // Serialize step tools to plain DTOs
          tools: step.tools?.map(tool =>
            tool instanceof ToolConfig ? tool.toPlain() : tool
          ) || [],
          servers: step.servers
        }))
      })),
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