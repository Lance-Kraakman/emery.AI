# Repository Pattern Migration Guide

## Overview

This document outlines the systematic approach for migrating the Emery application from direct database access patterns to a clean architecture repository pattern. The migration follows Domain-Driven Design (DDD) principles with clear separation between Domain, Application, and Infrastructure layers.

## Current State

### ✅ **Completed (Phase 1)**
- **Organization Repository** - Complete with 17 unit tests + 5 integration tests
- **Clean Architecture Foundation** - DI container, domain entities, infrastructure layer
- **Server Actions Migration** - `createOrganization`, `updateOrganizationViewConfig`
- **Type System Cleanup** - Migrated from `actions/types.ts` to domain entities

### 📊 **Migration Coverage**
- **Completed**: Organizations (1/5 core domains)
- **Remaining**: Users, Roles, Agents, Dynamic Tables
- **Test Coverage**: 48 tests passing (baseline for future migrations)

## Migration Principles

### 1. **Clean Architecture Layers**
```
┌─────────────────────────────────────────────────────────┐
│                     UI Layer                            │
│                 (Server Actions)                        │
├─────────────────────────────────────────────────────────┤
│                Application Layer                        │
│            (DI Container, Services)                     │
├─────────────────────────────────────────────────────────┤
│                  Domain Layer                           │
│         (Entities, Repository Interfaces)               │
├─────────────────────────────────────────────────────────┤
│               Infrastructure Layer                      │
│        (Drizzle Repositories, Database)                │
└─────────────────────────────────────────────────────────┘
```

### 2. **Migration Safety**
- **Test-First**: Write comprehensive tests before migration
- **Incremental**: Migrate one domain at a time
- **Backward Compatible**: Maintain existing APIs during transition
- **Rollback Ready**: Each migration is atomic and reversible

### 3. **Type Safety**
- **Domain Entities**: Business-focused interfaces
- **Clear Contracts**: Repository interfaces define operations
- **Validation**: Business rules enforced at domain layer

## Phase 2: Users & Authentication

### **Priority: High** (Foundation for other systems)

#### **Domain Entities** (`lib/domain/entities/user.ts`)
```typescript
export interface User {
  id: string;                    // UUID
  name?: string | null;
  email?: string | null;
  emailVerified?: Date | null;
  image?: string | null;
  currentOrganizationId?: number | null;
  roleId?: number | null;
  jobTitle?: string | null;
  role?: string | null;
  teams?: string[] | null;
  apiKey?: string | null;
  createdAt?: Date | null;
}

export interface CreateUserData {
  id?: string;              // Optional UUID generation
  name?: string;
  email: string;           // Required for creation
  currentOrganizationId?: number;
  roleId?: number;
  jobTitle?: string;
}

export interface UpdateUserData {
  name?: string;
  currentOrganizationId?: number;
  roleId?: number;
  jobTitle?: string;
  teams?: string[];
}
```

#### **Repository Interface** (`lib/domain/repositories/user-repository.ts`)
```typescript
export interface IUserRepository {
  // Basic CRUD
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
  update(id: string, data: UpdateUserData): Promise<User>;
  delete(id: string): Promise<void>;
  
  // Authentication & API Keys
  generateApiKey(userId: string): Promise<string>;
  findByApiKey(apiKey: string): Promise<User | null>;
  revokeApiKey(userId: string): Promise<void>;
  
  // Organization Management
  switchOrganization(userId: string, organizationId: number): Promise<void>;
  getUserOrganizations(userId: string): Promise<Organization[]>;
  
  // Session Management
  createSession(userId: string, sessionToken: string, expires: Date): Promise<void>;
  findSession(sessionToken: string): Promise<SessionData | null>;
  deleteSession(sessionToken: string): Promise<void>;
}
```

#### **Implementation** (`lib/infrastructure/db/repositories/drizzle-user-repository.ts`)
- NextAuth integration
- API key generation/validation
- Organization switching logic
- Session management

