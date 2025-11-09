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
   * @param table - The table containing field definitions
   * @param rowData - The row data to process
   * @param operation - Whether this is a create or update operation
   * @param existingRow - For updates: the current row data (to check watchFields)
   * @returns Enriched row data with auto-field values
   */
  processAutoFields(
    table: DynamicTable,
    rowData: Record<string, any>,
    operation: 'create' | 'update',
    existingRow?: Record<string, any>
  ): Record<string, any> {
    const processed = { ...rowData };
    const now = new Date().toISOString();

    for (const field of table.fields) {
      // AIDEV-NOTE: Security - Remove any user-provided values for read-only fields
      // This prevents users from manually setting auto-generated values
      if (field.isReadOnly() && rowData[field.name] !== undefined) {
        logger.debug('Ignoring manual value for read-only field', {
          field: field.name,
          type: field.type
        });
        delete processed[field.name];
      }

      // Process each auto-field type
      switch (field.type) {
        case 'created-at':
          if (operation === 'create') {
            processed[field.name] = this.formatTimestamp(now, field);
            logger.debug('Set created-at field', { field: field.name, value: processed[field.name] });
          }
          break;

        case 'last-updated':
          if (this.shouldUpdateTimestamp(field, rowData, existingRow)) {
            processed[field.name] = this.formatTimestamp(now, field);
            logger.debug('Set last-updated field', { field: field.name, value: processed[field.name] });
          }
          break;

        case 'autonumber':
          if (operation === 'create') {
            processed[field.name] = this.generateAutonumber(table.id, field);
            logger.debug('Generated autonumber', { field: field.name, value: processed[field.name] });
          }
          break;
      }
    }

    return processed;
  }

  /**
   * Format timestamp according to field configuration
   */
  private formatTimestamp(isoString: string, field: TableField): string {
    const config = field.metadata as TimestampFieldConfig | undefined;

    // If includeTime is false, return date only
    if (config?.includeTime === false) {
      return isoString.split('T')[0]; // "2025-01-09"
    }

    // TODO: Add timezone conversion if config.timezone is specified
    // For now, always return UTC ISO string
    return isoString;
  }

  /**
   * Determine if last-updated field should be updated
   *
   * If watchFields is specified, only update when those specific fields changed.
   * Otherwise, update on any row modification.
   */
  private shouldUpdateTimestamp(
    field: TableField,
    rowData: Record<string, any>,
    existingRow?: Record<string, any>
  ): boolean {
    const config = field.metadata as TimestampFieldConfig | undefined;

    // If watchFields specified, only update if those fields are being modified
    if (config?.watchFields && config.watchFields.length > 0) {
      const watchedFieldsChanged = config.watchFields.some(watchField => {
        // Check if this watched field is present in the update data
        if (watchField in rowData) {
          // If we have the existing row, check if value actually changed
          if (existingRow) {
            return rowData[watchField] !== existingRow[watchField];
          }
          // No existing row data - assume it changed
          return true;
        }
        return false;
      });

      return watchedFieldsChanged;
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
