import { escapeToonValue, type ToonConfig } from '../formatter';

/**
 * Compact operation result format for CUD responses.
 *
 * NOTE: This is NOT official TOON format - it's a custom compact format
 * for operation acknowledgments to minimize token usage in agent responses.
 *
 * Format: entity:action,id[,key_data...]
 *
 * Examples:
 *   field:created,42,first_name,text
 *   table:updated,5,Users
 *   row:deleted,abc-123
 *   database:created,1,My Database
 *   app:created,3,My App,my-app
 *   page:published,7,Home,true
 */
export interface OperationResult {
  action: 'created' | 'updated' | 'deleted' | 'published' | 'unpublished';
  entity: 'database' | 'table' | 'field' | 'row' | 'app' | 'page' | 'page_content' | 'page_state' | 'page_dialog';
  id: string | number;
  data?: Record<string, unknown>;
}

export function operationToToon(result: OperationResult, _config: ToonConfig = {}): string {
  const { action, entity, id, data } = result;

  // Start with entity:action,id
  const parts: (string | number)[] = [action, id];

  // Append key data values (up to 3 for brevity)
  if (data && Object.keys(data).length > 0) {
    const dataValues = Object.values(data).slice(0, 3);
    for (const val of dataValues) {
      if (val !== null && val !== undefined && val !== '') {
        parts.push(escapeToonValue(val));
      }
    }
  }

  return `${entity}:${parts.join(',')}`;
}
