-- Remove all system skills from database
-- System skills are being deprecated in favor of user-created skills
DELETE FROM skills WHERE is_system = true AND agent_id IS NULL AND owner_id IS NULL;