#### **Tests**
- User CRUD operations
- Authentication flows  
- API key management
- Organization switching
- Session handling

#### **Server Actions to Migrate**
- `app/actions/permissions.ts` - `updateUserProfile`, `assignUserRole`
- `app/actions/user-organizations.ts` - User-org relationship management
- NextAuth callbacks and adapters

## Phase 3: Roles & Permissions

### **Priority: Medium** (Dependent on Users)

#### **Domain Entities** (`lib/domain/entities/role.ts`)
```typescript
export interface Role {
  id: number;
  name: string;
  permissions: string[];
  organizationId?: number | null;
  createdAt?: Date | null;
}

export interface CreateRoleData {
  name: string;
  permissions: string[];
  organizationId?: number;
}

// Enhanced permission system
export const PERMISSIONS = {
  // Organization Management
  MANAGE_ORGANIZATION: 'manage_organization',
  VIEW_ORGANIZATION: 'view_organization',
  
  // User Management  
  MANAGE_USERS: 'manage_users',
  VIEW_USERS: 'view_users',
  INVITE_USERS: 'invite_users',
  
  // Table Management
  CREATE_TABLES: 'create_tables',
  MANAGE_TABLES: 'manage_tables',
  VIEW_TABLES: 'view_tables',
  EDIT_TABLE_DATA: 'edit_table_data',
  
  // Agent Management
  CREATE_AGENTS: 'create_agents',
  MANAGE_AGENTS: 'manage_agents',
  VIEW_AGENTS: 'view_agents',
  EXECUTE_AGENTS: 'execute_agents'
} as const;
```

#### **Repository Interface** (`lib/domain/repositories/role-repository.ts`)
```typescript
export interface IRoleRepository {
  // Basic CRUD
  findById(id: number): Promise<Role | null>;
  findByOrganization(organizationId: number): Promise<Role[]>;
  create(data: CreateRoleData): Promise<Role>;
  update(id: number, data: Partial<CreateRoleData>): Promise<Role>;
  delete(id: number): Promise<void>;
  
  // Permission Management
  hasPermission(roleId: number, permission: string): Promise<boolean>;
  addPermission(roleId: number, permission: string): Promise<void>;
  removePermission(roleId: number, permission: string): Promise<void>;
  
  // Standard Role Creation
  createDefaultRoles(organizationId: number): Promise<Role[]>;
  findRoleByName(organizationId: number, name: string): Promise<Role | null>;
}
```

#### **Server Actions to Migrate**
- `app/actions/roles.ts` - Complete role management system
- Permission checking middleware
- RBAC enforcement layers

## Phase 4: Agents & Tasks

### **Priority: Medium** (Complex business logic)

#### **Domain Entities** (`lib/domain/entities/agent.ts`, `lib/domain/entities/task.ts`)
```typescript
export interface Agent {
  id: number;
  name: string;
  role?: string | null;
  description?: string | null;
  persona?: string | null;
  ownerId: string;          // User ID
  tools?: ToolConfig[] | null;
  servers?: ServerConfig[] | null;
  trigger?: TriggerConfig | null;
  capabilities?: CapabilityConfig[] | null;
  databaseId?: string | null;
  status: AgentStatus;
  organizationId: number;
  roleId?: number | null;
  apiKey?: string | null;
  lastUsedAt?: Date | null;
  createdAt?: Date | null;
}

export interface Task {
  id: string;               // UUID
  agentId: number;
  organizationId: number;
  name: string;
  capabilityName?: string | null;
  instructions: TaskInstructions;
  status: TaskStatus;
  result?: any;
  error?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdBy?: string | null;
  createdAt: Date;
}
```

#### **Repository Interfaces**
- `IAgentRepository` - Agent lifecycle, capability management
- `ITaskRepository` - Task execution, status tracking, result handling

