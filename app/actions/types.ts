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
  organizationId: number;
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
  tools?: string[];
}

export interface CreateWorkerData {
  name: string;
  type: string;
  capabilities?: string[];
  status?: string;
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