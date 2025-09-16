import { pgTable, text, uuid, serial, bigserial, integer, timestamp, boolean, primaryKey, jsonb, unique, customType, pgPolicy, pgRole } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// AIDEV-NOTE: Import organizational analysis types for type-safe schema
import type { OrganizationAnalysisCapabilities } from '@/ddd/domain/organizations/entities/organization';

// AIDEV-NOTE: Authenticated user role for RLS policies
export const authenticatedRole = pgRole('authenticated', {
  createRole: false,
  inherit: true
});

// Anonymous role for public access (if needed)
export const anonymousRole = pgRole('anon', {
  createRole: false,
  inherit: false
});

// Custom vector type for pgvector
const vector = customType<{ data: number[]; notNull: false; default: false }>({
  dataType() {
    return 'vector(768)'; // sentence-transformers/all-mpnet-base-v2 (768 dimensions)
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === 'string') {
      return JSON.parse(value);
    }
    return value as number[];
  },
});


export const databases = pgTable("databases", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // URL-safe database identifier
  metadata: jsonb("metadata").$type<{description?: string; [key: string]: any}>(), // Description and other metadata for RAG indexing
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  pgPolicy("databases_tenant_isolation", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer`,
  }),
]);

export const tables = pgTable("tables", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  databaseId: integer("database_id").notNull().references(() => databases.id),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  s3Path: text("s3_path").notNull().unique(), // S3 path for table's Parquet data: org_{id}/db_{id}/table_{id}/
  metadata: jsonb("metadata").$type<{description?: string; [key: string]: any}>(), // Description and other metadata for RAG indexing
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  pgPolicy("tables_tenant_isolation", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer`,
  }),
]);

export const fields = pgTable("fields", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id").notNull().references(() => tables.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  type: text("type").notNull(), // text, number, boolean, email, url, date, file, relation
  orderIndex: integer("order_index").default(0),
  required: boolean("required").default(false),
  
  // Configuration for complex field types (file, relation)
  fieldConfig: jsonb("field_config").$type<{
    // File field config
    allowedTypes?: string[]; // ['image/*', '.pdf', etc.]
    maxSize?: number; // in bytes
    multiple?: boolean;
    
    // Relation field config  
    targetTableId?: number;
    relationshipType?: 'one-to-one' | 'one-to-many' | 'many-to-many';
    displayField?: string;
    
    // Generic extension metadata
    [key: string]: any;
  }>(),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  pgPolicy("fields_tenant_isolation", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`EXISTS (SELECT 1 FROM tables t WHERE t.id = table_id AND t.organization_id = current_setting('app.current_organization_id')::integer)`,
  }),
]);

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  mission: text("mission"),
  sharedTools: text("shared_tools").array(),
  sharedServers: text("shared_servers").array(),
  databaseId: text("database_id"),
  viewConfig: jsonb("view_config"),
  plan: text("plan").default("free"), // e.g., 'free', 'pro', 'enterprise'
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeSubscriptionStatus: text("stripe_subscription_status"),
  analysisCapabilities: jsonb("analysis_capabilities").$type<OrganizationAnalysisCapabilities>(), // Type-safe organizational analysis configuration
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // RBAC-based policy for viewing organizations
  pgPolicy("organizations_view_permission", {
    as: "permissive",
    for: "select", 
    to: "public",
    using: sql`id = current_setting('app.current_organization_id')::integer 
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'organizations:view',
        id
      )`
  }),
  // RBAC-based policy for managing organizations
  pgPolicy("organizations_manage_permission", {
    as: "permissive",
    for: "update",
    to: "public", 
    using: sql`user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'organizations:manage',
      id
    )`,
    withCheck: sql`user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'organizations:manage',
      id
    )`
  }),
]);

// AIDEV-NOTE: RBAC System Tables - Flexible permission-based access control
// Replaces hardcoded role system with configurable roles and permissions

// Permissions (seeded system data)
export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  resource: text("resource").notNull(), // 'organizations', 'users', 'teams', 'agents', 'tasks', 'data'
  action: text("action").notNull(),     // 'view', 'manage', 'create', 'execute', 'invite'
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("unique_permission").on(table.resource, table.action)
]);

