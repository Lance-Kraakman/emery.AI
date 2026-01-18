import type { PageDTO } from '@/app/mappers/puck-page-mapper';
import { escapeToonValue, type ToonConfig } from '../formatter';

/**
 * Format pages to TOON format.
 *
 * Key fields only (default):
 * pages[3]{id,appId,name,slug,order,isPublic,requiresAuth}:
 * 1,1,Home,home,0,true,false
 * 2,1,About,about,1,true,false
 * 3,1,Settings,settings,2,false,true
 *
 * With metadata (?meta=1):
 * pages[3]{id,appId,name,slug,order,isPublic,requiresAuth,description,ownerId,createdAt}:
 * 1,1,Home,home,0,true,false,Landing page,user-123,2024-01-16
 */
export function pagesToToon(pages: PageDTO[], config: ToonConfig = {}): string {
  const { includeMeta = false, maxItems = 50 } = config;

  const items = pages.slice(0, maxItems);

  // Key fields for LLM consumption - most useful for understanding page structure
  const keyFields = ['id', 'appId', 'name', 'slug', 'order', 'isPublic', 'requiresAuth'];
  const metaFields = includeMeta ? ['description', 'ownerId', 'createdAt'] : [];
  const fields = [...keyFields, ...metaFields];

  const header = `pages[${items.length}]{${fields.join(',')}}:`;

  const rows = items.map((page) => {
    const values: (string | number | boolean)[] = [
      page.id,
      page.appId,
      escapeToonValue(page.name),
      escapeToonValue(page.slug),
      page.order,
      page.isPublic,
      page.requiresAuth,
    ];
    if (includeMeta) {
      values.push(
        escapeToonValue((page.description || '').slice(0, 100)),
        escapeToonValue(page.ownerId || ''),
        page.createdAt?.split('T')[0] || ''
      );
    }
    return values.join(',');
  });

  const result = [header, ...rows];

  if (pages.length > maxItems) {
    result.push(`# truncated: ${pages.length - maxItems} more`);
  }

  return result.join('\n');
}

export function pageToToon(page: PageDTO, config: ToonConfig = {}): string {
  return pagesToToon([page], { ...config, includeMeta: true });
}
