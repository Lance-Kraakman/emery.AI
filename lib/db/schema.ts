import { pgTable, text, uuid, serial, bigserial, integer, timestamp, boolean, primaryKey, jsonb, unique, customType, pgPolicy, pgRole } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// AIDEV-NOTE: Import organizational analysis types for type-safe schema
import type { OrganizationAnalysisCapabilities } from '@/ddd/domain/organizations/entities/organization';

// AIDEV-NOTE: Database roles for multi-tenant RBAC system
// These roles provide database-level security in addition to application-level permissions

// Application-wide roles (created once during initial setup)
export const appOwnerRole = pgRole('app_owner', { 
  createRole: false,
  inherit: true 
});

export const appAdminRole = pgRole('app_admin', { 
  createRole: false,
  inherit: true 
});

export const appMemberRole = pgRole('app_member', { 
  createRole: false,
  inherit: true 
});

// Authenticated user role - base role for all logged-in users
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
    using: sql`organization_id = get_current_organization_id()`,
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
    using: sql`organization_id = get_current_organization_id()`,
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
    using: sql`EXISTS (SELECT 1 FROM tables t WHERE t.id = table_id AND t.organization_id = get_current_organization_id())`,
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
  // Primary RLS policy - organization context based
  pgPolicy("organizations_member_access", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`id = get_current_organization_id()`,
  }),
  // Role-based policy for owners - full access to their organizations
  pgPolicy("organizations_owner_access", {
    as: "permissive", 
    for: "all",
    to: appOwnerRole,
    using: sql`EXISTS (
      SELECT 1 FROM user_organizations 
      WHERE organization_id = ${table.id} 
      AND user_id = current_setting('app.current_user_id', true)::uuid
      AND role = 'owner'
    )`,
  }),
  // Role-based policy for admins - read and update access
  pgPolicy("organizations_admin_access", {
    as: "permissive",
    for: "select",
    to: appAdminRole,
    using: sql`EXISTS (
      SELECT 1 FROM user_organizations 
      WHERE organization_id = ${table.id} 
      AND user_id = current_setting('app.current_user_id', true)::uuid
      AND role IN ('admin', 'owner')
    )`,
  }),
]);


// AIDEV-NOTE: Removed complex roles table - using simplified 3-role system in users.organization_role

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  currentOrganizationId: integer("current_organization_id").references(() => organizations.id),
  // Simplified 3-role system: 'owner' | 'admin' | 'member'
  organizationRole: text("organization_role").notNull().default("member"), // Fixed 3-role RBAC
  jobTitle: text("job_title"),
  teams: text("teams").array(),
  apiKey: text("api_key").unique(), // User API key for management APIs
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // Pure Drizzle simplified role-based policies
  pgPolicy("users_owner_management", {
    as: "permissive",
    for: "all",
    to: [appOwnerRole],
    using: sql`current_organization_id = get_current_organization_id()`,
    withCheck: sql`current_organization_id = get_current_organization_id()`,
  }),
  pgPolicy("users_admin_management", {
    as: "permissive", 
    for: "select",
    to: [appAdminRole],
    using: sql`current_organization_id = get_current_organization_id()`,
  }),
  pgPolicy("users_member_self", {
    as: "permissive",
    for: "select",
    to: [appMemberRole],
    using: sql`id = auth.uid()`,
  }),
]);

export const userOrganizations = pgTable("user_organizations", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // owner, admin, member
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  pgPolicy("user_organizations_isolation", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`user_id = current_setting('app.current_user_id')::uuid AND organization_id = get_current_organization_id()`,
  }),
]);

export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  invitedBy: uuid("invited_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"), // owner, admin, member
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  pgPolicy("invitations_tenant_isolation", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`organization_id = get_current_organization_id()`,
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
  // Enhanced role-based team policies
  pgPolicy("teams_owner_management", {
    as: "permissive",
    for: "all",
    to: [appOwnerRole],
    using: sql`organization_id = get_current_organization_id()`,
    withCheck: sql`organization_id = get_current_organization_id()`,
  }),
  pgPolicy("teams_admin_management", {
    as: "permissive",
    for: "all",
    to: [appAdminRole],
    using: sql`organization_id = get_current_organization_id()`,
    withCheck: sql`organization_id = get_current_organization_id()`,
  }),
  pgPolicy("teams_member_view", {
    as: "permissive",
    for: "select",
    to: [appMemberRole],
    using: sql`organization_id = get_current_organization_id()`,
  }),
]);