// Roles (system + custom per organization)  
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  organizationId: integer("organization_id").references(() => organizations.id),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  pgPolicy("roles_tenant_isolation", {
    as: "permissive",
    for: "all", 
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer OR is_system = true`,
  })
]);

// Role-Permission assignments (many-to-many)
export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: integer("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  resourceType: text("resource_type"), // 'agent', 'team', 'user', null for global
  resourceId: integer("resource_id"), // specific resource ID, null for scoped
  resourceScope: text("resource_scope").default("all"), // 'all', 'specific', 'owned', 'team'
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("unique_role_permission_resource").on(table.roleId, table.permissionId, table.resourceType, table.resourceId)
]);

// User-Role assignments (replaces organizationRole field)
export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(), 
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow(),
}, (table) => [
  unique("unique_user_role_org").on(table.userId, table.roleId, table.organizationId),
  pgPolicy("user_roles_tenant_isolation", {
    as: "permissive",
    for: "all",
    to: "public", 
    using: sql`organization_id = current_setting('app.current_organization_id')::integer`,
  })
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  currentOrganizationId: integer("current_organization_id").references(() => organizations.id),
  jobTitle: text("job_title"),
  teams: text("teams").array(),
  apiKey: text("api_key").unique(), // User API key for management APIs
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // RBAC-based policy for viewing users
  pgPolicy("users_view_permission", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`current_organization_id = current_setting('app.current_organization_id')::integer 
      AND (
        id = current_setting('app.current_user_id')::uuid 
        OR user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'users:view',
          current_organization_id
        )
      )`
  }),
  // RBAC-based policy for managing users
  pgPolicy("users_manage_permission", {
    as: "permissive",
    for: "update",
    to: "public",
    using: sql`current_organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'users:manage', 
        current_organization_id
      )`,
    withCheck: sql`current_organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'users:manage', 
        current_organization_id
      )`
  }),
]);

export const userOrganizations = pgTable("user_organizations", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  pgPolicy("user_organizations_isolation", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`user_id = current_setting('app.current_user_id')::uuid AND organization_id = current_setting('app.current_organization_id')::integer`,
  }),
]);

export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  invitedBy: uuid("invited_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  roleId: integer("role_id").references(() => roles.id), // Role to assign when invitation is accepted
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  pgPolicy("invitations_tenant_isolation", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer`,
  }),
]);

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  purpose: text("purpose"),
  description: text("description"),
  responsibilities: text("responsibilities").array(),
  goals: text("goals").array(),
  agentIds: text("agent_ids").array(),
  databaseId: text("database_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // RBAC-based policy for viewing teams (resource-aware)
  pgPolicy("teams_view_permission", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'teams:view',
        organization_id,
        'team',
        id
      )`
  }),
  // RBAC-based policy for managing teams (resource-aware)
  pgPolicy("teams_manage_permission", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'teams:manage',
        organization_id,
        'team',
        id
      )`,
    withCheck: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'teams:manage',
        organization_id,
        'team',
        id
      )`
  }),
  // RBAC-based policy for creating teams
  pgPolicy("teams_create_permission", {
    as: "permissive",
    for: "insert",
    to: "public",
    withCheck: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'teams:create',
        organization_id
      )`
  }),
]);

