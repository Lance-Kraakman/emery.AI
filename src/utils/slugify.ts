export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w\-_]+/g, '')
    .replace(/\_\_+/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '');
}

export function generateTableName(name: string): string {
  const baseSlug = slugify(name);
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `user_table_${baseSlug}_${randomSuffix}`;
}