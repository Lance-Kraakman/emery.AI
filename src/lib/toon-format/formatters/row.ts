import { escapeToonValue, type ToonConfig } from '../formatter';

/**
 * Generic row data type - rows are dynamic based on table schema
 */
export type RowData = Record<string, unknown>;

/**
 * Format rows to TOON format.
 * Rows are dynamic - fields are determined by the first row or provided fieldNames.
 *
 * Example:
 * rows[3]{id,email,name}:
 * 1,alice@test.com,Alice
 * 2,bob@test.com,Bob
 *
 * With metadata:
 * rows[3]{id,email,name,createdAt,updatedAt}:
 * 1,alice@test.com,Alice,2024-01-16,2024-01-16
 */
export function rowsToToon(
  rows: RowData[],
  config: ToonConfig & { fieldNames?: string[] } = {}
): string {
  const { includeMeta = false, maxItems = 50, fieldNames } = config;

  if (rows.length === 0) {
    return 'rows[0]{}:';
  }

  const items = rows.slice(0, maxItems);

  // Determine field names from first row or provided list
  const allKeys = fieldNames || Object.keys(items[0]);

  // Separate key fields from metadata fields
  const metaFieldNames = ['createdAt', 'updatedAt', 'ownerId', '_id'];
  const keyFields = allKeys.filter(k => !metaFieldNames.includes(k));
  const metaFields = includeMeta
    ? allKeys.filter(k => metaFieldNames.includes(k))
    : [];

  const fields = [...keyFields, ...metaFields];

  const header = `rows[${items.length}]{${fields.join(',')}}:`;

  const rowLines = items.map(row => {
    const values = fields.map(field => {
      const value = row[field];
      if (value === null || value === undefined) {
        return '';
      }
      if (value instanceof Date) {
        return value.toISOString().split('T')[0];
      }
      if (typeof value === 'object') {
        return escapeToonValue(JSON.stringify(value));
      }
      return escapeToonValue(value);
    });
    return values.join(',');
  });

  const result = [header, ...rowLines];

  if (rows.length > maxItems) {
    result.push(`# truncated: ${rows.length - maxItems} more`);
  }

  return result.join('\n');
}

export function rowToToon(row: RowData, config: ToonConfig = {}): string {
  return rowsToToon([row], { ...config, includeMeta: true });
}
