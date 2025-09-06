-- Drop the conflicting tasks_creator_control policy that bypasses agent permissions
-- This policy was allowing any user to create tasks as long as they set themselves as creator,
-- which bypassed the agent permission checks in tasks_agent_assignment_permissions
DROP POLICY IF EXISTS "tasks_creator_control" ON "tasks";

-- The tasks_agent_assignment_permissions and tasks_team_assignment_permissions policies
-- now handle all INSERT permission checks for tasks based on agent/team permissions