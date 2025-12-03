import { pgTable, text, uuid, serial, bigserial, bigint, integer, timestamp, boolean, primaryKey, jsonb, unique, customType, pgPolicy, pgRole, index, doublePrecision, numeric } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// AIDEV-NOTE: Import organizational analysis types for type-safe schema
import type { OrganizationAnalysisCapabilities } from '@/ddd/domain/organizations/entities/organization';
import type { ScheduleConfigurationJSON } from '@/ddd/domain/agents/entities/agent';
import type { PuckDataStructure } from '@/ddd/domain/puck/value-objects/puck-data';
import type { PageVariable } from '@/components/puck/types';
import type { ChatMessageMetadata } from '@/ddd/domain/chat/entities/chat-message';
import type { MessagePart } from '@/lib/grpc/generated/agent_worker';
import type { SkillParameterType, SkillInputFileConfig } from '@/ddd/domain/skills/entities/skill';

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



export const databases = pgTable("databases", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(), // URL-safe database identifier (unique per organization)
  metadata: jsonb("metadata").$type<{description?: string; [key: string]: any}>(), // Description and other metadata for RAG indexing
  ownerId: uuid("owner_id").notNull().references(() => users.id), // Database owner - used for 'owned' scope permissions
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("databases_org_slug_unique").on(table.organizationId, table.slug),
  pgPolicy("databases_tenant_isolation", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer`,
  }),

  // RLS: Resource-aware permission checking for viewing databases
  pgPolicy("databases_view_permission", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'view:manage',
      organization_id,
      'view',
      id
    )`,
  }),

  // RLS: Resource-aware permission checking for managing databases
  pgPolicy("databases_manage_permission", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'database:manage',
      organization_id,
      'database',
      id
    )`,
  }),
]);

export const tables = pgTable("tables", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  databaseId: integer("database_id").notNull().references(() => databases.id),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  s3Path: text("s3_path").notNull().unique(), // S3 path for table's Parquet data: org_{id}/db_{id}/table_{id}/
  metadata: jsonb("metadata").$type<{description?: string; [key: string]: any}>(), // Description and other metadata for RAG indexing
  ownerId: uuid("owner_id").notNull().references(() => users.id), // Table owner - used for 'owned' scope permissions
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  pgPolicy("tables_tenant_isolation", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer`,
  }),

  // RLS: Tables check BOTH database permissions (inheritance) AND table permissions (independence)
  pgPolicy("tables_view_permission", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`EXISTS (
      SELECT 1 FROM databases d
      WHERE d.id = database_id
      AND d.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'database:view',
        d.organization_id,
        'database',
        d.id
      )
    )
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'table:view',
      (SELECT organization_id FROM databases WHERE databases.id = database_id),
      'table',
      id
    )`,
  }),

  // RLS: Tables check BOTH database permissions (inheritance) AND table permissions (independence)
  pgPolicy("tables_manage_permission", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`EXISTS (
      SELECT 1 FROM databases d
      WHERE d.id = database_id
      AND d.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'database:manage',
        d.organization_id,
        'database',
        d.id
      )
    )
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'table:manage',
      (SELECT organization_id FROM databases WHERE databases.id = database_id),
      'table',
      id
    )`,
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

  // Configuration for complex field types (file, relation, select, autonumber, timestamp)
  fieldConfig: jsonb("field_config").$type<{
    // File field config
    allowedTypes?: string[]; // ['image/*', '.pdf', etc.]
    maxSize?: number; // in bytes
    multiple?: boolean;

    // Relation field config
    targetTableId?: number;
    relationshipType?: 'one-to-one' | 'one-to-many' | 'many-to-many';
    displayField?: string;

    // Single/Multi-select config
    options?: Array<{
      id: number;
      value: string;
      color: string;
    }>;
    defaultOption?: number;     // Single-select: default option ID
    maxSelections?: number;     // Multi-select: maximum selections allowed

    // Autonumber config
    startingNumber?: number;    // Default: 1
    prefix?: string;            // Optional: "INV-"
    suffix?: string;            // Optional: "-2025"
    digits?: number;            // Zero-padding: 5 → "00001"
    currentValue?: number;      // Track highest value (persisted for durability)

    // Timestamp config (last-updated, created-at)
    timezone?: string;          // Default: UTC
    includeTime?: boolean;      // Default: true
    watchFields?: string[];     // last-updated: only update when specific fields change

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

  // RLS: Fields inherit table permissions (inheritance from parent table)
  pgPolicy("fields_view_permission", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_id
      AND t.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'table:view',
        t.organization_id,
        'table',
        t.id
      )
    )`,
  }),

  // RLS: Fields inherit table permissions (inheritance from parent table)
  pgPolicy("fields_manage_permission", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_id
      AND t.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'table:manage',
        t.organization_id,
        'table',
        t.id
      )
    )`,
  }),

  // RLS: Allow public access to fields when ANY view on the table has requires_auth = false
  // NOTE: This grants field access if ANY view on the table is public, not per-view.
  // This is acceptable since views typically expose all fields anyway.
  pgPolicy("fields_public_via_view", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`EXISTS (
      SELECT 1 FROM views v
      WHERE v.table_id = table_id
      AND v.requires_auth = false
    )`,
  }),
]);