#### **Complex Business Logic**
- Agent capability routing
- Task execution pipeline  
- OAuth proxy integration (Pipedream)
- Webhook handling
- Scheduler integration

#### **Server Actions to Migrate**
- `app/actions/agents.ts` - Complete agent management
- `app/actions/tasks.ts` - Task execution and monitoring
- Agent scheduler integration

## Phase 5: Dynamic Tables System

### **Priority: High** (Core business functionality)

#### **Challenge: Dual Schema Architecture**
The most complex migration due to hybrid static/dynamic database pattern:
- **Static Schema**: Drizzle ORM (tables, fields metadata)
- **Dynamic Tables**: Raw SQL with `field_{id}` column naming

#### **Domain Entities** (`lib/domain/entities/dynamic-table.ts`)
```typescript
export interface DynamicTable {
  id: number;
  databaseId: number;
  organizationId: number;
  name: string;
  dbName: string;          // Actual table name in DB
  metadata?: Record<string, any> | null;
  createdBy: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface DynamicField {
  id: number;
  tableId: number;
  name: string;
  slug: string;
  type: FieldType;
  orderIndex?: number | null;
  relatedTableId?: number | null;
  required?: boolean | null;
  createdAt?: Date | null;
}

export interface DynamicTableRow {
  id: string;              // UUID
  [fieldId: string]: any;  // field_{id} columns
  created_at: Date;
  updated_at: Date;
}
```

#### **Repository Interface** (`lib/domain/repositories/dynamic-table-repository.ts`)
```typescript
export interface IDynamicTableRepository {
  // Table Management
  createTable(data: CreateDynamicTableData): Promise<DynamicTable>;
  addField(tableId: number, field: CreateFieldData): Promise<DynamicField>;
  removeField(tableId: number, fieldId: number): Promise<void>;
  
  // Row Operations (Complex mapping between field names and field_{id})
  findRows(tableId: number, filters?: RowFilters): Promise<DynamicTableRow[]>;
  createRow(tableId: number, data: Record<string, any>): Promise<DynamicTableRow>;
  updateRow(tableId: number, rowId: string, data: Record<string, any>): Promise<DynamicTableRow>;
  deleteRow(tableId: number, rowId: string): Promise<void>;
  
  // Schema Introspection
  getTableSchema(tableId: number): Promise<DynamicTableSchema>;
  getFieldMapping(tableId: number): Promise<FieldMapping>;
  
  // Complex Business Logic
  handleRelationFields(data: Record<string, any>, fields: DynamicField[]): Promise<Record<string, any>>;
  validateFieldTypes(data: Record<string, any>, fields: DynamicField[]): Promise<ValidationResult>;
}
```

#### **Implementation Challenges**
1. **Field Mapping**: Convert user field names to `field_{id}` database columns
2. **Type Validation**: Ensure data types match field configurations
3. **Relation Handling**: JSONB relation fields with GIN indexes
4. **Performance**: Efficient queries on dynamic schema
5. **Migrations**: Handle field additions/deletions on live data

#### **Server Actions to Migrate**
- `app/actions/tables.ts` - Table schema management
- `app/actions/fields.ts` - Field CRUD operations
- `app/actions/rows.ts` - Row data management
- `app/actions/databases.ts` - Database container management

## Implementation Timeline

### **Week 1-2: Phase 2 (Users)**
- [ ] Create User domain entities
- [ ] Implement IUserRepository interface
- [ ] Build DrizzleUserRepository with NextAuth integration
- [ ] Write comprehensive test suite (15+ tests)
- [ ] Migrate user-related Server Actions
- [ ] Update DI container registration

### **Week 3: Phase 3 (Roles)**  
- [ ] Create Role domain entities with enhanced permissions
- [ ] Implement IRoleRepository interface
- [ ] Build DrizzleRoleRepository with permission logic
- [ ] Write test suite (10+ tests)
- [ ] Migrate role management Server Actions
- [ ] Update RBAC middleware

