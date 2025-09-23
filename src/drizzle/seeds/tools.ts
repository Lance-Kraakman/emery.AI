#!/usr/bin/env tsx

/**
 * Seed Tools from Registry and Pipedream Metadata
 *
 * This script populates the tools table with:
 * 1. System tools from tools-registry.json (appId: "emery")
 * 2. OAuth tools from Pipedream metadata (appId: matching app)
 */

import fs from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { tools, appTypes, type SystemToolDefinitionData, type OAuthToolDefinitionData } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

interface CuratedTool {
  id: string;
  display_name: string;
  description: string;
  category: string;
  app: string;
  tags: string[];
  ui_config: {
    icon: string;
    insert_text: string;
    supports_artifacts?: boolean;
    preview_description?: string;
  };
  implementation: {
    type: string;
    backend_class: string;
    requires_auth: boolean;
  };
  parameters: {
    [key: string]: {
      type: string;
      description: string;
      required: boolean;
    };
  };
}

interface PipedreamTool {
  app: string;
  name: string;
  description?: string;
  type?: string;
}

interface ToolData {
  id: string;
  displayName: string;
  description: string;
  category: string;
  appId: string;
  icon: string;
  config: SystemToolDefinitionData | OAuthToolDefinitionData;
}

async function loadCuratedTools(): Promise<CuratedTool[]> {
  const registryPath = path.join(process.cwd(), 'src', 'public', 'tools-registry.json');

  if (!fs.existsSync(registryPath)) {
    throw new Error(`Tools registry file not found at ${registryPath}`);
  }

  console.log(`Loading curated tools from ${registryPath}...`);
  const content = fs.readFileSync(registryPath, 'utf-8');
  const registry = JSON.parse(content);

  console.log(`Loaded ${registry.curated_tools.length} curated tools`);
  return registry.curated_tools;
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

function convertCuratedToolToDatabase(tool: CuratedTool): ToolData {
  const config: SystemToolDefinitionData = {
    type: "system",
    implementation: {
      backend_class: tool.implementation.backend_class,
      requires_auth: tool.implementation.requires_auth,
    },
    ui_config: {
      insert_text: tool.ui_config.insert_text,
      supports_artifacts: tool.ui_config.supports_artifacts,
      icon: tool.ui_config.icon,
    },
    parameters: tool.parameters,
  };

  return {
    id: tool.id,
    displayName: tool.display_name,
    description: tool.description,
    category: tool.category,
    appId: "emery", // All system tools belong to emery app
    icon: tool.ui_config.icon,
    config,
  };
}

function convertPipedreamToolToDatabase(toolKey: string, tool: PipedreamTool): ToolData {
  const config: OAuthToolDefinitionData = {
    type: "oauth",
    implementation: {
      pipedream_key: toolKey,
      requires_auth: true,
    },
    ui_config: {
      insert_text: `@${tool.app}:${tool.name.toLowerCase().replace(/\s+/g, '-')}`,
    },
    parameters: {
      // Default parameters - will be populated from Pipedream schema if available
    },
  };

  return {
    id: toolKey,
    displayName: tool.name,
    description: tool.description || `${tool.name} tool for ${tool.app}`,
    category: getCategoryFromApp(tool.app),
    appId: tool.app,
    icon: getIconFromApp(tool.app),
    config,
  };
}

function getCategoryFromApp(appId: string): string {
  const categoryMap: Record<string, string> = {
    'slack': 'communication',
    'gmail': 'communication',
    'discord': 'communication',
    'zoom_admin': 'communication',
    'github': 'productivity',
    'trello': 'productivity',
    'clickup': 'productivity',
    'google-sheets': 'productivity',
    'hubspot': 'crm',
    'salesforce_rest_api': 'crm',
    'stripe': 'payments',
    'shopify': 'ecommerce',
    'shopify_developer_app': 'ecommerce',
    'mailchimp': 'marketing',
    'twitter': 'social',
    'openai': 'ai',
  };

  return categoryMap[appId] || 'other';
}

function getIconFromApp(appId: string): string {
  return `/icons/${appId}.svg`;
}

async function seedTools(): Promise<void> {
  try {
    console.log('🔧 Starting tools seeding...');

    // Load curated tools (system tools)
    const curatedTools = await loadCuratedTools();
    const systemToolsData = curatedTools.map(convertCuratedToolToDatabase);

    console.log(`📦 Processing ${systemToolsData.length} system tools...`);

    // Insert system tools
    for (const toolData of systemToolsData) {
      try {
        const existing = await db.select().from(tools).where(eq(tools.id, toolData.id)).limit(1);

        if (existing.length > 0) {
          // Update existing
          await db.update(tools)
            .set({
              displayName: toolData.displayName,
              description: toolData.description,
              category: toolData.category,
              appId: toolData.appId,
              icon: toolData.icon,
              config: toolData.config,
            })
            .where(eq(tools.id, toolData.id));

          console.log(`  ✅ Updated system tool: ${toolData.displayName}`);
        } else {
          // Insert new
          await db.insert(tools).values(toolData);
          console.log(`  ✅ Inserted system tool: ${toolData.displayName}`);
        }
      } catch (error) {
        console.error(`  ❌ Error processing ${toolData.displayName}:`, error);
      }
    }

    // Load Pipedream tools (OAuth tools) - process ALL available tools
    const pipedreamMetadata = await loadPipedreamMetadata();

    // Get available apps from database instead of hardcoded list
    const availableApps = await db.select({ id: appTypes.id }).from(appTypes);
    const appIds = new Set(availableApps.map(app => app.id));

    console.log(`🔗 Found ${appIds.size} apps in database to process tools for`);
    console.log(`📦 Processing ALL ${Object.keys(pipedreamMetadata).length} Pipedream tools (no limits)`);

    const oauthToolsData: ToolData[] = [];
    let processedCount = 0;
    let matchedCount = 0;
    const BATCH_SIZE = 1000;

    for (const [toolKey, tool] of Object.entries(pipedreamMetadata)) {
      processedCount++;

      // Only process tools for apps that exist in our app_types table
      if (appIds.has(tool.app)) {
        oauthToolsData.push(convertPipedreamToolToDatabase(toolKey, tool));
        matchedCount++;

        // Progress logging for large datasets
        if (matchedCount % BATCH_SIZE === 0) {
          console.log(`  📈 Processed ${matchedCount} matching tools (${processedCount}/${Object.keys(pipedreamMetadata).length} total scanned)`);
        }
      }
    }

    console.log(`🎯 Final stats: ${matchedCount} tools matched from ${processedCount} total tools scanned`);

    console.log(`🔗 Processing ${oauthToolsData.length} OAuth tools with batch progress logging...`);

    // Insert OAuth tools with enhanced progress tracking
    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const PROGRESS_INTERVAL = 500; // Log every 500 tools

    for (let i = 0; i < oauthToolsData.length; i++) {
      const toolData = oauthToolsData[i];

      try {
        const existing = await db.select().from(tools).where(eq(tools.id, toolData.id)).limit(1);

        if (existing.length > 0) {
          // Update existing
          await db.update(tools)
            .set({
              displayName: toolData.displayName,
              description: toolData.description,
              category: toolData.category,
              appId: toolData.appId,
              icon: toolData.icon,
              config: toolData.config,
            })
            .where(eq(tools.id, toolData.id));

          updatedCount++;
        } else {
          // Insert new
          await db.insert(tools).values(toolData);
          insertedCount++;
        }

        // Progress logging for large datasets
        if ((i + 1) % PROGRESS_INTERVAL === 0 || (i + 1) === oauthToolsData.length) {
          const progress = Math.round(((i + 1) / oauthToolsData.length) * 100);
          console.log(`  📊 Progress: ${i + 1}/${oauthToolsData.length} (${progress}%) - Inserted: ${insertedCount}, Updated: ${updatedCount}, Errors: ${errorCount}`);
        }

      } catch (error) {
        errorCount++;
        console.error(`  ❌ Error processing ${toolData.displayName}:`, error);
      }
    }

    console.log(`\n🎉 OAuth tools processing complete! Inserted: ${insertedCount}, Updated: ${updatedCount}, Errors: ${errorCount}`);

    // Summary
    const totalTools = await db.select().from(tools);
    const systemTools = totalTools.filter(tool => tool.appId === 'emery');
    const oauthTools = totalTools.filter(tool => tool.appId !== 'emery');

    console.log(`\n🎉 Tools seeding complete!`);
    console.log(`Total tools in database: ${totalTools.length}`);
    console.log(`System tools (emery): ${systemTools.length}`);
    console.log(`OAuth tools: ${oauthTools.length}`);

  } catch (error) {
    console.error('❌ Error seeding tools:', error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    await seedTools();
  } catch (error) {
    console.error('Failed to seed tools:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main();
}

export { seedTools };