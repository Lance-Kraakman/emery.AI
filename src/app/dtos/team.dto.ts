/**
 * Team DTOs - Single source of truth for team data transfer
 * Used by: Server Actions, Application Services, Client Components
 *
 * AIDEV-NOTE: Consolidated DTOs replacing separate Command interfaces
 * Following the pattern established in agent.dto.ts
 */

/**
 * DTO for creating a new team
 */
export interface CreateTeamDTO {
  name: string;
  purpose?: string;
  description?: string;
  responsibilities?: string[];
  goals?: string[];
  agentIds?: string[];
  databaseId?: string;
  organizationId: number;
}

/**
 * DTO for updating an existing team
 */
export interface UpdateTeamDTO {
  id: number; // Team ID
  name?: string;
  purpose?: string;
  description?: string;
  responsibilities?: string[];
  goals?: string[];
  agentIds?: string[];
}

/**
 * DTO for filtering teams
 */
export interface TeamFiltersDTO {
  organizationId: number;
  searchQuery?: string;
  hasAgents?: boolean;
}

/**
 * Full team DTO returned from queries
 */
export interface TeamDTO {
  id: number;
  name: string;
  purpose?: string;
  description?: string;
  responsibilities?: string[];
  goals?: string[];
  agentIds?: string[];
  databaseId?: string;
  organizationId: number;
  createdAt?: Date;
  updatedAt?: Date;
}