### **Week 4-5: Phase 4 (Agents)**
- [ ] Create Agent/Task domain entities
- [ ] Implement repository interfaces
- [ ] Handle complex agent capability system
- [ ] Integrate with existing scheduler/executor
- [ ] Write test suite (20+ tests)
- [ ] Migrate agent management Server Actions

### **Week 6-8: Phase 5 (Dynamic Tables)**
- [ ] Design dynamic table domain model
- [ ] Implement complex field mapping logic
- [ ] Handle relation field JSONB operations
- [ ] Maintain performance with GIN indexes
- [ ] Write comprehensive test suite (25+ tests)
- [ ] Migrate all table/field/row operations

## Testing Strategy

### **Per-Phase Testing Requirements**
1. **Unit Tests**: Repository methods, business logic, edge cases
2. **Integration Tests**: Server Action → Repository → Database flow
3. **Migration Tests**: Verify data consistency before/after migration
4. **Performance Tests**: Ensure repository pattern doesn't degrade performance
5. **Backward Compatibility**: Existing APIs continue working during transition

### **Test Coverage Targets**
- **Repository Methods**: 100% coverage of all interface methods
- **Business Logic**: All complex operations (createWithOwner, field mapping, etc.)
- **Error Handling**: Database failures, validation errors, constraint violations
- **Edge Cases**: Null values, empty collections, concurrent operations

### **Continuous Integration**
- All tests must pass before migration acceptance
- Performance benchmarks maintained
- Database schema validation
- Type safety verification

## Risk Management

### **High-Risk Areas**
1. **Dynamic Tables**: Complex field mapping could break existing data access
2. **Agent System**: Tight coupling with scheduler and OAuth proxy
3. **Authentication**: NextAuth integration changes could affect user sessions
4. **Performance**: Repository abstractions might impact query efficiency

### **Mitigation Strategies**
1. **Incremental Rollout**: Feature flags for gradual repository adoption
2. **Parallel Implementation**: Run old and new systems side-by-side during transition
3. **Comprehensive Testing**: Extensive test coverage before production deployment
4. **Monitoring**: Performance and error monitoring during migration phases
5. **Rollback Plan**: Quick reversion capability for each migration phase

## Success Metrics

### **Code Quality**
- [ ] 90%+ test coverage maintained
- [ ] Zero circular dependencies
- [ ] Clear separation of concerns (Domain/Application/Infrastructure)
- [ ] Consistent error handling patterns

### **Performance**
- [ ] Query performance maintained or improved
- [ ] Memory usage not significantly increased
- [ ] Response times within acceptable limits
- [ ] Database connection efficiency

### **Developer Experience**
- [ ] Simplified Server Actions (50%+ reduction in complexity)
- [ ] Clear business logic separation
- [ ] Easy to add new features
- [ ] Comprehensive type safety

### **Maintainability**
- [ ] Single source of truth for business logic
- [ ] Easy testing and mocking
- [ ] Clear upgrade path for future changes
- [ ] Documentation and examples for new team members

## Post-Migration Benefits

### **Immediate**
- Cleaner, more testable code
- Better separation of concerns
- Type-safe business operations
- Simplified Server Actions

### **Long-term**
- Easy to add new repositories
- Business logic reusability
- Better error handling and validation
- Scalable architecture for team growth

### **Technical Debt Reduction**
- Elimination of duplicate data access patterns
- Consistent error handling
- Centralized business rules
- Improved code organization

---

## Getting Started

1. **Review Organization Repository**: Study the completed implementation as a template
2. **Choose Next Phase**: Start with Phase 2 (Users) for foundational work
3. **Create Branch**: Use feature branches for each repository migration
4. **Follow TDD**: Write tests first, then implement repositories
5. **Test Thoroughly**: All existing functionality must continue working

This migration guide provides a **systematic, low-risk approach** to transforming your application architecture while maintaining full functionality throughout the transition process.