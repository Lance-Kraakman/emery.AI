-- Database triggers for real-time task notifications
-- This trigger sends a notification when a new task is created

-- Function to send task notification
CREATE OR REPLACE FUNCTION notify_new_task()
RETURNS TRIGGER AS $$
BEGIN
    -- Send notification with task details
    PERFORM pg_notify(
        'new_task_created',
        json_build_object(
            'task_id', NEW.id,
            'agent_id', NEW."agentId",
            'status', NEW.status,
            'created_at', NEW."createdAt"
        )::text
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on tasks table
DROP TRIGGER IF EXISTS trigger_new_task_created ON tasks;
CREATE TRIGGER trigger_new_task_created
    AFTER INSERT ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_task();

-- Also notify when task status changes to pending (for retry scenarios)
CREATE OR REPLACE FUNCTION notify_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify when status changes to 'pending'
    IF NEW.status = 'pending' AND OLD.status != 'pending' THEN
        PERFORM pg_notify(
            'new_task_created',
            json_build_object(
                'task_id', NEW.id,
                'agent_id', NEW."agentId",
                'status', NEW.status,
                'updated_at', NOW()
            )::text
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for status updates
DROP TRIGGER IF EXISTS trigger_task_status_change ON tasks;
CREATE TRIGGER trigger_task_status_change
    AFTER UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION notify_task_status_change();