// AIDEV-NOTE: Views - Filtered/sorted table configurations (Baserow view pattern) with tables
// Defines filtered, sorted, paginated views of table data for components
export const views = pgTable("views", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  tableId: integer("table_id").notNull().references(() => tables.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  ownerId: uuid("owner_id").notNull().references(() => users.id), // View owner - used for 'owned' scope permissions

  // Whether this view requires authentication to access
  // AIDEV-NOTE: When false, the view data can be accessed without login (for public pages)
  // Secure by default - new views require authentication
  requiresAuth: boolean("requires_auth").notNull().default(true),

  // Filter configuration (array of filter conditions)
  filters: jsonb("filters").$type<Array<{
    fieldId: number;
    operator: string;
    value?: string | number | boolean | null;
  }>>().default(sql`'[]'::jsonb`).notNull(),

  // Sort configuration (array of sort rules with priority)
  sorting: jsonb("sorting").$type<Array<{
    fieldId: number;
    direction: 'asc' | 'desc';
    priority: number;
  }>>().default(sql`'[]'::jsonb`).notNull(),

  // Pagination configuration
  pagination: jsonb("pagination").$type<{
    pageSize: number;
    offset: number;
  }>().default(sql`'{"pageSize": 50, "offset": 0}'::jsonb`).notNull(),

  // Field mappings configuration (column visibility, order, and display names)
  fieldMappings: jsonb("field_mappings").$type<Array<{
    sourceFieldId: number;
    displayName: string;
    visible: boolean;
    order: number;
  }>>(),

  // View type (grid, metric, chart, form)
  // AIDEV-NOTE: Determines how data is transformed and displayed.
  // Defaults to 'grid' for backward compatibility with existing views.
  viewType: text("view_type")
    .$type<'grid' | 'metric' | 'chart' | 'form'>()
    .notNull()
    .default('grid'),

  // View-type-specific configuration stored as JSONB
  // AIDEV-NOTE: Schema varies by viewType. Validated by ViewConfig Value Object.
  viewConfig: jsonb("view_config")
    .$type<{
      type: 'grid' | 'metric' | 'chart' | 'form';
      [key: string]: any;
    }>()
    .notNull()
    .default(sql`'{"type": "grid"}'::jsonb`),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  // AIDEV-NOTE: No unique constraint on view names - users can name views however they want

  // Index for organization queries
  index("views_org_idx").on(table.organizationId),

  // Index for table queries
  index("views_table_idx").on(table.tableId),

  // Index for view type queries (e.g., list all metric views)
  index("views_type_idx").on(table.viewType),

  // RLS: Views check BOTH table permissions (inheritance) AND view permissions (independence)
  pgPolicy("views_view_permission", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_id
      AND t.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'table:view',
        t.organization_id,
        'table',
        t.id
      )
    )
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'view:view',
      (SELECT organization_id FROM tables WHERE tables.id = table_id),
      'view',
      id
    )`,
  }),

  // RLS: Views check BOTH table permissions (inheritance) AND view permissions (independence)
  pgPolicy("views_create_permission", {
    as: "permissive",
    for: "insert",
    to: "public",
    withCheck: sql`EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_id
      AND t.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'table:manage',
        t.organization_id,
        'table',
        t.id
      )
    )
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'view:create',
      (SELECT organization_id FROM tables WHERE tables.id = table_id),
      'view',
      id
    )`,
  }),

  // RLS: Views check BOTH table permissions (inheritance) AND view permissions (independence)
  pgPolicy("views_manage_permission", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_id
      AND t.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'table:manage',
        t.organization_id,
        'table',
        t.id
      )
    )
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'view:manage',
      organization_id,
      'view',
      id
    )`,
    withCheck: sql`EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_id
      AND t.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'table:manage',
        t.organization_id,
        'table',
        t.id
      )
    )
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'view:manage',
      organization_id,
      'view',
      id
    )`,
  }),

  // RLS: Allow public access to views marked as not requiring auth
  // AIDEV-NOTE: This enables unauthenticated access to views used on public pages
  pgPolicy("views_public_access", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`requires_auth = false`,
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

  // Model configuration fields for AI billing and access control
  // AIDEV-NOTE: Model selection hierarchy - see /docs/model-selection-hierarchy.md
  // Chat System: Uses organization.defaultModel → System Default
  // Agent Tasks: Uses agent.defaultModel → organization.defaultModel → System Default
  // Skill Execution: Uses skill.model → agent.defaultModel → organization.defaultModel → System Default
  defaultModel: text("default_model"), // Organization-wide default model (used by chat and as fallback for agents/skills)
  availableModels: jsonb("available_models").$type<string[]>().default(sql`'[]'::jsonb`), // Models available to this organization
  tokenQuotaMonthly: integer("token_quota_monthly"), // Monthly token quota (null = unlimited)
  tokenUsageCurrentMonth: integer("token_usage_current_month").default(0), // Current month's token usage
  quotaResetAt: timestamp("quota_reset_at"), // When quota was last reset

  // Credit system fields (1 credit = 1,000 tokens for user-facing billing)
  // AIDEV-NOTE: Credits provide user-friendly billing units. Different models cost different credits per 1K tokens.
  creditBalance: integer("credit_balance").default(0).notNull(), // Current available credits
  creditsUsedCurrentMonth: integer("credits_used_current_month").default(0).notNull(), // Credits used this month
  creditsResetAt: timestamp("credits_reset_at"), // When credits were last reset (for monthly free tier)

  // Pay-as-you-go subscription billing fields (Free/Pro/Max/Enterprise tiers)
  // AIDEV-NOTE: All tiers include monthly credit allowance. Overage billed at end of billing cycle.
  usageAllowanceCredits: integer("usage_allowance_credits").default(0).notNull(), // Credits included in subscription per month
  spendingLimitUsd: numeric("spending_limit_usd", { precision: 10, scale: 2 }).default("0").notNull(), // Overage spending cap (default $0 = allowance-only)
  customPriceId: text("custom_price_id"), // Stripe custom price ID for Enterprise customers (null for standard tiers)
  billingEmail: text("billing_email"), // Email for billing notifications (if different from org owner)
  currentPeriodStart: timestamp("current_period_start"), // Start of current billing period
  currentPeriodEnd: timestamp("current_period_end"), // End of current billing period

  // Storage tracking fields (for billing and quota enforcement)
  // AIDEV-NOTE: Storage quota based on tier (Free: 1GB, Pro: 10GB, Enterprise: 30GB+)
  storageQuotaBytes: bigint("storage_quota_bytes", { mode: "number" }).default(sql`1073741824`).notNull(), // Storage quota in bytes (default 1GB)
  storageUsedBytes: bigint("storage_used_bytes", { mode: "number" }).default(sql`0`).notNull(), // Total storage used in bytes
  databaseStorageBytes: bigint("database_storage_bytes", { mode: "number" }).default(sql`0`).notNull(), // Storage used by database files/docs
  chatStorageBytes: bigint("chat_storage_bytes", { mode: "number" }).default(sql`0`).notNull(), // Storage used by chat attachments
  skillStorageBytes: bigint("skill_storage_bytes", { mode: "number" }).default(sql`0`).notNull(), // Storage used by skill attachments
  storageOverageNotifiedAt: timestamp("storage_overage_notified_at"), // Last time user was notified about storage overage

  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // Index for webhook lookups by Stripe customer ID
  index("organizations_stripe_customer_idx").on(table.stripeCustomerId),

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
  // Role type: system (built-in), personal (user-specific), team (team-specific), custom (org-defined)
  type: text("type", { enum: ['system', 'personal', 'team', 'custom'] }).notNull().default('custom'),
  // User ID for personal roles, null for other types
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
  // Team ID for team roles, null for other types
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("roles_type_idx").on(table.type),
  index("roles_owner_idx").on(table.ownerId),
  index("roles_team_idx").on(table.teamId),
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

  // Published app authentication fields
  isAppOnlyUser: boolean("is_app_only_user").default(false).notNull(), // User restricted to published apps only
  allowedApps: integer("allowed_apps").array(), // App IDs user can access (null = all published apps)
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
  // Public read for app-only users (can only read their own record)
  pgPolicy("users_public_app_read", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`is_app_only_user = true AND id = current_setting('app.current_user_id', true)::uuid`,
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
  ownerId: uuid("owner_id").notNull().references(() => users.id), // Team owner - used for 'owned' scope permissions
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
  ownerId: uuid("owner_id").notNull().references(() => users.id), // Agent owner - used for OAuth credential resolution via proxy
  schedules: jsonb("schedules").$type<ScheduleConfigurationJSON[]>().default(sql`'[]'::jsonb`).notNull(), // Array of schedule configurations with task instructions
  databaseId: text("database_id"),
  status: text("status").default("active"),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  apiKey: text("api_key").unique(), // For API authentication
  lastUsedAt: timestamp("last_used_at"), // Track API key usage

  // Model configuration
  // AIDEV-NOTE: Used for agent task execution, NOT for chat conversations
  // Hierarchy: agent.defaultModel → organization.defaultModel → System Default
  // See /docs/model-selection-hierarchy.md for complete context-specific hierarchies
  defaultModel: text("default_model"), // Agent-specific default model (overrides organization default for task execution only)

  // Avatar configuration (JSON for extensibility)
  avatarConfig: jsonb("avatar_config").$type<{
    version: number;
    icon?: string;
    color?: string;
  }>(),

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

// AIDEV-NOTE: Credential Delegations - OAuth credential sharing permissions
// Tracks which agents have permission to use which owner's OAuth credentials (per service)
// Security: Explicit approval required before agent can use owner's Gmail, Slack, etc.
export const credentialDelegations = pgTable("credential_delegations", {
  id: serial("id").primaryKey(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // User sharing their credentials
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: 'cascade' }), // Agent authorized to use credentials
  services: text("services").array().notNull(), // Array of OAuth services: ['gmail', 'slack', 'github']
  status: text("status").notNull().default('approved'), // approved | pending | revoked
  approvedAt: timestamp("approved_at"),
  expiresAt: timestamp("expires_at"), // Optional time-limited delegation
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  // Unique constraint: one delegation per owner-agent pair
  unique("unique_owner_agent_delegation").on(table.ownerId, table.agentId),
  // Index for fast lookups by agent (most common query path)
  index("delegations_agent_idx").on(table.agentId),
  // Index for owner dashboard queries
  index("delegations_owner_idx").on(table.ownerId),
  // RLS: Users can view delegations they own or delegations for their agents
  pgPolicy("delegations_view_permission", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`
      owner_id = current_setting('app.current_user_id')::uuid
      OR EXISTS (
        SELECT 1 FROM agents a
        WHERE a.id = agent_id
        AND a.organization_id = current_setting('app.current_organization_id')::integer
        AND (
          a.owner_id = current_setting('app.current_user_id')::uuid
          OR user_has_permission(
            current_setting('app.current_user_id')::uuid,
            'agents:view',
            a.organization_id,
            'agent',
            a.id
          )
        )
      )
    `
  }),
  // RLS: Only owners can create delegations for their credentials
  pgPolicy("delegations_create_permission", {
    as: "permissive",
    for: "insert",
    to: "public",
    withCheck: sql`owner_id = current_setting('app.current_user_id')::uuid`
  }),
  // RLS: Only owners can update/delete their delegations
  pgPolicy("delegations_manage_permission", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`owner_id = current_setting('app.current_user_id')::uuid`,
    withCheck: sql`owner_id = current_setting('app.current_user_id')::uuid`
  }),
]);

