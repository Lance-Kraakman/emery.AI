/**
 * Database trigger management for agent scheduler
 * Handles PostgreSQL LISTEN/NOTIFY setup for DATABASE_EVENT triggers
 */

import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

export class DatabaseTriggerManager {
  /**
   * Install scheduler database triggers
   * This sets up the PostgreSQL functions needed for DATABASE_EVENT triggers
   */
  static async installTriggers(): Promise<void> {
    console.log('[DB-TRIGGERS] Installing scheduler database triggers...');
    
    try {
      // Read the SQL file with trigger functions
      const sqlFilePath = path.join(process.cwd(), 'database', 'scheduler-triggers.sql');
      
      if (!fs.existsSync(sqlFilePath)) {
        throw new Error(`Scheduler triggers SQL file not found: ${sqlFilePath}`);
      }
      
      const triggerSQL = fs.readFileSync(sqlFilePath, 'utf8');
      
      // Execute the SQL to create functions
      await db.execute(sql.raw(triggerSQL));
      
      console.log('[DB-TRIGGERS] Scheduler database triggers installed successfully');
    } catch (error) {
      console.error('[DB-TRIGGERS] Failed to install scheduler triggers:', error);
      throw error;
    }
  }

  /**
   * Enable triggers on all existing dynamic tables
   * This is useful when first setting up the scheduler
   */
  static async enableTriggersOnAllTables(): Promise<void> {
    console.log('[DB-TRIGGERS] Enabling scheduler triggers on all tables...');
    
    try {
      await db.execute(sql`SELECT enable_scheduler_for_all_tables()`);
      console.log('[DB-TRIGGERS] Enabled triggers on all tables');
    } catch (error) {
      console.error('[DB-TRIGGERS] Failed to enable triggers on all tables:', error);
      throw error;
    }
  }

  /**
   * Disable triggers on all tables
   * Useful for cleanup or troubleshooting
   */
  static async disableTriggersOnAllTables(): Promise<void> {
    console.log('[DB-TRIGGERS] Disabling scheduler triggers on all tables...');
    
    try {
      await db.execute(sql`SELECT disable_scheduler_for_all_tables()`);
      console.log('[DB-TRIGGERS] Disabled triggers on all tables');
    } catch (error) {
      console.error('[DB-TRIGGERS] Failed to disable triggers on all tables:', error);
      throw error;
    }
  }

  /**
   * Add trigger to a specific table
   */
  static async addTriggerToTable(tableName: string, schemaName: string = 'public'): Promise<void> {
    console.log(`[DB-TRIGGERS] Adding trigger to table: ${schemaName}.${tableName}`);
    
    try {
      await db.execute(
        sql`SELECT add_scheduler_trigger_to_table(${tableName}, ${schemaName})`
      );
      console.log(`[DB-TRIGGERS] Added trigger to table: ${schemaName}.${tableName}`);
    } catch (error) {
      console.error(`[DB-TRIGGERS] Failed to add trigger to table ${schemaName}.${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Remove trigger from a specific table
   */
  static async removeTriggerFromTable(tableName: string, schemaName: string = 'public'): Promise<void> {
    console.log(`[DB-TRIGGERS] Removing trigger from table: ${schemaName}.${tableName}`);
    
    try {
      await db.execute(
        sql`SELECT remove_scheduler_trigger_from_table(${tableName}, ${schemaName})`
      );
      console.log(`[DB-TRIGGERS] Removed trigger from table: ${schemaName}.${tableName}`);
    } catch (error) {
      console.error(`[DB-TRIGGERS] Failed to remove trigger from table ${schemaName}.${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Check if trigger functions are installed
   */
  static async checkTriggerInstallation(): Promise<boolean> {
    try {
      const [result] = await db.execute(
        sql`SELECT COUNT(*) as count FROM pg_proc WHERE proname = 'notify_table_change'`
      );
      
      return (result as any).count > 0;
    } catch (error) {
      console.error('[DB-TRIGGERS] Failed to check trigger installation:', error);
      return false;
    }
  }

  /**
   * Get list of tables that have scheduler triggers
   */
  static async getTablesWithTriggers(): Promise<Array<{ schema: string; table: string }>> {
    try {
      const results = await db.execute(sql`
        SELECT 
          t.trigger_schema as schema,
          t.event_object_table as table
        FROM information_schema.triggers t
        WHERE t.trigger_name = 'emery_scheduler_trigger'
        ORDER BY t.trigger_schema, t.event_object_table
      `);

      return results.map((row: any) => ({
        schema: row.schema,
        table: row.table,
      }));
    } catch (error) {
      console.error('[DB-TRIGGERS] Failed to get tables with triggers:', error);
      return [];
    }
  }

  /**
   * Setup triggers for agents with DATABASE_EVENT triggers
   * This automatically adds triggers to tables referenced by agents
   */
  static async setupTriggersForAgents(): Promise<void> {
    console.log('[DB-TRIGGERS] Setting up triggers for agents with DATABASE_EVENT triggers...');
    
    try {
      // First, ensure trigger functions are installed
      const isInstalled = await this.checkTriggerInstallation();
      if (!isInstalled) {
        await this.installTriggers();
      }

      // Get all agents with DATABASE_EVENT triggers
      const databaseEventAgents = await db.execute(sql`
        SELECT id, name, trigger->>'table_id' as table_id
        FROM agents 
        WHERE status = 'active' 
        AND trigger->>'type' = 'DATABASE_EVENT'
        AND trigger->>'table_id' IS NOT NULL
      `);

      let setupCount = 0;
      for (const agent of databaseEventAgents) {
        const tableId = (agent as any).table_id;
        if (tableId) {
          try {
            await this.addTriggerToTable(tableId);
            setupCount++;
          } catch (error) {
            console.error(`[DB-TRIGGERS] Failed to add trigger for agent ${(agent as any).id} table ${tableId}:`, error);
          }
        }
      }

      console.log(`[DB-TRIGGERS] Setup triggers for ${setupCount} database event agents`);
    } catch (error) {
      console.error('[DB-TRIGGERS] Failed to setup triggers for agents:', error);
      throw error;
    }
  }
}

// AIDEV-NOTE: Database trigger management provides:
// 1. PostgreSQL LISTEN/NOTIFY setup for real-time table change notifications
// 2. Automatic trigger installation and management
// 3. Per-table trigger control for fine-grained agent configuration
// 4. Bulk operations for easy setup and cleanup
// 5. Integration with agent DATABASE_EVENT trigger configuration