/**
 * Instruction Template Service
 *
 * AIDEV-NOTE: Expands template variables in task instructions with actual trigger context data.
 * Supports ${variable} syntax for referencing trigger metadata, table data, etc.
 *
 * Example:
 * - Input: "Process order ${event.rowId} for ${row.email}"
 * - Output: "Process order abc-123 for user@example.com"
 */

import type { TriggerContext } from '../entities/task';

export class InstructionTemplateService {
  /**
   * Expand template variables in instruction text
   *
   * @param template - Instruction text with ${variable} placeholders
   * @param triggerContext - Context data from the trigger (calendar, database event, etc.)
   * @returns Instruction text with variables replaced with actual values
   */
  static expandTemplate(
    template: string,
    triggerContext: TriggerContext | null
  ): string {
    if (!triggerContext) {
      return template;
    }

    const variables = this.buildVariableMap(triggerContext);

    // Replace ${variable} with actual values
    return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
      const value = this.resolveVariable(path.trim(), variables);
      return value !== undefined ? String(value) : match; // Keep original if not found
    });
  }

  /**
   * Build a flat variable map from trigger context.
   * Used internally for template expansion (no $ prefix).
   */
  static buildVariableMap(
    context: TriggerContext
  ): Record<string, any> {
    const vars: Record<string, any> = {
      'trigger.type': context.type,
      'trigger.scheduleName': context.scheduleName || ''
    };

    // Calendar trigger variables
    if (context.type === 'CALENDAR' && context.calendarData) {
      vars['trigger.scheduledTime'] = context.calendarData.scheduledTime;
      vars['trigger.timezone'] = context.calendarData.timezone;
    }

    // Database event trigger variables
    if (context.type === 'DATABASE_EVENT' && context.tableChange) {
      const tc = context.tableChange;

      vars['table.id'] = tc.tableId;
      vars['table.name'] = tc.tableName;
      vars['event.operation'] = tc.operation;
      vars['event.rowId'] = tc.rowId;
      // Handle both Date objects (in-memory) and ISO strings (after JSONB deserialization)
      vars['event.timestamp'] = tc.timestamp instanceof Date
        ? tc.timestamp.toISOString()
        : tc.timestamp;

      // Enable direct row field access: ${row.fieldName} or ${row[fieldId]}
      // Note: rowData uses field IDs as keys
      if (tc.rowData) {
        // Make row data accessible
        Object.keys(tc.rowData).forEach(fieldKey => {
          vars[`row.${fieldKey}`] = tc.rowData[fieldKey];
        });
      }

      // Previous row data for UPDATE operations
      if (tc.previousRowData) {
        Object.keys(tc.previousRowData).forEach(fieldKey => {
          vars[`previousRow.${fieldKey}`] = tc.previousRowData![fieldKey];
        });
      }
    }

    // Webhook trigger variables
    if (context.type === 'WEBHOOK') {
      // Note: Webhook implementation pending
      // Will include: webhook.payload, webhook.headers, webhook.origin
    }

    return vars;
  }

  /**
   * Build variable map with $ prefix for automation input mappings.
   *
   * Automation inputMappings use $-prefixed variable names (e.g., $trigger.scheduledTime)
   * to reference trigger context data. This method provides a map suitable for resolving
   * those mapping references.
   *
   * @param context - TriggerContext with calendar, database event, or webhook data
   * @returns Variable map with $ prefix on all keys (e.g., "$trigger.scheduledTime")
   */
  static buildVariableMapForMappings(
    context: TriggerContext
  ): Record<string, any> {
    const vars = this.buildVariableMap(context);
    const prefixedVars: Record<string, any> = {};

    for (const [key, value] of Object.entries(vars)) {
      prefixedVars[`$${key}`] = value;
    }

    return prefixedVars;
  }

  /**
   * Resolve a variable path to its value
   * Supports nested paths like "row.email" or "trigger.scheduleName"
   */
  private static resolveVariable(
    path: string,
    variables: Record<string, any>
  ): any {
    // Direct lookup first
    if (path in variables) {
      return variables[path];
    }

    // Try nested path resolution
    const parts = path.split('.');
    let value: any = variables;

    for (const part of parts) {
      if (value === undefined || value === null) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }

  /**
   * Get available variables for a specific trigger type
   * Used by UI to show users what variables they can use
   */
  static getAvailableVariables(
    triggerType: 'CALENDAR' | 'DATABASE_EVENT' | 'WEBHOOK' | 'MANUAL' | 'PIPEDREAM_EVENT'
  ): Array<{ name: string; description: string }> {
    const commonVars = [
      { name: 'trigger.type', description: 'Trigger type (CALENDAR, DATABASE_EVENT, etc.)' },
      { name: 'trigger.scheduleName', description: 'Name of the schedule' }
    ];

    switch (triggerType) {
      case 'CALENDAR':
        return [
          ...commonVars,
          { name: 'trigger.scheduledTime', description: 'Scheduled execution time (ISO format)' },
          { name: 'trigger.timezone', description: 'Schedule timezone' }
        ];

      case 'DATABASE_EVENT':
        return [
          ...commonVars,
          { name: 'table.id', description: 'Table ID' },
          { name: 'table.name', description: 'Table name' },
          { name: 'event.operation', description: 'Operation type (INSERT, UPDATE, DELETE)' },
          { name: 'event.rowId', description: 'Affected row ID' },
          { name: 'event.timestamp', description: 'Event timestamp' },
          { name: 'row.{fieldName}', description: 'Access any field from the row' },
          { name: 'previousRow.{fieldName}', description: 'Previous value (UPDATE only)' }
        ];

      case 'WEBHOOK':
        return [
          ...commonVars,
          { name: 'webhook.payload', description: 'Webhook request body' },
          { name: 'webhook.headers', description: 'Request headers' },
          { name: 'webhook.origin', description: 'Request origin' }
        ];

      case 'PIPEDREAM_EVENT':
        return [
          ...commonVars,
          { name: 'event.data', description: 'Event payload from Pipedream' },
          { name: 'event.timestamp', description: 'Event timestamp' },
          { name: 'event.source', description: 'Source app (e.g., gmail, slack)' }
        ];

      case 'MANUAL':
      default:
        return commonVars;
    }
  }
}
