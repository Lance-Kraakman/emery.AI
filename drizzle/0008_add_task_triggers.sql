-- Migration: Add PostgreSQL triggers for task change notifications
-- This enables the database dispatcher to automatically process new tasks

-- Create trigger function for task changes
CREATE OR REPLACE FUNCTION notify_task_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Notify about task table changes
    PERFORM pg_notify(
        'table_change_event',
        json_build_object(
            'table_name', TG_TABLE_NAME,
            'operation', TG_OP,
            'new_data', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
        )::text
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on tasks table for INSERT operations
-- This will fire when new tasks are created via the frontend
CREATE TRIGGER task_insert_trigger
    AFTER INSERT ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION notify_task_change();