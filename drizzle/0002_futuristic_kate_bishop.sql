-- Create databases table
CREATE TABLE "databases" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"metadata" jsonb,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "databases_slug_unique" UNIQUE("slug")
);

-- Add foreign key constraints to databases table
ALTER TABLE "databases" ADD CONSTRAINT "databases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "databases" ADD CONSTRAINT "databases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

-- Create a default database for each organization that has tables
INSERT INTO "databases" ("organization_id", "name", "slug", "metadata", "created_by")
SELECT DISTINCT 
    t.organization_id,
    'Default Database' as name,
    'default-db-' || t.organization_id as slug,
    '{"description": "Default database created during migration"}'::jsonb as metadata,
    t.created_by
FROM "tables" t
WHERE t.organization_id IS NOT NULL;

-- Add database_id column to tables (nullable first)
ALTER TABLE "tables" ADD COLUMN "database_id" integer;

-- Update existing tables to reference the default database
UPDATE "tables" 
SET "database_id" = (
    SELECT d.id 
    FROM "databases" d 
    WHERE d.organization_id = "tables".organization_id 
    AND d.slug = 'default-db-' || "tables".organization_id
    LIMIT 1
);

-- Now make database_id NOT NULL and add foreign key constraint
ALTER TABLE "tables" ALTER COLUMN "database_id" SET NOT NULL;
ALTER TABLE "tables" ADD CONSTRAINT "tables_database_id_databases_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."databases"("id") ON DELETE no action ON UPDATE no action;

-- Add other new columns to tables
ALTER TABLE "tables" ADD COLUMN "metadata" jsonb;
ALTER TABLE "tables" ADD COLUMN "updated_at" timestamp DEFAULT now();