/**
 * Migration script to remove leading slashes from page slugs
 *
 * Run with: pnpm tsx scripts/fix-page-slugs.ts
 *
 * This updates existing pages that have slugs starting with '/' to remove
 * the leading slash, making them consistent with org/app slugs.
 */

import { db } from '../src/ddd/infrastructure/db/client';
import { pages } from '../src/ddd/infrastructure/db/schema';
import { sql } from 'drizzle-orm';

async function fixPageSlugs() {
  console.log('🔧 Starting page slug migration...');

  try {
    // First, let's see what pages have leading slashes
    const pagesWithLeadingSlash = await db
      .select({
        id: pages.id,
        name: pages.name,
        slug: pages.slug,
        appId: pages.appId
      })
      .from(pages)
      .where(sql`${pages.slug} LIKE '/%'`);

    console.log(`Found ${pagesWithLeadingSlash.length} pages with leading slash in slug:`);
    pagesWithLeadingSlash.forEach((page: { id: number; name: string | null; slug: string; appId: number }) => {
      console.log(`  - ID ${page.id}: "${page.name}" | slug: "${page.slug}"`);
    });

    if (pagesWithLeadingSlash.length === 0) {
      console.log('✅ No pages need updating. All slugs are already correct!');
      return;
    }

    // Update all pages by removing the leading slash
    const result = await db
      .update(pages)
      .set({
        slug: sql`LTRIM(${pages.slug}, '/')`
      })
      .where(sql`${pages.slug} LIKE '/%'`);

    console.log(`✅ Updated ${pagesWithLeadingSlash.length} page slugs`);

    // Verify the update
    const verifyPages = await db
      .select({
        id: pages.id,
        name: pages.name,
        slug: pages.slug
      })
      .from(pages)
      .where(sql`${pages.id} IN (${sql.raw(pagesWithLeadingSlash.map((p: { id: number }) => p.id).join(','))})`);

    console.log('\nUpdated slugs:');
    verifyPages.forEach((page: { id: number; name: string | null; slug: string }) => {
      console.log(`  - ID ${page.id}: "${page.name}" | new slug: "${page.slug}"`);
    });

    console.log('\n✨ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
fixPageSlugs()
  .then(() => {
    console.log('\n👋 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
