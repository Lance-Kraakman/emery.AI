ALTER TABLE "tools" ADD COLUMN "is_trigger" boolean DEFAULT false;

-- Update existing tools that are triggers (have timer or triggerType in parameters)
-- These are Pipedream event sources, not actions
UPDATE "tools"
SET "is_trigger" = true
WHERE config->>'type' = 'oauth'
  AND (config->'parameters' ? 'timer' OR config->'parameters' ? 'triggerType');