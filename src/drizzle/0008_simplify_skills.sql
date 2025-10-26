-- Simplify Skills: Remove multi-step workflow, add single instruction model
-- Removes skill_steps table, adds inputs/outputs/instructions/tools columns to skills

-- Drop skill_steps table and its policies
DROP POLICY IF EXISTS "skill_steps_view_permission" ON "skill_steps";
DROP POLICY IF EXISTS "skill_steps_manage_permission" ON "skill_steps";
DROP TABLE IF EXISTS "skill_steps";

-- Add new columns to skills table
ALTER TABLE "skills" ADD COLUMN "inputs" jsonb DEFAULT '[]';
ALTER TABLE "skills" ADD COLUMN "outputs" jsonb DEFAULT '[]';
ALTER TABLE "skills" ADD COLUMN "instructions" text DEFAULT '';
ALTER TABLE "skills" ADD COLUMN "tools" jsonb DEFAULT '[]';

-- Make instructions NOT NULL with default (for any existing rows)
ALTER TABLE "skills" ALTER COLUMN "instructions" SET NOT NULL;
ALTER TABLE "skills" ALTER COLUMN "tools" SET NOT NULL;
