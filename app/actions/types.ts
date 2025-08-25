// AIDEV-NOTE: Shared types for Server Actions - ensures type safety across actions
// Uses unified Result<T> interface from DDD domain layer for consistent error handling
import type { Result } from '@/ddd/domain/shared/result';

// Export the unified Result interface for use in Server Actions
export type { Result } from '@/ddd/domain/shared/result';

export type FieldType = 'text' | 'number' | 'boolean' | 'email' | 'url' | 'date' | 'relation' | 'file';

export interface Field {
  id: number;
  tableId: number;
  name: string;
  slug: string;
  type: FieldType;
  orderIndex: number | null | undefined;
  relatedTableId: number | null;
  required: boolean | null;
  createdAt: Date | null;
}

export interface Row {
  id: string;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

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

export interface CreateRowData {
  tableId: number;
  data: Record<string, any>;
}

export interface UpdateRowData {
  rowId: string;
  tableId: number;
  data: Record<string, any>;
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

export interface CreateDynamicTableData {
  name: string;
  dbName: string;
  databaseId: number;
  organizationId: number;
  createdBy: string;
  metadata?: any;
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

// Import agent types from domain layer
export type {
  ToolConfig,
  ServerConfig,
  StepConfig,
  CapabilityConfig,
  CreateAgentData
} from '@/ddd/domain/agents/entities/agent';

export type { TriggerConfig } from '@/ddd/domain/scheduling/value-objects/trigger-config';

// Import task types from domain layer
import type { TaskInstructions } from '@/ddd/domain/agents/entities/task';

export type {
  TaskStatus,
  TaskInstructions,
  TaskConfig as Task
} from '@/ddd/domain/agents/entities/task';

// Server Action interface for task creation (uses primitives, converted to Value Objects in Application layer)
export interface CreateTaskData {
  agentId: number;
  name: string;
  capabilityName?: string;
  instructions: TaskInstructions;
  createdBy?: string;
}

// CreateRoleData moved to domain entities: @/lib/domain/entities/role

export interface TeamMembershipData {
  teamId: number;
  userId: string;
}

