import type { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import { escapeToonValue, extractId, type ToonConfig } from '../formatter';

/**
 * Format tables to TOON format.
 *
 * Key fields only (default):
 * tables[3]{id,name,description,fieldCount}:
 * 1,Users,User accounts,5
 * 2,Orders,Customer orders,8
 *
 * With metadata (?meta=1):
 * tables[3]{id,name,description,fieldCount,databaseId,createdAt}:
 * 1,Users,User accounts,5,1,2024-01-16
 */
export function tablesToToon(tables: DynamicTable[], config: ToonConfig = {}): string {
  const { includeMeta = false, maxItems = 50 } = config;

  const items = tables.slice(0, maxItems);

  // Key fields only by default
  const keyFields = ['id', 'name', 'description', 'fieldCount'];
  const metaFields = includeMeta ? ['databaseId', 'createdAt'] : [];
  const fields = [...keyFields, ...metaFields];

  const header = `tables[${items.length}]{${fields.join(',')}}:`;

  const rows = items.map(t => {
    // Handle both DTOs (fieldCount) and domain entities (fields array)
    const fieldCount = typeof (t as any).fieldCount === 'number'
      ? (t as any).fieldCount
      : (Array.isArray(t.fields) ? t.fields.length : 0);
    const values: (string | number)[] = [
      extractId(t.id),
      escapeToonValue(t.name),
      escapeToonValue((t.description || '').slice(0, 100)),
      fieldCount,
    ];
    if (includeMeta) {
      values.push(
        extractId(t.databaseId),
        t.createdAt?.toISOString().split('T')[0] || ''
      );
    }
    return values.join(',');
  });

  const result = [header, ...rows];

  if (tables.length > maxItems) {
    result.push(`# truncated: ${tables.length - maxItems} more`);
  }

  return result.join('\n');
}

export function tableToToon(table: DynamicTable, config: ToonConfig = {}): string {
  return tablesToToon([table], { ...config, includeMeta: true });
}
