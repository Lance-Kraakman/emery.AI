/**
 * Agent DTOs - Single source of truth for agent data transfer
 * Used by: Server Actions, Application Services, Client Components
 *
 * AIDEV-NOTE: Consolidated DTOs replacing separate Command/ClientData interfaces
 * Re-exports AgentDTO from mapper to avoid duplication
 */

import type { ToolConfigDTO, AgentDTO as AgentDTOFromMapper } from '@/app/mappers/agent-mapper';
import type { ScheduleConfigurationDTO } from './schedule.dto';

// Re-export the canonical AgentDTO from mapper
export type AgentDTO = AgentDTOFromMapper;
export type { ToolConfigDTO };

/**
 * DTO for creating a new agent
 * Used by both client and application layer
 * AIDEV-NOTE: Tools are defined per-task (skills/schedules/chat), not per-agent
 * OAuth credentials resolved via agent.ownerId through proxy
 */
export interface CreateAgentDTO {
  name: string;
  role?: string;
  description?: string;
  persona?: string;
  ownerId?: string; // User ID string - converted to UserId Value Object in application layer - used for OAuth resolution
  organizationId?: number; // Organization ID - converted to OrganizationId Value Object in application layer
  schedules?: ScheduleConfigurationDTO[]; // Schedules with task instructions
  status?: 'active' | 'inactive' | 'archived';
}

/**
 * DTO for updating an existing agent
 * All fields optional except id
 */
export interface UpdateAgentDTO {
  id: number; // Agent ID - converted to AgentId Value Object in application layer
  name?: string;
  role?: string;
  description?: string;
  persona?: string;
  ownerId?: string;
  schedules?: ScheduleConfigurationDTO[]; // Schedules with task instructions
  status?: 'active' | 'inactive' | 'archived';
}

/**
 * DTO for filtering agents
 */
export interface AgentFiltersDTO {
  teamId?: number | string;
  searchQuery?: string;
  organizationId: number;
  status?: 'active' | 'inactive' | 'archived';
}
