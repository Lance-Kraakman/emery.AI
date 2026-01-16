import type { Database } from '@/ddd/domain/databases/entities/database';
import { escapeToonValue, extractId, type ToonConfig } from '../formatter';

/**
 * Format databases to TOON format.
 *
 * Key fields only (default):
 * databases[3]{id,name,slug}:
 * 1,Main DB,main-db
 * 2,Analytics,analytics
 *
 * With metadata (?meta=1):
 * databases[3]{id,name,slug,organizationId,createdAt}:
 * 1,Main DB,main-db,5,2024-01-16
 */
export function databasesToToon(databases: Database[], config: ToonConfig = {}): string {
  const { includeMeta = false, maxItems = 50 } = config;

  const items = databases.slice(0, maxItems);

  const keyFields = ['id', 'name', 'slug'];
  const metaFields = includeMeta ? ['organizationId', 'createdAt'] : [];
  const fields = [...keyFields, ...metaFields];

  const header = `databases[${items.length}]{${fields.join(',')}}:`;

  const rows = items.map(d => {
    const values: (string | number)[] = [
      extractId(d.id),
      escapeToonValue(d.name),
      escapeToonValue(d.slug),
    ];
    if (includeMeta) {
      values.push(
        extractId(d.organizationId),
        d.createdAt?.toISOString().split('T')[0] || ''
      );
    }
    return values.join(',');
  });

  const result = [header, ...rows];

  if (databases.length > maxItems) {
    result.push(`# truncated: ${databases.length - maxItems} more`);
  }

  return result.join('\n');
}

export function databaseToToon(database: Database, config: ToonConfig = {}): string {
  return databasesToToon([database], { ...config, includeMeta: true });
}
