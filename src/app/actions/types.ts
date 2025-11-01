// AIDEV-NOTE: Application Layer DTOs - Commands and types for Server Actions
// Re-exports domain types and defines application-specific command interfaces
import { FieldType } from '@/ddd/domain/tables/value-objects/table-field';
import type { Result } from '@/ddd/domain/shared/result';
import type { Row } from '@/ddd/domain/tables/value-objects/row';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';

// Export the unified Result interface for use in Server Actions
export type { Result } from '@/ddd/domain/shared/result';



export interface CreateTableData {
  name: string;
}

export interface CreateFieldData {
  tableId: number;
  name: string;
  slug?: string;
  type: FieldType;
  required?: boolean;
  orderIndex?: number;
  relatedTableId?: number;
}

// Application-specific command DTOs (not domain types)
export interface CreateRowCommand {
  tableId: number;                    // Infrastructure concern
  data: Record<string, any>;          // Plain data from client (converted to Row entity in action)
}

export interface UpdateRowCommand {
  rowId: string;                      // Infrastructure concern
  tableId: number;                    // Infrastructure concern
  data: Record<string, any>;          // Plain data from client (converted to Row entity in action)
}

export interface CreateOrganizationData {
  name: string;
  mission?: string;
}

export interface CreateRoleData {
  name: string;
  permissions: string[];
  organizationId: number;
}

export interface UpdateRoleData {
  id: number;
  name?: string;
  permissions?: string[];
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  roleId?: number;
}

export interface CreateTeamData {
  organizationId: number;
  name: string;
  purpose?: string;
  description?: string;
  responsibilities?: string[];
  goals?: string[];
  agentIds?: string[];
}

// Client-side team data interface for server actions (using plain serializable types)
export interface CreateTeamClientData {
  organizationId: number;
  name: string;
  purpose?: string;
  description?: string;
  responsibilities?: string[];
  goals?: string[];
  agentIds?: string[];
}

// UI-specific agent data interface (uses plain types, not Value Objects)
export interface CreateAgentFormData {
  name: string;
  role?: string;
  description?: string;
  persona?: string;
  tools?: any[];
  capabilities?: any[];
  status?: string; // Plain string, not AgentStatus Value Object
  trigger?: any;
}

// AIDEV-NOTE: Import DTO types from agent mapper (following ToolMapper pattern)
// These DTOs use plain serializable types that can pass through Next.js Server Actions
import type { ToolConfigDTO } from '@/app/mappers/agent-mapper';

// AIDEV-NOTE: Re-export CreateAgentDTO from consolidated DTOs
// CreateAgentClientData is now an alias for CreateAgentDTO
export type { CreateAgentDTO as CreateAgentClientData } from '@/app/dtos/agent.dto';

// Import agent types from domain layer
export type {
  CreateAgentData
} from '@/ddd/domain/agents/entities/agent';

// Import tool types from tools domain
export type { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';

// Import task types from domain layer
import type { TaskInstructions } from '@/ddd/domain/tasks/entities/task';

export type {
  TaskStatus,
  TaskInstructions
} from '@/ddd/domain/tasks/entities/task';

// Import the proper DTO type for frontend use
export type { TaskDTO as Task } from '@/app/mappers/task-mapper';

// Server Action interface for task creation (uses primitives, converted to Value Objects in Application layer)
export interface CreateTaskData {
  agentId: number;
  name: string;
  skillName?: string;
  instructions: TaskInstructions;
  createdBy?: string;
}

// CreateRoleData moved to domain entities: @/lib/domain/entities/role

export interface TeamMembershipData {
  teamId: number;
  userId: string;
}

// Data Source types
export interface CreateViewData {
  tableId: number;
  name: string;
  description?: string;
  fieldMappings?: Array<{
    sourceFieldId: number;
    displayName: string;
    visible: boolean;
    order: number;
  }>;
  viewType?: any; // ViewType Value Object
  viewConfig?: any; // ViewConfig Value Object
}

export interface UpdateViewData {
  id: number;
  name?: string;
  description?: string;
  filters?: Array<{
    fieldId: number;
    operator: string;
    value: string;
  }>;
  sorting?: Array<{
    fieldId: number;
    direction: "asc" | "desc";
    priority: number;
  }>;
  pagination?: {
    pageSize: number;
    offset?: number;
  };
  fieldMappings?: Array<{
    sourceFieldId: number;
    displayName: string;
    visible: boolean;
    order: number;
  }>;
}

