-- Migration: Add global skills support
-- Description: Add organization_id column and make agent_id nullable to support both agent-scoped and global skills

-- Step 1: Make agent_id nullable (for global skills)
ALTER TABLE "skills" ALTER COLUMN "agent_id" DROP NOT NULL;

-- Step 2: Add organization_id column (nullable initially to allow data migration)
ALTER TABLE "skills" ADD COLUMN "organization_id" integer;

-- Step 3: Migrate existing data - set organization_id from agent's organization
-- This ensures all existing agent-scoped skills get the correct organization_id
UPDATE "skills" SET "organization_id" = (
  SELECT "organization_id" FROM "agents" WHERE "agents"."id" = "skills"."agent_id"
) WHERE "agent_id" IS NOT NULL;

-- Step 4: Make organization_id NOT NULL after data migration
ALTER TABLE "skills" ALTER COLUMN "organization_id" SET NOT NULL;

-- Step 5: Add foreign key constraint
ALTER TABLE "skills" ADD CONSTRAINT "skills_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

-- Step 6: Create indexes for performance
CREATE INDEX IF NOT EXISTS "skills_organization_idx" ON "skills" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "skills_agent_idx" ON "skills" USING btree ("agent_id");