export const teamMemberships = pgTable("team_memberships", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // RBAC-based policy for viewing team memberships
  pgPolicy("team_memberships_view_permission", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`user_id = current_setting('app.current_user_id')::uuid 
      OR EXISTS (
        SELECT 1 FROM teams t 
        WHERE t.id = team_id 
        AND t.organization_id = current_setting('app.current_organization_id')::integer
        AND user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'teams:view',
          t.organization_id
        )
      )`
  }),
  // RBAC-based policy for managing team memberships
  pgPolicy("team_memberships_manage_permission", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`EXISTS (
      SELECT 1 FROM teams t 
      WHERE t.id = team_id 
      AND t.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'teams:manage',
        t.organization_id
      )
    )`,
    withCheck: sql`EXISTS (
      SELECT 1 FROM teams t 
      WHERE t.id = team_id 
      AND t.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'teams:manage',
        t.organization_id
      )
    )`
  }),
]);

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role"),
  description: text("description"),
  persona: text("persona"),
  ownerId: uuid("owner_id").notNull().references(() => users.id), // Agent owner (user)
  tools: jsonb("tools"), // Available tools as JSONB for rich configuration
  servers: jsonb("servers"), // Available servers as JSONB for rich configuration  
  trigger: jsonb("trigger"), // Trigger configuration (JSON blob)
  capabilities: jsonb("capabilities"), // STATIC: Array of Capability objects with steps (JSON blob)
  databaseId: text("database_id"),
  status: text("status").default("active"),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  apiKey: text("api_key").unique(), // For API authentication
  lastUsedAt: timestamp("last_used_at"), // Track API key usage
  agentType: text("agent_type").default("general"), // Agent specialization type
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // RBAC-based policy for viewing agents (resource-aware)
  pgPolicy("agents_view_permission", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND (
        owner_id = current_setting('app.current_user_id')::uuid
        OR user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'agents:view',
          organization_id,
          'agent',
          id
        )
      )`
  }),
  // RBAC-based policy for managing agents (resource-aware)
  pgPolicy("agents_manage_permission", {
    as: "permissive", 
    for: "all",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND (
        owner_id = current_setting('app.current_user_id')::uuid
        OR user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'agents:manage',
          organization_id,
          'agent',
          id
        )
      )`,
    withCheck: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND (
        owner_id = current_setting('app.current_user_id')::uuid
        OR user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'agents:manage',
          organization_id,
          'agent',
          id
        )
      )`
  }),
  // RBAC-based policy for creating agents
  pgPolicy("agents_create_permission", {
    as: "permissive",
    for: "insert",
    to: "public",
    withCheck: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'agents:create',
        organization_id
      )`
  }),
  // RBAC-based policy for executing agents (resource-aware)
  pgPolicy("agents_execute_permission", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND (
        owner_id = current_setting('app.current_user_id')::uuid
        OR user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'agents:execute',
          organization_id,
          'agent',
          id
        )
      )`
  }),
]);

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: integer("agent_id").notNull().references(() => agents.id), // WHICH agent executes this
  organizationId: integer("organization_id").notNull().references(() => organizations.id), // Organization for RLS
  name: text("name").notNull(),
  capabilityName: text("capability_name"), // Optional - system can auto-route if not specified
  instructions: jsonb("instructions").notNull(), // Step-like config: {instructions: string, tools?: ToolConfig[], servers?: ServerConfig[]}
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, failed, cancelled, timeout
  result: jsonb("result"), // Final output data
  error: text("error"),
  logs: jsonb("logs").$type<string[]>().default([]), // Execution logs from gRPC TaskProgress
  
  // Execution tracking
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdBy: uuid("created_by").references(() => users.id),
  
  // Task routing tracking for audit trail and permissions
  teamId: integer("team_id").references(() => teams.id), // If task assigned to team
  routedFromAgentId: integer("routed_from_agent_id").references(() => agents.id), // Source agent for routing
  routedFromTeamId: integer("routed_from_team_id").references(() => teams.id), // Source team for routing
  routedAt: timestamp("routed_at"), // When task was routed
  routingReason: text("routing_reason"), // Why task was routed
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // RBAC-based policy for viewing tasks
  pgPolicy("tasks_view_permission", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'tasks:view',
        organization_id
      )`
  }),
  // RBAC-based policy for managing tasks
  pgPolicy("tasks_manage_permission", {
    as: "permissive",
    for: "update",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'tasks:manage',
        organization_id
      )`,
    withCheck: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'tasks:manage',
        organization_id
      )`
  }),
  // AIDEV-NOTE: RBAC-based task assignment policies using enhanced user_has_permission function
  // These replace the old complex JSONB-based permission checks
  pgPolicy("tasks_agent_assignment_rbac", {
    as: "permissive",
    for: "insert",
    to: [authenticatedRole],
    withCheck: sql`
      agent_id IS NULL 
      OR user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'tasks:assign',
        current_setting('app.current_organization_id')::integer,
        'agent',
        agent_id
      )
    `
  }),
  pgPolicy("tasks_team_assignment_rbac", {
    as: "permissive",
    for: "insert",
    to: [authenticatedRole],
    withCheck: sql`
      team_id IS NULL
      OR user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'tasks:assign',
        current_setting('app.current_organization_id')::integer,
        'team',
        team_id
      )
    `
  }),
]);

export const accounts = pgTable("accounts", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (table) => ({
  compoundKey: primaryKey({
    columns: [table.provider, table.providerAccountId],
  }),
}));

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").notNull().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires").notNull(),
});

// RAG System Tables
export const ragIndexes = pgTable("rag_indexes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  
  // Scoping - configurable domain filtering
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  agentId: integer("agent_id").references(() => agents.id),
  // Note: roleId removed for simplified RBAC - use organization-level permissions instead
  
  // Domain configuration - what to RAG against
  domainTypes: jsonb("domain_types").notNull(), // ["tables", "files", "agents", "teams", "databases", "organizations"]
  domainFilters: jsonb("domain_filters"), // Additional filtering criteria
  
  // Embedding configuration
  embeddingModel: text("embedding_model").default("sentence-transformers/all-mpnet-base-v2"),
  embeddingDimensions: integer("embedding_dimensions").default(768),
  
  // Status and metadata
  status: text("status").default("active"), // active, building, error
  lastIndexedAt: timestamp("last_indexed_at"),
  documentCount: integer("document_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // RBAC-based policies for RAG indexes
  pgPolicy("rag_indexes_manage_permission", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:manage',
        organization_id
      )`,
    withCheck: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:manage',
        organization_id
      )`,
  }),
  pgPolicy("rag_indexes_view_permission", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:view',
        organization_id
      )`,
  }),
]);

export const ragDocuments = pgTable("rag_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  ragIndexId: uuid("rag_index_id").notNull().references(() => ragIndexes.id),
  organizationId: integer("organization_id").notNull().references(() => organizations.id), // Denormalized for performance
  
  // Source identification
  domainType: text("domain_type").notNull(), // "tables", "files", "agents", "teams", "databases", "organizations"
  sourceId: text("source_id").notNull(), // ID of the source (table.id, file_path, etc.)
  sourceName: text("source_name").notNull(), // Human readable name
  
  // Content
  title: text("title").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"), // Additional context about the source
  
  // Vector embedding using pgvector for fast similarity search
  embedding: vector("embedding"),
  
  // Content hash for change detection
  contentHash: text("content_hash").notNull(),
  
  // Timestamps
  indexedAt: timestamp("indexed_at").defaultNow(),
  sourceUpdatedAt: timestamp("source_updated_at"),
}, (table) => [
  // RBAC-based policies for RAG documents
  pgPolicy("rag_documents_manage_permission", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:manage',
        organization_id
      )`,
    withCheck: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:manage',
        organization_id
      )`,
  }),
  pgPolicy("rag_documents_view_permission", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:view',
        organization_id
      )`,
  }),
]);

