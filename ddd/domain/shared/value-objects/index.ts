// AIDEV-NOTE: Shared domain Value Objects for type-safe entity identification
// All domain concepts should use these Value Objects instead of primitive types

// ID Value Objects
export { AgentId } from './agent-id';
export { UserId } from './user-id';
export { TeamId } from './team-id';
// Task-related value objects moved to tasks domain
export { TaskId } from '@/ddd/domain/tasks/value-objects/task-id';
export { OrganizationId } from './organization-id';
export { InvitationId } from './invitation-id';
export { FieldId } from './field-id';
export { DatabaseId } from './database-id';
export { TableId } from './table-id';

// Authentication & Security Value Objects
export { EmailAddress } from './email-address';
export { ApiKey } from './api-key';
export { InvitationToken } from './invitation-token';

// Domain Status & Role Value Objects
export { OrganizationRole, ORGANIZATION_ROLES } from './organization-role';
export { AgentStatus, AGENT_STATUS } from './agent-status';
// Task status moved to tasks domain
export { TaskStatus, TASK_STATUS } from '@/ddd/domain/tasks/value-objects/task-status';

// Naming & Identifier Value Objects
export { FieldName } from './field-name';
export { TableName } from './table-name';
export { OrganizationName } from './organization-name';

// Organizational Analysis Value Objects
export { MeasurementCategory, MEASUREMENT_CATEGORIES } from './measurement-category';
export { CalculationFrequency, CALCULATION_FREQUENCIES } from './calculation-frequency';