// AIDEV-NOTE: Skills - simplified single-instruction model with global skills support
// Removed: skillSteps table (multi-step workflow)
// Added: inputs, outputs, instructions (single natural language block), tools
// Added: organizationId (required), agentId nullable (null = global skill)
export const skills = pgTable("skills", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  agentId: integer("agent_id").references(() => agents.id, { onDelete: 'cascade' }), // nullable for organization skills
  ownerId: uuid("owner_id").references(() => users.id), // Skill owner (for org-level skills) - used for 'owned' scope permissions. Null for agent-scoped skills (inherit agent owner)
  name: text("name").notNull(),
  description: text("description").default(''),

  // NEW: Simplified single-instruction model
  inputs: jsonb("inputs").$type<Array<{
    name: string;
    required: boolean;
    type?: SkillParameterType;
    fileConfig?: SkillInputFileConfig;
    default?: any;
  }>>().default([]),
  outputs: jsonb("outputs").$type<Array<{
    name: string;
    type?: SkillParameterType;
  }>>().default([]),
  instructions: text("instructions").notNull().default(''),
  tools: jsonb("tools").default('[]').notNull(),
  content: jsonb("content").$type<MessagePart[]>(), // Skill-level attachments (images, files, text)

  // Model configuration
  // AIDEV-NOTE: Used for skill tool execution (future implementation)
  // Hierarchy: skill.model → agent.defaultModel → organization.defaultModel → System Default
  // See /docs/model-selection-hierarchy.md for complete context-specific hierarchies
  // Status: Schema field exists, NOT yet mapped to Skill entity or exposed in UI
  model: text("model"), // Skill-specific model override (highest priority for skill execution)

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  // Index for organization and agent queries
  index("skills_organization_idx").on(table.organizationId),
  index("skills_agent_idx").on(table.agentId),
  // RBAC-based policy: handles both agent-scoped skills and organization skills
  // AIDEV-NOTE: Must explicitly check agent_id IS NULL vs IS NOT NULL because SQL NULL comparisons return UNKNOWN
  // Agent-scoped skills: Inherit agent permissions (no change)
  // Org-level skills: Use resource-specific skill permissions
  pgPolicy("skills_view_permission", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`
      organization_id = current_setting('app.current_organization_id')::integer
      AND (
        (agent_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM agents a
          WHERE a.id = agent_id
          AND (
            a.owner_id = current_setting('app.current_user_id')::uuid
            OR user_has_permission(
              current_setting('app.current_user_id')::uuid,
              'agents:view',
              a.organization_id,
              'agent',
              a.id
            )
          )
        ))
        OR
        (agent_id IS NULL AND user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'skills:view',
          organization_id,
          'skill',
          id
        ))
      )
    `
  }),
  pgPolicy("skills_manage_permission", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`
      organization_id = current_setting('app.current_organization_id')::integer
      AND (
        (agent_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM agents a
          WHERE a.id = agent_id
          AND (
            a.owner_id = current_setting('app.current_user_id')::uuid
            OR user_has_permission(
              current_setting('app.current_user_id')::uuid,
              'agents:manage',
              a.organization_id,
              'agent',
              a.id
            )
          )
        ))
        OR
        (agent_id IS NULL AND user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'skills:manage',
          organization_id,
          'skill',
          id
        ))
      )
    `,
    withCheck: sql`
      organization_id = current_setting('app.current_organization_id')::integer
      AND (
        (agent_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM agents a
          WHERE a.id = agent_id
          AND (
            a.owner_id = current_setting('app.current_user_id')::uuid
            OR user_has_permission(
              current_setting('app.current_user_id')::uuid,
              'agents:manage',
              a.organization_id,
              'agent',
              a.id
            )
          )
        ))
        OR
        (agent_id IS NULL AND user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'skills:manage',
          organization_id,
          'skill',
          id
        ))
      )
    `
  }),
]);