export const ragQueryLogs = pgTable("rag_query_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ragIndexId: uuid("rag_index_id").notNull().references(() => ragIndexes.id),
  organizationId: integer("organization_id").references(() => organizations.id), // Denormalized for performance
  
  // Query details
  query: text("query").notNull(),
  queryEmbedding: vector("query_embedding"),
  
  // Results
  resultsCount: integer("results_count").notNull(),
  topResults: jsonb("top_results"), // Store top matching documents with scores
  
  // Context
  userId: uuid("user_id").references(() => users.id),
  agentId: integer("agent_id").references(() => agents.id),
  sessionId: text("session_id"),

  // Search parameters
  similarityMetric: text("similarity_metric"),
  threshold: integer("threshold"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // RBAC-based policies for RAG query logs
  pgPolicy("rag_query_logs_manage_permission", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`(organization_id = current_setting('app.current_organization_id')::integer OR (organization_id IS NULL AND EXISTS (SELECT 1 FROM rag_indexes ri WHERE ri.id = rag_index_id AND ri.organization_id = current_setting('app.current_organization_id')::integer)))
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:manage',
        COALESCE(organization_id, (SELECT ri.organization_id FROM rag_indexes ri WHERE ri.id = rag_index_id))
      )`,
    withCheck: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:manage',
        organization_id
      )`,
  }),
  pgPolicy("rag_query_logs_view_permission", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`(user_id = current_setting('app.current_user_id')::uuid OR user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:view',
        COALESCE(organization_id, (SELECT ri.organization_id FROM rag_indexes ri WHERE ri.id = rag_index_id))
      ))
      AND (organization_id = current_setting('app.current_organization_id')::integer OR (organization_id IS NULL AND EXISTS (SELECT 1 FROM rag_indexes ri WHERE ri.id = rag_index_id AND ri.organization_id = current_setting('app.current_organization_id')::integer)))`,
  }),
]);

// Chat System Tables - Connected to All Domain Types
export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  
  
  // Chat metadata
  title: text("title").notNull(),
  description: text("description"),
  
  // RAG and AI context
  contextMetadata: jsonb("context_metadata").$type<{
    ragIndexId?: string;
    contextType?: 'tables' | 'agents' | 'files' | 'teams' | 'databases' | 'organizations' | 'tasks' | 'mixed';
    domainSchema?: {
      id?: number;        // Domain entity ID (replaces domainId/tableId)
      name?: string;      // Domain entity name
      type?: string;      // Additional type info if needed
      [key: string]: any; // Flexible domain-specific data
    };
    primaryRagWeight?: number; // Weight for primary domain context (0.0-1.0)
    lastRagUpdate?: string;
  }>(),
  
  // Status and lifecycle
  status: text("status").notNull().default("active"), // active, archived, deleted
  messageCount: integer("message_count").default(0),
  lastMessageAt: timestamp("last_message_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  pgPolicy("chats_tenant_isolation", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer`,
  }),
]);

export const chatMessages: any = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatId: uuid("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  
  // Message content
  role: text("role").notNull(), // 'user' | 'assistant' | 'system'
  content: text("content").notNull(),
  
  // AI and processing metadata
  metadata: jsonb("metadata").$type<{
    ragSources?: Array<{
      documentId: string;
      title: string;
      similarity: number;
      domainType: string;
    }>;
    modelUsed?: string;
    processingTime?: number;
    tokenCount?: number;
    error?: string;
  }>(),
  
  // Message ordering and organization
  messageIndex: integer("message_index").notNull(), // Sequential order within chat
  parentMessageId: uuid("parent_message_id").references(() => chatMessages.id), // For threading/editing
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  pgPolicy("chat_messages_tenant_isolation", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`EXISTS (SELECT 1 FROM chats c WHERE c.id = chat_id AND c.organization_id = current_setting('app.current_organization_id')::integer)`,
  }),
]);