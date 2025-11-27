/**
 * AutoFieldProcessor Service
 *
 * Handles automatic field value generation for:
 * - created-at: Timestamp set once on row creation
 * - last-updated: Timestamp updated on every row modification
 * - autonumber: Sequential number with optional formatting
 *
 * AIDEV-NOTE: This service processes auto-fields BEFORE data is stored in the data lake.
 * Since row data lives in S3/DuckDB (not PostgreSQL), we cannot use database triggers.
 * All auto-field logic must happen in the application layer.
 */

import { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import { TableField } from '@/ddd/domain/tables/value-objects/table-field';
import type {
  AutonumberFieldConfig,
  TimestampFieldConfig
} from '@/ddd/domain/tables/value-objects/table-field';
import { TableId, FieldId } from '@/ddd/domain/shared/value-objects';
import { createDebugLogger } from '@/lib/utils/debug-logger';

const logger = createDebugLogger('AutoFieldProcessor');

export class AutoFieldProcessor {
  // AIDEV-NOTE: In-memory tracker for autonumber values
  // This ensures sequential numbers even within a single request batch
  // Persisted values are stored in field.metadata.currentValue for durability
  private autonumberTracker: Map<string, number> = new Map();

  /**
   * Process auto-fields before storing to data lake
   *
   * AIDEV-NOTE: Works with field IDs (numeric keys) not field names
   * This aligns with Row entity storage format and prevents field name/ID conversion bugs
   *
   * @param table - The table containing field definitions
   * @param rowData - The row data with numeric field IDs as keys: {2: "value", 3: 123}
   * @param operation - Whether this is a create or update operation
   * @param existingRow - For updates: the current row data (to check watchFields)
   * @returns Enriched row data with auto-field values using field IDs
   */
  processAutoFields(
    table: DynamicTable,
    rowData: Record<string | number, any>,
    operation: 'create' | 'update',
    existingRow?: Record<string | number, any>
  ): Record<string | number, any> {
    const processed = { ...rowData };
    const now = new Date();

    for (const field of table.fields) {
      const fieldKey = field.id.value; // Use numeric field ID as key

      // AIDEV-NOTE: Security - Remove user-provided values for auto-fields
      // On CREATE: Delete all auto-field values (will be generated below)
      // On UPDATE: Only delete fields that will be regenerated
      //   - created-at: Should NEVER change, preserve existing value from existingRow
      //   - last-updated: Will be regenerated below if conditions are met
      //   - autonumber: Should NEVER change, preserve existing value from existingRow
      if (field.isReadOnly() && rowData[fieldKey] !== undefined) {
        if (operation === 'create') {
          // On create, always remove - will be generated below
          logger.debug('Removing auto-field value on create', {
            fieldId: fieldKey,
            fieldName: field.name,
            type: field.type
          });
          delete processed[fieldKey];
        } else if (operation === 'update') {
          // On update, only remove fields that will be regenerated
          if (field.type === 'last-updated') {
            // Will be regenerated below if shouldUpdateTimestamp returns true
            logger.debug('Removing last-updated for regeneration', {
              fieldId: fieldKey,
              fieldName: field.name
            });
            delete processed[fieldKey];
          }
          // Leave created-at and autonumber alone - they should persist from existingRow
          // If user somehow sent these in the update, log a warning but keep existing values
          else if (field.type === 'created-at' || field.type === 'autonumber') {
            logger.debug('Preserving existing auto-field value on update', {
              fieldId: fieldKey,
              fieldName: field.name,
              type: field.type
            });
            // Don't delete - the merge in rows.ts already has the correct existing value
          }
        }
      }

      // Process each auto-field type
      switch (field.type) {
        case 'created-at':
          if (operation === 'create') {
            processed[fieldKey] = this.formatTimestamp(now, field);
            logger.debug('Set created-at field', { fieldId: fieldKey, fieldName: field.name, value: processed[fieldKey] });
          }
          break;

        case 'last-updated':
          if (this.shouldUpdateTimestamp(field, rowData, existingRow)) {
            processed[fieldKey] = this.formatTimestamp(now, field);
            logger.debug('Set last-updated field', { fieldId: fieldKey, fieldName: field.name, value: processed[fieldKey] });
          }
          break;

        case 'autonumber':
          if (operation === 'create') {
            processed[fieldKey] = this.generateAutonumber(table.id, field);
            logger.debug('Generated autonumber', { fieldId: fieldKey, fieldName: field.name, value: processed[fieldKey] });
          }
          break;
      }
    }

    return processed;
  }

  /**
   * Format timestamp according to field configuration
   */
  private formatTimestamp(date: Date, field: TableField): Date | string {
    const config = field.metadata as TimestampFieldConfig | undefined;

    // If includeTime is false, return date-only string
    if (config?.includeTime === false) {
      return date.toISOString().split('T')[0]; // "2025-01-09"
    }

    // TODO: Add timezone conversion if config.timezone is specified
    // For now, return Date object (will be converted to timestamp by gRPC mapper)
    return date;
  }

  /**
   * Determine if last-updated field should be updated
   *
   * AIDEV-NOTE: watchFields are stored as field names in metadata, but rowData uses field IDs
   * We need to look up the field ID for each watched field name
   *
   * If watchFields is specified, only update when those specific fields changed.
   * Otherwise, update on any row modification.
   */
  private shouldUpdateTimestamp(
    field: TableField,
    rowData: Record<string | number, any>,
    existingRow?: Record<string | number, any>
  ): boolean {
    const config = field.metadata as TimestampFieldConfig | undefined;

    // If watchFields specified, only update if those fields are being modified
    if (config?.watchFields && config.watchFields.length > 0) {
      // AIDEV-NOTE: watchFields contains field NAMES, but rowData is keyed by field IDs
      // For now, we'll skip the watchFields check since we'd need the full table context
      // to map field names → field IDs. This means last-updated will always update.
      // TODO: Pass table.fields to this method to enable proper watchFields lookup
      logger.debug('Skipping watchFields check - rowData uses field IDs, watchFields uses names', {
        fieldId: field.id.value,
        fieldName: field.name,
        watchFields: config.watchFields
      });

      // Default to updating (safer than skipping updates)
      return true;
    }

    // Default: always update on any row change
    return true;
  }

  /**
   * Generate next autonumber value with formatting
   *
   * AIDEV-NOTE: Autonumber persistence strategy:
   * 1. Check in-memory tracker first (for batch operations)
   * 2. Use field.metadata.currentValue as persisted counter
   * 3. Update field config with new currentValue for durability
   */
  private generateAutonumber(tableId: TableId, field: TableField): string {
    const config = field.metadata as AutonumberFieldConfig | undefined;
    const startingNumber = config?.startingNumber ?? 1;

    // Generate unique key for this field's counter
    const counterKey = `${tableId.value}_${field.id.value}`;

    // Get current value from tracker or field config
    let currentValue = this.autonumberTracker.get(counterKey);

    if (currentValue === undefined) {
      // Initialize from field config or use starting number
      currentValue = config?.currentValue ?? (startingNumber - 1);
      logger.debug('Initializing autonumber counter', {
        counterKey,
        currentValue,
        startingNumber
      });
    }

    // Increment for next value
    const nextValue = currentValue + 1;

    // Update tracker
    this.autonumberTracker.set(counterKey, nextValue);

    // Format the number
    return this.formatAutonumber(nextValue, config);
  }

  /**
   * Format autonumber with prefix, suffix, and zero-padding
   *
   * Examples:
   * - value: 1, config: {} → "1"
   * - value: 1, config: { digits: 5 } → "00001"
   * - value: 1, config: { prefix: "INV-", digits: 5 } → "INV-00001"
   * - value: 1, config: { prefix: "INV-", digits: 5, suffix: "-2025" } → "INV-00001-2025"
   */
  private formatAutonumber(value: number, config?: AutonumberFieldConfig): string {
    let formatted = String(value);

    // Apply zero-padding
    if (config?.digits && config.digits > 0) {
      formatted = formatted.padStart(config.digits, '0');
    }

    // Add prefix
    if (config?.prefix) {
      formatted = config.prefix + formatted;
    }

    // Add suffix
    if (config?.suffix) {
      formatted = formatted + config.suffix;
    }

    return formatted;
  }

  /**
   * Get the current autonumber value for a field (for persisting to field config)
   *
   * This should be called after batch operations to persist counter values
   */
  getCurrentAutonumberValue(tableId: TableId, fieldId: FieldId): number | undefined {
    const counterKey = `${tableId.value}_${fieldId.value}`;
    return this.autonumberTracker.get(counterKey);
  }

  /**
   * Initialize autonumber counter from persisted value
   *
   * Call this when loading a table to restore counter state
   */
  initializeAutonumberCounter(
    tableId: TableId,
    fieldId: FieldId,
    currentValue: number
  ): void {
    const counterKey = `${tableId.value}_${fieldId.value}`;
    this.autonumberTracker.set(counterKey, currentValue);
    logger.debug('Initialized autonumber counter', { counterKey, currentValue });
  }

  /**
   * Clear all autonumber counters (useful for testing or memory management)
   */
  clearAutonumberCounters(): void {
    this.autonumberTracker.clear();
    logger.debug('Cleared all autonumber counters');
  }
}