// AIDEV-NOTE: skillSteps table removed - replaced with single instructions field in skills table

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: integer("agent_id").notNull().references(() => agents.id), // WHICH agent executes this
  organizationId: integer("organization_id").notNull().references(() => organizations.id), // Organization for RLS
  name: text("name").notNull(),
  instructions: jsonb("instructions").notNull(), // Task instructions with tools: {task: string, images?: ImageAttachment[], tools?: ToolConfig[], metadata?: Record<string, any>}
  triggerContext: jsonb("trigger_context"), // What triggered this task: {type: 'DATABASE_EVENT' | 'CALENDAR' | 'WEBHOOK' | 'MANUAL', scheduleName?: string, tableChange?: TableChangeEvent}
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
  metadata: jsonb("metadata").$type<ChatMessageMetadata>(),
  
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

// Token usage tracking for billing
export const tokenUsageLogs = pgTable("token_usage_logs", {
  id: serial("id").primaryKey(),

  // Execution context
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid("user_id").references(() => users.id, { onDelete: 'set null' }),

  // Entity reference (what consumed the tokens)
  entityType: text("entity_type").notNull(), // 'chat', 'skill', 'task', 'instruction'
  entityId: text("entity_id"), // UUID for chat message, integer string for task/skill
  agentId: integer("agent_id").references(() => agents.id, { onDelete: 'set null' }),

  // Model and token details
  modelName: text("model_name").notNull(), // e.g., 'ibm-granite/granite-3.3-8b-instruct'
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),

  // Cost tracking
  costUsd: doublePrecision("cost_usd").notNull().default(0), // Cost in USD (provider cost for internal tracking)
  creditsUsed: doublePrecision("credits_used").notNull().default(0), // Credits consumed (user-facing billing)

  // Metadata
  processingTimeMs: integer("processing_time_ms"), // Processing time in milliseconds
  metadata: jsonb("metadata").$type<{
    taskName?: string;
    skillName?: string;
    chatContext?: string;
    success?: boolean;
    error?: string;
  }>(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  // Indexes for efficient querying
  index("token_usage_organization_idx").on(table.organizationId),
  index("token_usage_user_idx").on(table.userId),
  index("token_usage_entity_idx").on(table.entityType, table.entityId),
  index("token_usage_created_at_idx").on(table.createdAt),

  // RBAC policy: users can view usage for their organization
  pgPolicy("token_usage_view_permission", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND (
        user_id = current_setting('app.current_user_id')::uuid
        OR user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'organizations:manage',
          organization_id
        )
      )`
  }),
]);

// AIDEV-NOTE: Credit purchases table - tracks when organizations buy credit packages
export const creditPurchases = pgTable("credit_purchases", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  // Package details
  packageName: text("package_name").notNull(), // e.g., 'Starter', 'Professional', 'Business', 'Enterprise'
  creditsPurchased: integer("credits_purchased").notNull(), // Number of credits purchased
  amountPaidUsd: doublePrecision("amount_paid_usd").notNull(), // Amount paid in USD

  // Payment tracking
  stripePaymentIntentId: text("stripe_payment_intent_id"), // Stripe payment reference
  paymentStatus: text("payment_status").notNull().default("completed"), // 'pending', 'completed', 'failed', 'refunded'

  // Metadata
  metadata: jsonb("metadata").$type<{
    promoCode?: string;
    discountApplied?: number;
    notes?: string;
  }>(),

  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
}, (table) => [
  // Indexes for efficient querying
  index("credit_purchases_organization_idx").on(table.organizationId),
  index("credit_purchases_date_idx").on(table.purchasedAt),

  // RBAC policy: only organization managers can view credit purchases
  pgPolicy("credit_purchases_view_permission", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'organizations:manage',
        organization_id
      )`
  }),
]);

