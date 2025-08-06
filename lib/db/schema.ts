import { pgTable, text, uuid, serial, integer, timestamp, boolean, primaryKey, jsonb } from "drizzle-orm/pg-core";

export const tables = pgTable("tables", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  dbName: text("db_name").notNull().unique(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  permissions: text("permissions").array(),
  organizationId: integer("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  organizationId: integer("organization_id").references(() => organizations.id),
  roleId: integer("role_id").references(() => roles.id),
  jobTitle: text("job_title"),
  role: text("role"),
  teams: text("teams").array(),
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
  tools: text("tools").array(),
  servers: text("servers").array(),
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
  model: text("model"),
  tools: text("tools").array(),
  servers: text("servers").array(),
  goals: text("goals").array(),
  trigger: jsonb("trigger"), // Trigger configuration (JSON blob)
  capabilities: jsonb("capabilities"), // Array of Capability objects with steps (JSON blob)
  databaseId: text("database_id"),
  status: text("status").default("active"),
  organizationId: integer("organization_id").references(() => organizations.id),
  roleId: integer("role_id").references(() => roles.id),
  ownerId: uuid("owner_id").notNull().references(() => users.id), // Agent owner (user)
  apiKey: text("api_key").unique(), // For API authentication
  lastUsedAt: timestamp("last_used_at"), // Track API key usage
  createdAt: timestamp("created_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, error
  payload: jsonb("payload"), // Task payload data (JSON blob)
  result: jsonb("result"), // Task result data (JSON blob)
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const taskExecutions = pgTable("task_executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: integer("agent_id").notNull().references(() => agents.id),
  capabilityName: text("capability_name").notNull(), // Which capability is being executed
  triggerType: text("trigger_type").notNull(), // MANUAL, CRON, WEBHOOK, DATABASE_EVENT
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, error
  inputData: jsonb("input_data"),
  outputData: jsonb("output_data"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  createdBy: uuid("created_by").references(() => users.id),
});

export const stepExecutions = pgTable("step_executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskExecutionId: uuid("task_execution_id").notNull().references(() => taskExecutions.id),
  stepId: text("step_id").notNull(),
  stepType: text("step_type").notNull(), // code_step, tool_step
  instructions: text("instructions"),
  tools: text("tools").array(),
  servers: text("servers").array(),
  inputData: jsonb("input_data"),
  outputData: jsonb("output_data"),
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, error
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
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