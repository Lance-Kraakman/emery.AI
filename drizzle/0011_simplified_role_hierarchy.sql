-- AIDEV-NOTE: Pure Drizzle RBAC - No custom SQL needed!
-- All roles are created by Drizzle pgRole() declarations in schema.ts
-- All policies are managed by Drizzle pgPolicy() declarations
-- This migration file is kept minimal as a placeholder

-- Note: Role hierarchy and permissions are handled entirely through Drizzle
-- The pgRole definitions in schema.ts create the necessary database roles
-- The pgPolicy definitions create the RLS policies with role-based access