// AIDEV-NOTE: Invoices table - tracks monthly billing cycles and pay-as-you-go overage charges
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  // Stripe references
  stripeInvoiceId: text("stripe_invoice_id").unique(), // Stripe invoice ID (null for draft/proforma invoices)
  stripeSubscriptionId: text("stripe_subscription_id"), // Associated subscription if applicable

  // Billing period
  periodStart: timestamp("period_start").notNull(), // Start of billing period
  periodEnd: timestamp("period_end").notNull(), // End of billing period

  // Usage breakdown (credits)
  includedCreditsUsed: integer("included_credits_used").default(0).notNull(), // Credits used from subscription allowance
  overageCreditsUsed: integer("overage_credits_used").default(0).notNull(), // Credits used beyond allowance
  totalCreditsUsed: integer("total_credits_used").default(0).notNull(), // Total credits consumed in period

  // Amounts (all in USD)
  subscriptionAmountUsd: numeric("subscription_amount_usd", { precision: 10, scale: 2 }).default("0").notNull(), // Base subscription fee
  overageAmountUsd: numeric("overage_amount_usd", { precision: 10, scale: 2 }).default("0").notNull(), // Pay-as-you-go overage charges
  totalAmountUsd: numeric("total_amount_usd", { precision: 10, scale: 2 }).notNull(), // Total invoice amount

  // Status tracking
  status: text("status").notNull().default("draft"), // 'draft', 'open', 'paid', 'void', 'uncollectible'

  // Timestamps
  invoicedAt: timestamp("invoiced_at"), // When invoice was finalized
  paidAt: timestamp("paid_at"), // When payment was received
  createdAt: timestamp("created_at").defaultNow().notNull(),

  // Metadata for additional context
  metadata: jsonb("metadata").$type<{
    tier?: string; // Subscription tier at time of invoice
    paymentMethod?: string;
    failureReason?: string;
    notes?: string;
  }>(),
}, (table) => [
  // Indexes for efficient querying
  index("invoices_organization_idx").on(table.organizationId),
  index("invoices_stripe_invoice_idx").on(table.stripeInvoiceId),
  index("invoices_period_idx").on(table.periodStart, table.periodEnd),
  index("invoices_status_idx").on(table.status),

  // RBAC policy: only organization managers can view invoices
  pgPolicy("invoices_view_permission", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'organizations:manage',
        organization_id
      )`
  }),
]);

// Tool definition data types for JSONB storage
export interface SystemToolDefinitionData {
  type: "system";
  implementation: {
    backend_class: string;
    requires_auth: boolean;
  };
  ui_config: {
    insert_text: string;
    supports_artifacts?: boolean;
    icon?: string;
  };
  parameters: {
    [key: string]: {
      type: string;
      description?: string;
      required: boolean;
    };
  };
}

export interface OAuthToolDefinitionData {
  type: "oauth";
  implementation: {
    pipedream_key: string;
    requires_auth: boolean;
  };
  ui_config: {
    insert_text: string;
    icon?: string;
  };
  parameters: {
    [key: string]: {
      type: string;
      description?: string;
      required: boolean;
    };
  };
}

export interface ReferenceToolDefinitionData {
  type: "reference";
  implementation: {
    type: string;
    backend_class: string;
    requires_auth: boolean;
  };
  ui_config: {
    insert_text: string;
    icon?: string;
  };
  parameters: {
    [key: string]: {
      type: string;
      description?: string;
      required: boolean;
    };
  };
}

export interface SkillReferenceToolDefinitionData {
  type: "skill_reference";
  implementation: {
    type: string;
    backend_class: string;
    requires_auth: boolean;
  };
  ui_config: {
    insert_text: string;
    icon?: string;
  };
  parameters: {
    [key: string]: {
      type: string;
      description?: string;
      required: boolean;
    };
  };
}

export type ToolDefinitionData = SystemToolDefinitionData | OAuthToolDefinitionData | ReferenceToolDefinitionData | SkillReferenceToolDefinitionData;

// Simplified app types table
export const appTypes = pgTable("app_types", {
  id: text("id").primaryKey(),                    // e.g., "emery", "slack", "github"
  name: text("name").notNull(),                   // e.g., "Emery", "Slack", "GitHub"
  description: text("description"),               // e.g., "Built-in system tools"
  category: text("category"),                     // e.g., "system", "communication", "productivity"
  iconUrl: text("icon_url"),                     // e.g., "/icons/emery.svg"
  supportsOAuth: boolean("supports_oauth").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tools table with required appId
export const tools = pgTable("tools", {
  id: text("id").primaryKey(),                           // e.g., "python_repl", "slack-send-message"
  displayName: text("display_name").notNull(),           // e.g., "Python REPL", "Send Slack Message"
  description: text("description"),                      // Tool description
  category: text("category"),                            // e.g., "utility", "communication"
  appId: text("app_id").notNull().references(() => appTypes.id), // Always references an app - "emery" for system tools
  icon: text("icon"),                                    // Icon or emoji
  config: jsonb("config").$type<ToolDefinitionData>().notNull(), // Typed JSONB configuration
  createdAt: timestamp("created_at").defaultNow(),
});

// AIDEV-NOTE: Puck CMS Tables - Visual page builder system
// Organization-scoped apps containing pages with Puck template data

export const apps = pgTable("apps", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  themeConfig: jsonb("theme_config"),
  homePageId: integer("home_page_id"), // FK to pages.id - constraint added in migration to avoid circular dependency
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id), // App owner - used for 'owned' scope permissions
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  unique("apps_org_slug_unique").on(table.organizationId, table.slug),
  index("apps_org_idx").on(table.organizationId),

  // View permission: Resource-aware permission checking
  pgPolicy("apps_view_permission", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'apps:view',
        current_setting('app.current_organization_id')::integer,
        'app',
        id
      )`,
  }),

  // Create permission: Global permission (no specific resource yet)
  pgPolicy("apps_create_permission", {
    as: "permissive",
    for: "insert",
    to: "public",
    withCheck: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'apps:create',
        current_setting('app.current_organization_id')::integer
      )`,
  }),

  // Manage permission: Resource-aware permission checking
  pgPolicy("apps_manage_permission", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'apps:manage',
        current_setting('app.current_organization_id')::integer,
        'app',
        id
      )`,
  }),

  // Public read: Apps with published pages (NO AUTH REQUIRED)
  pgPolicy("apps_public_read", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`EXISTS (
      SELECT 1 FROM pages p
      WHERE p.app_id = id
      AND p.is_public = true
    )`,
  }),
]);

