-- Database triggers for agent scheduler
-- This enables DATABASE_EVENT triggers for table changes

-- Function to notify about table changes
CREATE OR REPLACE FUNCTION notify_table_change()
RETURNS trigger AS $$
DECLARE
    table_name_extracted text;
BEGIN
    -- Extract the base table name (remove prefix if any)
    table_name_extracted := TG_TABLE_NAME;
    
    -- For dynamic tables created by Emery, extract the actual table identifier
    -- Dynamic tables might have naming patterns we want to normalize
    
    -- Create notification payload
    PERFORM pg_notify(
        'emery_table_changes',
        json_build_object(
            'table_id', table_name_extracted,
            'table_name', TG_TABLE_NAME,
            'operation', TG_OP,
            'schema', TG_TABLE_SCHEMA,
            'timestamp', extract(epoch from now()),
            'row_data', CASE 
                WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)
                ELSE row_to_json(NEW)
            END
        )::text
    );
    
    -- Return appropriate row based on operation
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Helper function to add triggers to existing tables
CREATE OR REPLACE FUNCTION add_scheduler_trigger_to_table(table_name text, schema_name text DEFAULT 'public')
RETURNS void AS $$
BEGIN
    -- Create trigger for INSERT, UPDATE, DELETE
    EXECUTE format('
        CREATE TRIGGER emery_scheduler_trigger
        AFTER INSERT OR UPDATE OR DELETE ON %I.%I
        FOR EACH ROW EXECUTE FUNCTION notify_table_change()
    ', schema_name, table_name);
    
    RAISE NOTICE 'Added scheduler trigger to table: %.%', schema_name, table_name;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Scheduler trigger already exists on table: %.%', schema_name, table_name;
    WHEN others THEN
        RAISE EXCEPTION 'Failed to add scheduler trigger to table %.%: %', schema_name, table_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Helper function to remove triggers from tables
CREATE OR REPLACE FUNCTION remove_scheduler_trigger_from_table(table_name text, schema_name text DEFAULT 'public')
RETURNS void AS $$
BEGIN
    EXECUTE format('DROP TRIGGER IF EXISTS emery_scheduler_trigger ON %I.%I', schema_name, table_name);
    RAISE NOTICE 'Removed scheduler trigger from table: %.%', schema_name, table_name;
EXCEPTION
    WHEN others THEN
        RAISE EXCEPTION 'Failed to remove scheduler trigger from table %.%: %', schema_name, table_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Function to enable scheduler triggers on all existing dynamic tables
-- This can be called when setting up agents with DATABASE_EVENT triggers
CREATE OR REPLACE FUNCTION enable_scheduler_for_all_tables()
RETURNS void AS $$
DECLARE
    tbl record;
BEGIN
    -- Add triggers to all user tables (exclude system tables)
    FOR tbl IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE 'pg_%'
        AND tablename NOT LIKE 'drizzle%'
        AND tablename NOT IN ('organizations', 'users', 'agents', 'tasks', 'roles', 'permissions', 'teams', 'team_memberships', 'fields', 'tables')
    LOOP
        BEGIN
            PERFORM add_scheduler_trigger_to_table(tbl.tablename, tbl.schemaname);
        EXCEPTION
            WHEN others THEN
                RAISE NOTICE 'Skipped table %.%: %', tbl.schemaname, tbl.tablename, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Completed enabling scheduler triggers on all applicable tables';
END;
$$ LANGUAGE plpgsql;

-- Function to disable scheduler triggers on all tables
CREATE OR REPLACE FUNCTION disable_scheduler_for_all_tables()
RETURNS void AS $$
DECLARE
    tbl record;
BEGIN
    FOR tbl IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        BEGIN
            PERFORM remove_scheduler_trigger_from_table(tbl.tablename, tbl.schemaname);
        EXCEPTION
            WHEN others THEN
                -- Ignore errors for tables that don't have the trigger
                NULL;
        END;
    END LOOP;
    
    RAISE NOTICE 'Completed disabling scheduler triggers on all tables';
END;
$$ LANGUAGE plpgsql;

-- Example usage:
-- To enable triggers on all existing tables:
-- SELECT enable_scheduler_for_all_tables();
--
-- To add trigger to a specific table:
-- SELECT add_scheduler_trigger_to_table('my_table_name');
--
-- To remove trigger from a specific table: 
-- SELECT remove_scheduler_trigger_from_table('my_table_name');
--
-- To disable all scheduler triggers:
-- SELECT disable_scheduler_for_all_tables();

COMMENT ON FUNCTION notify_table_change() IS 'Trigger function that sends notifications for table changes to agent scheduler';
COMMENT ON FUNCTION add_scheduler_trigger_to_table(text, text) IS 'Add scheduler trigger to a specific table for DATABASE_EVENT agent triggers';
COMMENT ON FUNCTION remove_scheduler_trigger_from_table(text, text) IS 'Remove scheduler trigger from a specific table';
COMMENT ON FUNCTION enable_scheduler_for_all_tables() IS 'Enable scheduler triggers on all user tables';
COMMENT ON FUNCTION disable_scheduler_for_all_tables() IS 'Disable scheduler triggers on all tables';