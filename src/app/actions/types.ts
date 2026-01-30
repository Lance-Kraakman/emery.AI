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
  metadata?: Record<string, any>;
}

// Application-specific command DTOs (not domain types)
export interface CreateRowCommand {
  tableId: number;                    // Infrastructure concern
  data: Record<string, any>;          // Plain data from client (converted to Row entity in action)
  dataKeyType?: 'name' | 'id';        // Whether data keys are field names or IDs (default: 'name')
}

export interface UpdateRowCommand {
  rowId: string;                      // Infrastructure concern
  tableId: number;                    // Infrastructure concern
  data: Record<string, any>;          // Plain data from client (converted to Row entity in action)
  dataKeyType?: 'name' | 'id';        // Whether data keys are field names or IDs (default: 'name')
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

// Role management types
import type { Role } from "@/ddd/domain/rbac/entities/role";

// Interface for role selection in EntityMultiSelect component
export interface RoleSelectionOption {
  id: number;
  name: string;
  description: string;
  isSystem: boolean;
}

// Extended role interface for UI with additional metadata
export type CustomRole = {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  permissionCount: number;
  userCount: number;
  permissions?: Array<{
    id: number;
    resource: string;
    action: string;
    description: string | null;
  }>;
};

// Result interface for server actions
export interface RoleResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Role creation command interface
export interface CreateRoleCommand {
  name: string;
  description?: string;
  permissionIds: number[]; // Legacy - for backward compatibility
  permissionAssignments?: Array<{
    permissionId: number;
    resourceType?: 'agent' | 'team' | 'user' | null;
    resourceScope: 'all' | 'specific' | 'owned' | 'team';
    resourceIds?: number[];
  }>;
}

// Role update command interface
export interface UpdateRoleCommand {
  id: number;
  name: string;
  description?: string;
  permissionIds: number[]; // Legacy - for backward compatibility
  permissionAssignments?: Array<{
    permissionId: number;
    resourceType?: 'agent' | 'team' | 'user' | null;
    resourceScope: 'all' | 'specific' | 'owned' | 'team';
    resourceIds?: number[];
  }>;
}

export interface TeamMembershipData {
  teamId: number;
  userId: string;
}

// Data Source types
export interface CreateViewData {
  tableId: number;
  name: string;
  description?: string;
  requiresAuth?: boolean; // Whether this view requires authentication (default: true)
  filters?: Array<{
    field: string;
    operator: string;
    value: string | number | boolean | null | Array<string | number | null>;
  }>;
  sorting?: Array<{
    fieldId: number;
    direction: "asc" | "desc";
    priority: number;
  }>;
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
  requiresAuth?: boolean; // Whether this view requires authentication
  filters?: Array<{
    field: string;           // Field name (will be converted to fieldId in action)
    operator: string;
    value: string | number | boolean | null | Array<string | number | null>;
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
  viewConfig?: Record<string, any>;
}

