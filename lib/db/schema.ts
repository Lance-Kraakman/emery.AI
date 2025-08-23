import { pgTable, text, uuid, serial, integer, timestamp, boolean, primaryKey, jsonb, unique, customType } from "drizzle-orm/pg-core";

// Custom vector type for pgvector
const vector = customType<{ data: number[]; notNull: false; default: false }>({
  dataType() {
    return 'vector(1024)'; // Updated for BAAI/bge-m3 (multilingual, 8192 tokens)
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
});

export const tables = pgTable("tables", {
  id: serial("id").primaryKey(),
  databaseId: integer("database_id").notNull().references(() => databases.id),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  dbName: text("db_name").notNull().unique(),
  metadata: jsonb("metadata").$type<{description?: string; [key: string]: any}>(), // Description and other metadata for RAG indexing
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const fields = pgTable("fields", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id").notNull().references(() => tables.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  type: text("type").notNull(), // text, number, boolean, email, url, date, relation
  orderIndex: integer("order_index").default(0),
  relatedTableId: integer("related_table_id").references(() => tables.id),
  required: boolean("required").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mission: text("mission"),
  sharedTools: text("shared_tools").array(),
  sharedServers: text("shared_servers").array(),
  databaseId: text("database_id"),
  viewConfig: jsonb("view_config"),
  plan: text("plan").default("free"), // e.g., 'free', 'pro', 'enterprise'
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeSubscriptionStatus: text("stripe_subscription_status"),
  analysisCapabilities: jsonb("analysis_capabilities"), // Organizational analysis configuration
  createdAt: timestamp("created_at").defaultNow(),
});

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  permissions: text("permissions").array(),
  organizationId: integer("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Unique constraint: role name must be unique within an organization
  nameOrgUnique: unique().on(table.name, table.organizationId),
}));

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  currentOrganizationId: integer("current_organization_id").references(() => organizations.id),
  roleId: integer("role_id").references(() => roles.id),
  jobTitle: text("job_title"),
  role: text("role"),
  teams: text("teams").array(),
  apiKey: text("api_key").unique(), // User API key for management APIs
  createdAt: timestamp("created_at").defaultNow(),
});

export const userOrganizations = pgTable("user_organizations", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // owner, admin, member
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  invitedBy: uuid("invited_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"), // owner, admin, member
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

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
});

export const teamMemberships = pgTable("team_memberships", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

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
  roleId: integer("role_id").references(() => roles.id),
  apiKey: text("api_key").unique(), // For API authentication
  lastUsedAt: timestamp("last_used_at"), // Track API key usage
  agentType: text("agent_type").default("general"), // Agent specialization type
  createdAt: timestamp("created_at").defaultNow(),
});

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
});

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
  roleId: integer("role_id").references(() => roles.id),
  
  // Domain configuration - what to RAG against
  domainTypes: jsonb("domain_types").notNull(), // ["tables", "files", "agents", "workflows"]
  domainFilters: jsonb("domain_filters"), // Additional filtering criteria
  
  // Embedding configuration
  embeddingModel: text("embedding_model").default("BAAI/bge-m3"),
  embeddingDimensions: integer("embedding_dimensions").default(1024),
  
  // Status and metadata
  status: text("status").default("active"), // active, building, error
  lastIndexedAt: timestamp("last_indexed_at"),
  documentCount: integer("document_count").default(0),
  
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const ragDocuments = pgTable("rag_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  ragIndexId: uuid("rag_index_id").notNull().references(() => ragIndexes.id),
  organizationId: integer("organization_id").notNull().references(() => organizations.id), // Denormalized for performance
  
  // Source identification
  domainType: text("source_type").notNull(), // "table", "file", "agent", "workflow"
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
});

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
});

// Chat System Tables - Connected to All Domain Types
export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  
  // Domain connections - flexible connections to any domain type
  domainType: text("domain_type"), // 'table', 'agent', 'file', 'team', 'workflow', null for org-wide
  domainId: integer("domain_id"), // ID of connected domain entity
  tableId: integer("table_id").references(() => tables.id), // Legacy table connection (for compatibility)
  
  // Chat metadata
  title: text("title").notNull(),
  description: text("description"),
  
  // RAG and AI context
  contextMetadata: jsonb("context_metadata").$type<{
    ragIndexId?: string;
    contextType?: 'table' | 'agent' | 'file' | 'team' | 'workflow' | 'organization' | 'mixed';
    domainSchema?: any;
    primaryRagWeight?: number; // Weight for primary domain context (0.0-1.0)
    lastRagUpdate?: string;
  }>(),
  
  // Status and lifecycle
  status: text("status").notNull().default("active"), // active, archived, deleted
  messageCount: integer("message_count").default(0),
  lastMessageAt: timestamp("last_message_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
});

// Index for efficient chat message retrieval
// Note: This would be created in a migration file
// CREATE INDEX idx_chat_messages_chat_id_order ON chat_messages(chat_id, message_index);
// CREATE INDEX idx_chats_table_id ON chats(table_id) WHERE table_id IS NOT NULL;
