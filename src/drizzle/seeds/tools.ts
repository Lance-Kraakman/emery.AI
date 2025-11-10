#!/usr/bin/env tsx

/**
 * Seed Tools from Unified Metadata JSON
 *
 * This script populates the tools table with:
 * 1. Emery backend tools from unified_metadata.json (appId: "emery")
 * 2. Pipedream tools from unified_metadata.json (appId: matching app)
 */

import fs from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { tools, appTypes, type SystemToolDefinitionData, type OAuthToolDefinitionData } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { parseConnectionString } from '@/lib/db/client-parser';

// Database connection
const rawConnectionString = process.env.DATABASE_URL;
if (!rawConnectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Parse AWS RDS secret JSON into connection string if needed
const connectionString = parseConnectionString(rawConnectionString);
const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

// Interface matching the unified metadata structure
interface UnifiedToolMetadata {
  id: string;
  app: string;
  name: string;
  description: string;
  type: 'action' | 'mcp';
  inputs: Record<string, {
    type: string;
    description: string;
    required: boolean;
  }>;
}

interface UnifiedMetadataFile {
  pipedream_tools: Record<string, UnifiedToolMetadata>;
  emery_tools: Record<string, UnifiedToolMetadata>;
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

async function loadUnifiedMetadata(): Promise<UnifiedMetadataFile> {
  const jsonPath = path.join(process.cwd(), 'src', 'lib', 'data', 'unified_metadata.json');

  if (!fs.existsSync(jsonPath)) {
    throw new Error(
      `Unified metadata not generated. Run: pnpm tsx src/scripts/fetch-pipedream-tools.ts\n` +
      `Expected file: ${jsonPath}`
    );
  }

  console.log('Loading unified metadata from JSON file...');

  const fileContent = fs.readFileSync(jsonPath, 'utf-8');
  const unifiedMetadata: UnifiedMetadataFile = JSON.parse(fileContent);

  if (!unifiedMetadata || typeof unifiedMetadata !== 'object') {
    throw new Error(`Invalid unified metadata in ${jsonPath}`);
  }

  if (!unifiedMetadata.pipedream_tools || !unifiedMetadata.emery_tools) {
    throw new Error(`Missing required sections in unified metadata: pipedream_tools and emery_tools`);
  }

  const pipedreamCount = Object.keys(unifiedMetadata.pipedream_tools).length;
  const emeryCount = Object.keys(unifiedMetadata.emery_tools).length;
  console.log(`Loaded ${pipedreamCount} Pipedream tools and ${emeryCount} Emery tools from unified JSON`);

  return unifiedMetadata;
}

function convertEmeryToolToDatabase(tool: UnifiedToolMetadata): ToolData {
  const config: SystemToolDefinitionData = {
    type: "system",
    implementation: {
      backend_class: tool.id, // Use tool ID as backend class name
      requires_auth: true, // Emery tools require authentication
    },
    ui_config: {
      insert_text: `@tool:${tool.id}`,
      supports_artifacts: false, // Default to false, can be overridden
      icon: "⚙️", // Default icon for Emery tools
    },
    parameters: tool.inputs,
  };

  return {
    id: tool.id,
    displayName: tool.name,
    description: tool.description,
    category: getCategoryFromToolType(tool.id),
    appId: "emery", // All Emery tools belong to emery app
    icon: "⚙️",
    config,
  };
}

function convertPipedreamToolToDatabase(tool: UnifiedToolMetadata): ToolData {
  const config: OAuthToolDefinitionData = {
    type: "oauth",
    implementation: {
      pipedream_key: tool.id,
      requires_auth: true,
    },
    ui_config: {
      insert_text: `@tool:${tool.id}`,
    },
    parameters: tool.inputs,
  };

  return {
    id: tool.id,
    displayName: tool.name,
    description: tool.description,
    category: getCategoryFromApp(tool.app),
    appId: tool.app,
    icon: getIconFromApp(tool.app),
    config,
  };
}

function getCategoryFromToolType(toolId: string): string {
  if (toolId.includes('crud')) return 'management';
  if (toolId.includes('api')) return 'integration';
  if (toolId.includes('database') || toolId.includes('table')) return 'data';
  if (toolId.includes('file') || toolId.includes('document')) return 'storage';
  if (toolId.includes('team')) return 'collaboration';
  return 'utility';
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
    console.log('🔧 Starting tools seeding from unified metadata...');

    // Load unified metadata (both Emery and Pipedream tools)
    const unifiedMetadata = await loadUnifiedMetadata();

    // Process Emery backend tools
    const emeryToolsData = Object.values(unifiedMetadata.emery_tools).map(convertEmeryToolToDatabase);
    console.log(`📦 Processing ${emeryToolsData.length} Emery backend tools...`);

    // Insert Emery tools
    for (const toolData of emeryToolsData) {
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

          console.log(`  ✅ Updated Emery tool: ${toolData.displayName}`);
        } else {
          // Insert new
          await db.insert(tools).values(toolData);
          console.log(`  ✅ Inserted Emery tool: ${toolData.displayName}`);
        }
      } catch (error) {
        console.error(`  ❌ Error processing ${toolData.displayName}:`, error);
      }
    }

    // Process Pipedream tools (OAuth tools) - process ALL available tools
    const pipedreamTools = unifiedMetadata.pipedream_tools;

    // Get available apps from database instead of hardcoded list
    const availableApps = await db.select({ id: appTypes.id }).from(appTypes);
    const appIds = new Set(availableApps.map(app => app.id));

    console.log(`🔗 Found ${appIds.size} apps in database to process tools for`);
    console.log(`📦 Processing ALL ${Object.keys(pipedreamTools).length} Pipedream tools (no limits)`);

    const oauthToolsData: ToolData[] = [];
    let processedCount = 0;
    let matchedCount = 0;
    const BATCH_SIZE = 1000;

    for (const [toolKey, tool] of Object.entries(pipedreamTools)) {
      processedCount++;

      // Only process tools for apps that exist in our app_types table
      if (appIds.has(tool.app)) {
        oauthToolsData.push(convertPipedreamToolToDatabase(tool));
        matchedCount++;

        // Progress logging for large datasets
        if (matchedCount % BATCH_SIZE === 0) {
          console.log(`  📈 Processed ${matchedCount} matching tools (${processedCount}/${Object.keys(pipedreamTools).length} total scanned)`);
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

    console.log(`\n🎉 Unified tools seeding complete!`);
    console.log(`Total tools in database: ${totalTools.length}`);
    console.log(`Emery backend tools: ${systemTools.length}`);
    console.log(`Pipedream OAuth tools: ${oauthTools.length}`);

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