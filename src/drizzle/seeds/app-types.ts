#!/usr/bin/env tsx

/**
 * Seed App Types from Pipedream Metadata
 *
 * This script parses the Pipedream metadata JSON file and populates the app_types table
 * with available OAuth-enabled applications and their tool counts.
 */

import fs from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { appTypes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

// App metadata mapping for popular apps
const APP_METADATA: Record<string, {
  name: string;
  description: string;
  category: string;
  iconUrl?: string;
  supportsOAuth?: boolean;
}> = {
  'emery': {
    name: 'Emery',
    description: 'Built-in system tools and utilities',
    category: 'system',
    iconUrl: '/icons/emery.svg',
    supportsOAuth: false,
  },
  'slack': {
    name: 'Slack',
    description: 'Send messages, create channels, and manage team communication',
    category: 'communication',
    iconUrl: '/icons/slack.svg',
    supportsOAuth: true,
  },
  'github': {
    name: 'GitHub',
    description: 'Manage repositories, issues, pull requests, and code collaboration',
    category: 'productivity',
    iconUrl: '/icons/github.svg',
    supportsOAuth: true,
  },
  'gmail': {
    name: 'Gmail',
    description: 'Send emails, read inbox, manage labels and organize messages',
    category: 'communication',
    iconUrl: '/icons/gmail.svg',
    supportsOAuth: true,
  },
  'hubspot': {
    name: 'HubSpot',
    description: 'Manage contacts, deals, marketing campaigns, and customer relationships',
    category: 'crm',
    iconUrl: '/icons/hubspot.svg',
    supportsOAuth: true,
  },
  'stripe': {
    name: 'Stripe',
    description: 'Process payments, manage subscriptions, and handle billing',
    category: 'payments',
    iconUrl: '/icons/stripe.svg',
    supportsOAuth: true,
  },
  'shopify': {
    name: 'Shopify',
    description: 'Manage e-commerce store, products, orders, and customers',
    category: 'ecommerce',
    iconUrl: '/icons/shopify.svg',
    supportsOAuth: true,
  },
  'shopify_developer_app': {
    name: 'Shopify Developer',
    description: 'Advanced Shopify integration for developers and agencies',
    category: 'ecommerce',
    iconUrl: '/icons/shopify.svg',
    supportsOAuth: true,
  },
  'clickup': {
    name: 'ClickUp',
    description: 'Manage tasks, projects, goals, and team productivity',
    category: 'productivity',
    iconUrl: '/icons/clickup.svg',
    supportsOAuth: true,
  },
  'trello': {
    name: 'Trello',
    description: 'Organize projects with boards, lists, and cards',
    category: 'productivity',
    iconUrl: '/icons/trello.svg',
    supportsOAuth: true,
  },
  'google-sheets': {
    name: 'Google Sheets',
    description: 'Create, edit, and collaborate on spreadsheets',
    category: 'productivity',
    iconUrl: '/icons/google-sheets.svg',
    supportsOAuth: true,
  },
  'discord': {
    name: 'Discord',
    description: 'Send messages, manage servers, and community interaction',
    category: 'communication',
    iconUrl: '/icons/discord.svg',
    supportsOAuth: true,
  },
  'twitter': {
    name: 'Twitter/X',
    description: 'Post tweets, manage timeline, and social media engagement',
    category: 'social',
    iconUrl: '/icons/twitter.svg',
    supportsOAuth: true,
  },
  'openai': {
    name: 'OpenAI',
    description: 'AI-powered text generation, chat, and language processing',
    category: 'ai',
    iconUrl: '/icons/openai.svg',
    supportsOAuth: false,
  },
  'salesforce_rest_api': {
    name: 'Salesforce',
    description: 'Manage customers, leads, opportunities, and sales processes',
    category: 'crm',
    iconUrl: '/icons/salesforce.svg',
    supportsOAuth: true,
  },
  'mailchimp': {
    name: 'Mailchimp',
    description: 'Email marketing, automation, and audience management',
    category: 'marketing',
    iconUrl: '/icons/mailchimp.svg',
    supportsOAuth: true,
  },
  'zoom_admin': {
    name: 'Zoom',
    description: 'Video conferencing, webinars, and meeting management',
    category: 'communication',
    iconUrl: '/icons/zoom.svg',
    supportsOAuth: true,
  },
};

interface PipedreamTool {
  app: string;
  name: string;
  description?: string;
  type?: string;
}

interface AppTypeData {
  id: string;
  name: string;
  description: string;
  category: string;
  iconUrl?: string;
  supportsOAuth: boolean;
}

async function loadPipedreamMetadata(): Promise<Record<string, PipedreamTool>> {
  const metadataPath = path.join(process.cwd(), 'src', 'public', 'pipedream_metadata.json');

  if (!fs.existsSync(metadataPath)) {
    throw new Error(`Pipedream metadata file not found at ${metadataPath}`);
  }

  console.log(`Loading Pipedream metadata from ${metadataPath}...`);
  const content = fs.readFileSync(metadataPath, 'utf-8');
  const metadata = JSON.parse(content);

  console.log(`Loaded ${Object.keys(metadata).length} Pipedream tools`);
  return metadata;
}

function extractAppStats(metadata: Record<string, PipedreamTool>): Record<string, number> {
  const appStats: Record<string, number> = {};

  for (const tool of Object.values(metadata)) {
    if (tool.app) {
      appStats[tool.app] = (appStats[tool.app] || 0) + 1;
    }
  }

  return appStats;
}

function generateAppTypeData(appId: string): AppTypeData {
  const metadata = APP_METADATA[appId];

  // Generate fallback data for apps not in our metadata
  const fallbackData = {
    name: appId.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    description: `Integration with ${appId} services and tools`,
    category: 'other',
    supportsOAuth: true,
  };

  const appData = metadata || fallbackData;

  return {
    id: appId,
    name: appData.name,
    description: appData.description,
    category: appData.category,
    iconUrl: appData.iconUrl,
    supportsOAuth: appData.supportsOAuth !== false, // Default to true
  };
}

/**
 * Discover additional apps via Pipedream API (optional enhancement)
 * This supplements the apps found in existing metadata
 */
async function discoverAdditionalApps(): Promise<string[]> {
  try {
    // Check if Pipedream client is available (optional feature)
    const pipedreamAvailable = process.env.PIPEDREAM_PROJECT_ID &&
                               process.env.PIPEDREAM_CLIENT_ID &&
                               process.env.PIPEDREAM_CLIENT_SECRET;

    if (!pipedreamAvailable) {
      console.log('  ℹ️  Pipedream API credentials not available, skipping dynamic app discovery');
      return [];
    }

    console.log('  🔍 Attempting dynamic app discovery via Pipedream API...');

    // Dynamic import to avoid dependency if not available
    const { pipedreamClient } = await import('@/lib/pipedream/client');

    if (!pipedreamClient) {
      console.log('  ℹ️  Pipedream client not configured, skipping dynamic discovery');
      return [];
    }

    // Use cursor-based pagination to discover apps (similar to fetch-pipedream-tools.ts)
    const discoveredApps = new Set<string>();
    let cursor: string | undefined = undefined;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 10; // Reasonable limit for seeding
    const limit = 100;

    while (hasMore && pageCount < maxPages) {
      pageCount++;

      try {
        const requestParams: any = { limit };
        if (cursor) {
          requestParams.after = cursor;
        }

        const response = await pipedreamClient.apps.list(requestParams);

        let appsData: any[] = [];
        let pageInfo: any = null;

        if (response && typeof response === 'object') {
          appsData = response.data || [];
          pageInfo = (response as any).page_info || null;
        } else if (Array.isArray(response)) {
          appsData = response;
        }

        if (!Array.isArray(appsData) || appsData.length === 0) {
          hasMore = false;
          break;
        }

        // Extract app slugs
        for (const app of appsData) {
          const appSlug = app.key || app.slug || app.name_slug || app.id;
          if (appSlug && typeof appSlug === 'string') {
            discoveredApps.add(appSlug);
          }
        }

        // Handle pagination
        if (pageInfo && pageInfo.end_cursor) {
          cursor = pageInfo.end_cursor;
          hasMore = pageInfo.has_next_page !== false;
        } else {
          hasMore = false;
        }

      } catch (error) {
        console.warn(`  ⚠️  Error on API page ${pageCount}:`, error);
        hasMore = false;
      }
    }

    const discovered = Array.from(discoveredApps);
    console.log(`  ✅ Discovered ${discovered.length} additional apps via API`);
    return discovered;

  } catch (error) {
    console.warn('  ⚠️  Dynamic app discovery failed:', error);
    return [];
  }
}

async function seedAppTypes(): Promise<void> {
  try {
    console.log('🌱 Starting comprehensive app types seeding...');

    // STEP 1: Ensure ALL system apps are included first
    console.log('🔧 Processing system apps from APP_METADATA...');
    const systemAppIds = Object.keys(APP_METADATA).filter(appId => {
      const metadata = APP_METADATA[appId];
      return !metadata.supportsOAuth; // System apps don't support OAuth
    });
    console.log(`Found ${systemAppIds.length} system apps: ${systemAppIds.join(', ')}`);

    // STEP 2: Load Pipedream metadata for OAuth apps
    const metadata = await loadPipedreamMetadata();

    // Extract OAuth app statistics from Pipedream metadata
    const appStats = extractAppStats(metadata);
    const oauthAppIds = Object.entries(appStats)
      .sort(([, a], [, b]) => b - a) // Sort by tool count descending
      .map(([appId]) => appId);

    console.log(`Found ${oauthAppIds.length} OAuth apps from Pipedream (removed 5+ tool filter)`);
    console.log('Top 10 OAuth apps by tool count:');
    Object.entries(appStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([app, count]) => {
        console.log(`  ${app}: ${count} tools`);
      });

    // Show some apps that would have been excluded before
    const lowToolApps = Object.entries(appStats).filter(([, count]) => count < 5);
    if (lowToolApps.length > 0) {
      console.log(`Including ${lowToolApps.length} OAuth apps with <5 tools (previously excluded):`)
      lowToolApps.slice(0, 5).forEach(([app, count]) => {
        console.log(`  ${app}: ${count} tools`);
      });
    }

    // STEP 3: Discover additional apps via API (optional enhancement)
    console.log('\n🔍 Attempting dynamic app discovery...');
    const discoveredApps = await discoverAdditionalApps();

    // STEP 4: Combine ALL app sources, ensuring system apps come first
    const existingAppIds = new Set([...systemAppIds, ...oauthAppIds]);
    const additionalApps = discoveredApps.filter(appId => !existingAppIds.has(appId));

    if (additionalApps.length > 0) {
      console.log(`📈 Found ${additionalApps.length} additional apps not in existing sources:`);
      additionalApps.slice(0, 10).forEach(appId => {
        console.log(`  + ${appId}`);
      });
    }

    // Generate app type data for ALL apps (system first, then OAuth, then discovered)
    const allAppIds = [...systemAppIds, ...oauthAppIds, ...additionalApps];
    const appTypeData: AppTypeData[] = allAppIds.map(appId => generateAppTypeData(appId));

    console.log(`\n🗃️  Preparing to insert ${appTypeData.length} app types (${systemAppIds.length} system + ${oauthAppIds.length} OAuth + ${additionalApps.length} discovered)...`);

    // Insert app types (upsert)
    for (const appType of appTypeData) {
      try {
        // Check if app type already exists
        const existing = await db.select().from(appTypes).where(eq(appTypes.id, appType.id)).limit(1);

        if (existing.length > 0) {
          // Update existing
          await db.update(appTypes)
            .set({
              name: appType.name,
              description: appType.description,
              category: appType.category,
              iconUrl: appType.iconUrl,
              supportsOAuth: appType.supportsOAuth,
              updatedAt: new Date(),
            })
            .where(eq(appTypes.id, appType.id));

          console.log(`  ✅ Updated ${appType.name}`);
        } else {
          // Insert new
          await db.insert(appTypes).values(appType);
          console.log(`  ✅ Inserted ${appType.name}`);
        }
      } catch (error) {
        console.error(`  ❌ Error processing ${appType.name}:`, error);
      }
    }

    // Summary
    const totalApps = await db.select().from(appTypes);
    console.log(`\n🎉 App types seeding complete! Total app types in database: ${totalApps.length}`);
    console.log(`System apps: ${totalApps.filter(app => !app.supportsOAuth).length}`);
    console.log(`OAuth-enabled apps: ${totalApps.filter(app => app.supportsOAuth).length}`);

  } catch (error) {
    console.error('❌ Error seeding app types:', error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    await seedAppTypes();
  } catch (error) {
    console.error('Failed to seed app types:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main();
}

export { seedAppTypes };