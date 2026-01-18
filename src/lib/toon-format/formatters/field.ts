import type { TableField } from '@/ddd/domain/tables/value-objects/table-field';
import { escapeToonValue, extractId, type ToonConfig } from '../formatter';

/**
 * Format fields to TOON format.
 *
 * Key fields:
 * fields[5]{id,name,type}:
 * 1,email,text
 * 2,name,text
 *
 * With metadata:
 * fields[5]{id,name,type,required,orderIndex}:
 * 1,email,text,true,0
 */
export function fieldsToToon(fields: TableField[], config: ToonConfig = {}): string {
  const { includeMeta = false, maxItems = 50 } = config;

  const items = fields.slice(0, maxItems);

  const keyFields = ['id', 'name', 'type'];
  const metaFields = includeMeta ? ['required', 'orderIndex'] : [];
  const allFields = [...keyFields, ...metaFields];

  const header = `fields[${items.length}]{${allFields.join(',')}}:`;

  const rows = items.map(f => {
    const values: (string | number | boolean)[] = [
      extractId(f.id),
      escapeToonValue(f.name),
      f.type,
    ];
    if (includeMeta) {
      values.push(
        f.required || false,
        f.orderIndex || 0
      );
    }
    return values.join(',');
  });

  const result = [header, ...rows];

  if (fields.length > maxItems) {
    result.push(`# truncated: ${fields.length - maxItems} more`);
  }

  return result.join('\n');
}

export function fieldToToon(field: TableField, config: ToonConfig = {}): string {
  return fieldsToToon([field], { ...config, includeMeta: true });
}
