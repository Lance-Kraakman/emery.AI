-- Add organization_id column as nullable first
ALTER TABLE "tasks" ADD COLUMN "organization_id" integer;--> statement-breakpoint

-- Populate organization_id for existing tasks from their agents
UPDATE tasks 
SET organization_id = agents.organization_id
FROM agents 
WHERE tasks.agent_id = agents.id
AND tasks.organization_id IS NULL;--> statement-breakpoint

-- Now make the column NOT NULL since all existing data has been populated
ALTER TABLE "tasks" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint

-- Add the foreign key constraint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;