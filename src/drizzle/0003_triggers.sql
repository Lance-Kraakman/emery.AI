-- Custom SQL migration file, put your code below! --

-- =============================================================================
-- TRIGGERS (must be created after tables and functions exist)
-- =============================================================================

-- Task notification trigger
DROP TRIGGER IF EXISTS task_notification_trigger ON tasks;--> statement-breakpoint
CREATE TRIGGER task_notification_trigger
    AFTER INSERT ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_task();