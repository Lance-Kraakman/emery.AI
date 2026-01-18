import type { TableDTO } from '@/app/mappers/table-mapper';
import { escapeToonValue, extractId, type ToonConfig } from '../formatter';

/**
 * Format tables to TOON format.
 * Expects TableDTO from TableMapper.toDTO() - not raw domain entities.
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
export function tablesToToon(tables: TableDTO[], config: ToonConfig = {}): string {
  const { includeMeta = false, maxItems = 50 } = config;

  const items = tables.slice(0, maxItems);

  // Key fields only by default
  const keyFields = ['id', 'name', 'description', 'fieldCount'];
  const metaFields = includeMeta ? ['databaseId', 'createdAt'] : [];
  const fields = [...keyFields, ...metaFields];

  const header = `tables[${items.length}]{${fields.join(',')}}:`;

  const rows = items.map(t => {
    const values: (string | number)[] = [
      t.id,
      escapeToonValue(t.name),
      escapeToonValue((t.description || '').slice(0, 100)),
      t.fieldCount,
    ];
    if (includeMeta) {
      values.push(
        t.databaseId,
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

export function tableToToon(table: TableDTO, config: ToonConfig = {}): string {
  return tablesToToon([table], { ...config, includeMeta: true });
}
