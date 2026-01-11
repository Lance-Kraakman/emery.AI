-- Add agent_id column to databases table
-- Enables agent-scoped databases: null = org-scoped, set = agent-scoped
ALTER TABLE "databases" ADD COLUMN "agent_id" integer REFERENCES "agents"("id") ON DELETE CASCADE;

-- Create index for efficient agent-based queries
CREATE INDEX "databases_agent_id_idx" ON "databases" ("agent_id");