export const pages = pgTable("pages", {
  id: serial("id").primaryKey(),
  appId: integer("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  order: integer("order").default(0).notNull(),
  templateData: jsonb("template_data").notNull().$type<PuckDataStructure>(),
  themeConfig: jsonb("theme_config"),
  isPublic: boolean("is_public").default(false).notNull(),
  requiresAuth: boolean("requires_auth").default(false).notNull(),
  allowedRoles: text("allowed_roles").array(),
  pageVariables: jsonb("page_variables").$type<PageVariable[]>(), // Expected query parameters for this page
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id), // Page owner - used for 'owned' scope permissions
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  unique("pages_app_slug_unique").on(table.appId, table.slug),
  index("pages_app_idx").on(table.appId),
  index("pages_order_idx").on(table.appId, table.order),

  // View permission: Pages check BOTH apps permissions (inheritance) AND page permissions (independence)
  pgPolicy("pages_view_permission", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`EXISTS (
      SELECT 1 FROM apps a
      WHERE a.id = app_id
      AND a.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'apps:view',
        a.organization_id,
        'app',
        a.id
      )
    )
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'page:view',
      (SELECT organization_id FROM apps WHERE apps.id = app_id),
      'page',
      id
    )`,
  }),

  // Manage permission: Pages check BOTH apps permissions (inheritance) AND page permissions (independence)
  pgPolicy("pages_manage_permission", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`EXISTS (
      SELECT 1 FROM apps a
      WHERE a.id = app_id
      AND a.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'apps:manage',
        a.organization_id,
        'app',
        a.id
      )
    )
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'page:manage',
      (SELECT organization_id FROM apps WHERE apps.id = app_id),
      'page',
      id
    )`,
  }),

  // Publish permission: Pages check BOTH apps permissions (inheritance) AND page permissions (independence)
  pgPolicy("pages_publish_permission", {
    as: "permissive",
    for: "update",
    to: "public",
    using: sql`EXISTS (
      SELECT 1 FROM apps a
      WHERE a.id = app_id
      AND a.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'apps:publish',
        a.organization_id,
        'app',
        a.id
      )
    )
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'page:publish',
      (SELECT organization_id FROM apps WHERE apps.id = app_id),
      'page',
      id
    )`,
  }),

  // Public read: Published pages only (NO AUTH REQUIRED)
  pgPolicy("pages_public_read", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`is_public = true AND requires_auth = false`,
  }),

  // Authenticated read: Public pages requiring authentication with optional role checks
  pgPolicy("pages_authenticated_read", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`
      is_public = true
      AND requires_auth = true
      AND current_setting('app.current_user_id', true)::uuid IS NOT NULL
      AND (
        allowed_roles IS NULL
        OR allowed_roles = '{}'
        OR EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = current_setting('app.current_user_id', true)::uuid
          AND r.name = ANY(allowed_roles)
        )
      )
    `,
  }),
]);