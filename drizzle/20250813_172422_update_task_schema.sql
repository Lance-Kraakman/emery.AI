-- Update tasks table to use instructions JSONB field instead of payload
-- This migration renames payload to instructions and makes capabilityName optional

-- First, rename payload column to instructions (keeping JSONB type)
ALTER TABLE tasks RENAME COLUMN payload TO instructions;

-- Make capabilityName nullable (allow auto-routing)
ALTER TABLE tasks ALTER COLUMN capability_name DROP NOT NULL;

-- Add comment to clarify the new structure
COMMENT ON COLUMN tasks.instructions IS 'Step-like configuration: {instructions: string, tools?: ToolConfig[], servers?: ServerConfig[]}';
COMMENT ON COLUMN tasks.capability_name IS 'Optional - system can auto-route if not specified';
