import type { AppDTO } from '@/app/mappers/puck-app-mapper';
import { escapeToonValue, type ToonConfig } from '../formatter';

/**
 * Format apps to TOON format.
 *
 * Key fields only (default):
 * apps[3]{id,name,slug,description,homePageId}:
 * 1,My App,my-app,Main application,5
 * 2,Dashboard,dashboard,Analytics dashboard,
 *
 * With metadata (?meta=1):
 * apps[3]{id,name,slug,description,homePageId,createdBy,createdAt}:
 * 1,My App,my-app,Main application,5,user-123,2024-01-16
 */
export function appsToToon(apps: AppDTO[], config: ToonConfig = {}): string {
  const { includeMeta = false, maxItems = 50 } = config;

  const items = apps.slice(0, maxItems);

  // Key fields for LLM consumption - most useful for understanding app structure
  const keyFields = ['id', 'name', 'slug', 'description', 'homePageId'];
  const metaFields = includeMeta ? ['createdBy', 'createdAt'] : [];
  const fields = [...keyFields, ...metaFields];

  const header = `apps[${items.length}]{${fields.join(',')}}:`;

  const rows = items.map((app) => {
    const values: (string | number)[] = [
      app.id,
      escapeToonValue(app.name),
      escapeToonValue(app.slug),
      escapeToonValue((app.description || '').slice(0, 100)),
      app.homePageId ?? '',
    ];
    if (includeMeta) {
      values.push(
        escapeToonValue(app.createdBy || ''),
        app.createdAt?.split('T')[0] || ''
      );
    }
    return values.join(',');
  });

  const result = [header, ...rows];

  if (apps.length > maxItems) {
    result.push(`# truncated: ${apps.length - maxItems} more`);
  }

  return result.join('\n');
}

export function appToToon(app: AppDTO, config: ToonConfig = {}): string {
  return appsToToon([app], { ...config, includeMeta: true });
}