export const teamMemberships = pgTable("team_memberships", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // Enhanced role-based team membership policies
  pgPolicy("team_memberships_owner_management", {
    as: "permissive",
    for: "all",
    to: [appOwnerRole],
    using: sql`EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.organization_id = get_current_organization_id())`,
    withCheck: sql`EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.organization_id = get_current_organization_id())`,
  }),
  pgPolicy("team_memberships_admin_management", {
    as: "permissive",
    for: "all", 
    to: [appAdminRole],
    using: sql`EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.organization_id = get_current_organization_id())`,
    withCheck: sql`EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.organization_id = get_current_organization_id())`,
  }),
  pgPolicy("team_memberships_member_view", {
    as: "permissive",
    for: "select",
    to: [appMemberRole],
    using: sql`user_id = auth.uid() OR EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.organization_id = get_current_organization_id())`,
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
  // Pure Drizzle simplified role-based policies
  pgPolicy("agents_owner_management", {
    as: "permissive",
    for: "all",
    to: [appOwnerRole],
    using: sql`organization_id = get_current_organization_id() AND EXISTS(
      SELECT 1 FROM users WHERE id = auth.uid() 
      AND current_organization_id = agents.organization_id 
      AND organization_role = 'owner'
    )`,
    withCheck: sql`organization_id = get_current_organization_id()`,
  }),
  pgPolicy("agents_admin_view", {
    as: "permissive", 
    for: "select",
    to: [appAdminRole],
    using: sql`organization_id = get_current_organization_id() AND EXISTS(
      SELECT 1 FROM users WHERE id = auth.uid() 
      AND current_organization_id = agents.organization_id 
      AND organization_role IN ('admin', 'owner')
    )`,
  }),
  pgPolicy("agents_member_view", {
    as: "permissive",
    for: "select",
    to: [appMemberRole],
    using: sql`organization_id = get_current_organization_id() AND EXISTS(
      SELECT 1 FROM users WHERE id = auth.uid() 
      AND current_organization_id = agents.organization_id
    )`,
  }),
  pgPolicy("agents_owner_control", {
    as: "permissive", 
    for: "all",
    to: [authenticatedRole],
    using: sql`owner_id = auth.uid() AND organization_id = get_current_organization_id()`,
    withCheck: sql`owner_id = auth.uid() AND organization_id = get_current_organization_id()`,
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
  
  // Execution tracking
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // Enhanced role-based task policies
  pgPolicy("tasks_owner_management", {
    as: "permissive",
    for: "all",
    to: [appOwnerRole],
    using: sql`organization_id = get_current_organization_id()`,
    withCheck: sql`organization_id = get_current_organization_id()`,
  }),
  pgPolicy("tasks_admin_management", {
    as: "permissive", 
    for: "select",
    to: [appAdminRole],
    using: sql`organization_id = get_current_organization_id()`,
  }),
  pgPolicy("tasks_admin_updates", {
    as: "permissive",
    for: "update", 
    to: [appAdminRole],
    using: sql`organization_id = get_current_organization_id()`,
    withCheck: sql`organization_id = get_current_organization_id()`,
  }),
  pgPolicy("tasks_member_view", {
    as: "permissive",
    for: "select",
    to: [appMemberRole],
    using: sql`organization_id = get_current_organization_id()`,
  }),
  pgPolicy("tasks_creator_control", {
    as: "permissive", 
    for: "all",
    to: [authenticatedRole],
    using: sql`created_by = auth.uid() AND organization_id = get_current_organization_id()`,
    withCheck: sql`created_by = auth.uid() AND organization_id = get_current_organization_id()`,
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
  // Enhanced role-based RAG index policies
  pgPolicy("rag_indexes_owner_management", {
    as: "permissive",
    for: "all",
    to: [appOwnerRole],
    using: sql`organization_id = get_current_organization_id()`,
    withCheck: sql`organization_id = get_current_organization_id()`,
  }),
  pgPolicy("rag_indexes_admin_management", {
    as: "permissive",
    for: "all",
    to: [appAdminRole],
    using: sql`organization_id = get_current_organization_id()`,
    withCheck: sql`organization_id = get_current_organization_id()`,
  }),
  pgPolicy("rag_indexes_member_view", {
    as: "permissive",
    for: "select",
    to: [appMemberRole],
    using: sql`organization_id = get_current_organization_id()`,
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
  // Enhanced role-based RAG document policies
  pgPolicy("rag_documents_owner_management", {
    as: "permissive",
    for: "all",
    to: [appOwnerRole],
    using: sql`organization_id = get_current_organization_id()`,
    withCheck: sql`organization_id = get_current_organization_id()`,
  }),
  pgPolicy("rag_documents_admin_management", {
    as: "permissive",
    for: "all",
    to: [appAdminRole],
    using: sql`organization_id = get_current_organization_id()`,
    withCheck: sql`organization_id = get_current_organization_id()`,
  }),
  pgPolicy("rag_documents_member_view", {
    as: "permissive",
    for: "select",
    to: [appMemberRole],
    using: sql`organization_id = get_current_organization_id()`,
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
  // Enhanced role-based RAG query logs policies
  pgPolicy("rag_query_logs_owner_management", {
    as: "permissive",
    for: "all",
    to: [appOwnerRole],
    using: sql`organization_id = get_current_organization_id() OR (organization_id IS NULL AND EXISTS (SELECT 1 FROM rag_indexes ri WHERE ri.id = rag_index_id AND ri.organization_id = get_current_organization_id()))`,
    withCheck: sql`organization_id = get_current_organization_id()`,
  }),
  pgPolicy("rag_query_logs_admin_management", {
    as: "permissive",
    for: "all",
    to: [appAdminRole],
    using: sql`organization_id = get_current_organization_id() OR (organization_id IS NULL AND EXISTS (SELECT 1 FROM rag_indexes ri WHERE ri.id = rag_index_id AND ri.organization_id = get_current_organization_id()))`,
    withCheck: sql`organization_id = get_current_organization_id()`,
  }),
  pgPolicy("rag_query_logs_user_access", {
    as: "permissive",
    for: "select",
    to: [appMemberRole, authenticatedRole],
    using: sql`user_id = auth.uid() AND (organization_id = get_current_organization_id() OR (organization_id IS NULL AND EXISTS (SELECT 1 FROM rag_indexes ri WHERE ri.id = rag_index_id AND ri.organization_id = get_current_organization_id())))`,
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
    contextType?: 'tables' | 'agents' | 'files' | 'teams' | 'databases' | 'organizations' | 'mixed';
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
    using: sql`organization_id = get_current_organization_id()`,
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
    using: sql`EXISTS (SELECT 1 FROM chats c WHERE c.id = chat_id AND c.organization_id = get_current_organization_id())`,
  }),
]);

// Index for efficient chat message retrieval
// Note: This would be created in a migration file
// CREATE INDEX idx_chat_messages_chat_id_order ON chat_messages(chat_id, message_index);
// CREATE INDEX idx_chats_table_id ON chats(table_id) WHERE table_id IS NOT NULL;
