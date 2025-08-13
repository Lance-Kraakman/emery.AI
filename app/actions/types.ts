// AIDEV-NOTE: Shared types for Server Actions - ensures type safety across actions
export interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface Field {
  id: number;
  tableId: number;
  name: string;
  slug: string;
  type: string; // Using string instead of union for flexibility
  orderIndex: number | null;
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
  type: string;
  required?: boolean;
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
  sharedTools?: string[];
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

export interface CreateAgentData {
  name: string;
  role?: string;
  description?: string;
  persona?: string;
  tools?: ToolConfig[];
  servers?: ServerConfig[];
  trigger?: TriggerConfig;
  capabilities?: CapabilityConfig[];
  status?: string;
  roleId?: number;
}

export interface ToolConfig {
  name: string;
  version?: string;
  config?: Record<string, any>;
}

export interface ServerConfig {
  name: string;
  endpoint?: string;
  config?: Record<string, any>;
}

export interface TriggerConfig {
  type: 'MANUAL' | 'CRON' | 'WEBHOOK' | 'DATABASE_EVENT' | 'CALENDAR';
  cron?: string;
  webhook_url?: string;
  webhook_secret?: string;
  table_id?: number;
}

export interface CapabilityConfig {
  name: string;
  description: string;
  steps: StepConfig[];
}

export interface StepConfig {
  id: string;
  type: 'CODE_STEP' | 'TOOL_STEP';
  instructions: string;
  model?: string; // Per-step model specification
  tools?: ToolConfig[];
  servers?: ServerConfig[];
}

// New Task types aligned with frontend model
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'timeout';

export interface Task {
  id: string;
  agentId: number;
  name: string;
  capabilityName: string;
  status: TaskStatus;
  payload: Record<string, any>;
  result?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdBy?: string;
  createdAt: Date;
}

export interface CreateTaskData {
  agentId: number;
  name: string;
  capabilityName: string;
  payload: Record<string, any>;
  createdBy?: string;
}

export interface CreateRoleData {
  name: string;
  permissions: string[];
  organizationId?: number;
}

export interface TeamMembershipData {
  teamId: number;
  userId: string;
}

export interface UpdateUserData {
  organizationId?: number;
  roleId?: number;
  jobTitle?: string;
}