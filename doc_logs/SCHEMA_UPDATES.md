# Schema.ts Updates for RLS Compatibility

## ✅ Fixed Issues

### 1. **Added missing `organization_id` to tasks table**
```typescript
// BEFORE: Missing organization_id column
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: integer("agent_id").notNull().references(() => agents.id),
  name: text("name").notNull(),
  // ... other fields
});

// AFTER: Added required organization_id for RLS
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: integer("agent_id").notNull().references(() => agents.id),
  organizationId: integer("organization_id").notNull().references(() => organizations.id), // Organization for RLS
  name: text("name").notNull(),
  // ... other fields
});
```

### 2. **Made agents.organization_id required**
```typescript
// BEFORE: Optional organization_id
organizationId: integer("organization_id").references(() => organizations.id),

// AFTER: Required for proper RLS isolation
organizationId: integer("organization_id").notNull().references(() => organizations.id),
```

### 3. **Made rag_indexes.organization_id required**
```typescript
// BEFORE: Optional organization_id
organizationId: integer("organization_id").references(() => organizations.id),

// AFTER: Required for RAG isolation
organizationId: integer("organization_id").notNull().references(() => organizations.id),
```

## 🔄 Migration Required

After these schema changes, you'll need to generate and apply a new migration:

```bash
# Generate migration for schema changes
pnpm db:generate

# Apply migration to development database
pnpm db:migrate
```

## ✅ Schema Validation

The schema.ts now correctly matches our RLS implementation:

- ✅ **tasks table**: Has required `organization_id` for tenant isolation
- ✅ **agents table**: Has required `organization_id` for agent isolation  
- ✅ **rag_indexes table**: Has required `organization_id` for RAG isolation
- ✅ **rag_documents table**: Already has required `organization_id` (denormalized)
- ✅ **All other tables**: Correctly reference organizations for multi-tenancy

## 🎯 Next Steps

1. **Generate Migration**: `pnpm db:generate` to create migration file
2. **Apply Migration**: `pnpm db:migrate` to update database schema
3. **Update Code**: Ensure all task/agent creation includes `organizationId`
4. **Test Integration**: Re-run integration tests to verify RLS works completely

This ensures our TypeScript schema definition matches the actual database structure expected by our RLS policies.