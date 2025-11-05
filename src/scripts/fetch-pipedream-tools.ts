#!/usr/bin/env tsx
/**
 * Fetch Pipedream Tool Metadata Script
 * 
 * Fetches available Pipedream apps and their actions, then saves
 * the metadata to a JSON file for use by the Python agent workers.
 * 
 * Run with: pnpm tsx scripts/fetch-pipedream-tools.ts
 */
import { pipedreamClient } from '@/lib/pipedream/client';
import fs from 'fs';
import path from 'path';
import { EMERY_BACKEND_TOOLS } from './emery-backend-tools';

export interface SimplifiedToolMetadata {
  id: string;
  app: string;
  name: string;
  description: string;
  type: 'action' | 'mcp'; // New: distinguish between specific actions and generic MCP tools
  inputs: Record<string, {
    type: string;
    description: string;
    required: boolean;
  }>;
}

// Retry helper function with exponential backoff
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  appSlug: string,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      const isTimeout = error?.message?.includes('timeout') || error?.statusCode === undefined;
      const isLastAttempt = attempt === maxRetries;

      if (isTimeout && !isLastAttempt) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`    🔄 Retry ${attempt}/${maxRetries} for ${appSlug} after ${delay}ms delay...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Re-throw error on last attempt or non-timeout errors
      throw error;
    }
  }

  // This should never be reached, but TypeScript requires it
  throw new Error('Retry logic error');
}

async function fetchAndSavePipedreamTools() {
  if (!pipedreamClient) {
    console.warn('⚠️  Pipedream client not configured. Using fallback mode with empty Pipedream tools.');
    console.warn('    To fetch Pipedream tools, set PIPEDREAM_PROJECT_ID, PIPEDREAM_CLIENT_ID, and PIPEDREAM_CLIENT_SECRET environment variables.');

    // Create empty toolMetadata for fallback mode
    const toolMetadata: Record<string, SimplifiedToolMetadata> = {};

    // Skip Pipedream fetching and go directly to Emery tools generation
    await generateUnifiedMetadata(toolMetadata, 0, 0, [], 0, new Map<string, string>());
    return;
  }

  console.log('🚀 Starting comprehensive Pipedream tool metadata fetch...\n');
  
  const toolMetadata: Record<string, SimplifiedToolMetadata> = {};
  
  // First, discover ALL available apps
  console.log('🔍 Discovering all available Pipedream apps...');
  let allApps: string[] = [];
  const appIconMapping = new Map<string, string>(); // Store app icons from Pipedream CDN
  
  try {
    // Get all apps using cursor-based pagination (Pipedream standard)
    let uniqueApps = new Set<string>();

    console.log(`  🔄 Cursor-based pagination (Pipedream standard)...`);
    const limit = 100;
    let cursor: string | undefined = undefined;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 100; // Safety limit

    while (hasMore && pageCount < maxPages) {
      pageCount++;
      const cursorInfo = cursor ? ` (cursor: ${cursor.substring(0, 20)}...)` : ' (initial request)';
      console.log(`  📄 Fetching apps page ${pageCount}${cursorInfo} (${uniqueApps.size} unique apps)...`);

      try {
        // Use cursor-based pagination - the proper Pipedream way
        const requestParams: any = { limit };
        if (cursor) {
          requestParams.after = cursor; // Use 'after' cursor for next page
        }

        const response = await pipedreamClient.apps.list(requestParams);

        // Handle Pipedream SDK response structure (wrapped with pagination info)
        let appsData: any[] = [];
        let pageInfo: any = null;

        if (response && typeof response === 'object') {
          // SDK wraps response in special object with data and response.page_info (original structure)
          appsData = response.data || [];
          pageInfo = (response as any).response?.page_info || (response as any).page_info || null;

          // Log pagination info on first page
          if (pageCount === 1 && pageInfo) {
            console.log(`    🎯 Total apps available: ${pageInfo.total_count}`);
            console.log(`    📄 Page size: ${pageInfo.count}`);
          }
        } else if (Array.isArray(response)) {
          // Fallback for direct array response
          appsData = response;
        }

        if (!Array.isArray(appsData) || appsData.length === 0) {
          console.log(`  ✅ No more apps found on page ${pageCount}`);
          hasMore = false;
          break;
        }

        // Extract and track unique apps with their icon URLs
        let newAppsThisPage = 0;
        for (const app of appsData) {
          const appSlug = app.key || app.slug || app.name_slug || app.id;
          if (appSlug && typeof appSlug === 'string') {
            if (!uniqueApps.has(appSlug)) {
              uniqueApps.add(appSlug);
              newAppsThisPage++;
            }
            // Capture icon URL from Pipedream CDN
            const iconUrl = app.img_src || app.icon_url;
            if (iconUrl && typeof iconUrl === 'string') {
              appIconMapping.set(appSlug, iconUrl);
            }
          }
        }

        console.log(`    📈 Found ${newAppsThisPage} new apps on page ${pageCount} (total: ${uniqueApps.size})`);

        // Handle cursor for next page (original logic)
        if (pageInfo && pageInfo.end_cursor) {
          cursor = pageInfo.end_cursor;
          hasMore = pageInfo.has_next_page !== false; // Continue if has_next_page is true or undefined
        } else if (appsData.length < limit) {
          // If we got fewer results than requested, we've likely hit the end
          console.log(`  ✅ Reached end (got ${appsData.length} < ${limit} requested)`);
          hasMore = false;
        } else {
          // No pagination info but full page - try to continue with simple cursor
          // This is a fallback for APIs that don't return proper pagination info
          const lastApp = appsData[appsData.length - 1];
          const potentialCursor = lastApp?.key || lastApp?.slug || lastApp?.id;
          if (potentialCursor && potentialCursor !== cursor) {
            cursor = potentialCursor;
          } else {
            console.log(`  ⚠️  No cursor advancement detected, stopping pagination`);
            hasMore = false;
          }
        }

      } catch (error) {
        console.error(`  ❌ Error on page ${pageCount}:`, error);
        throw error; // Fail fast, no fallbacks
      }
    }

    if (pageCount >= maxPages) {
      console.log(`  ⚠️  Reached maximum pages (${maxPages}), stopping pagination`);
    }

    // Convert back to array
    allApps = Array.from(uniqueApps);
    console.log(`  ✅ Pagination discovered ${allApps.length} unique apps in ${pageCount} pages`);
  } catch (error) {
    console.error('❌ Failed to discover apps via API:', error);
    console.warn('⚠️  Falling back to known popular apps');
    // Fallback to a larger set of known apps
    throw Error("cannot fetch apps")
  }
  
  // Remove duplicates and sort
  const targetApps = [...new Set(allApps)].sort();
  
  console.log(`\n✅ Discovered ${allApps.length} raw apps, processed to ${targetApps.length} unique apps`);
  console.log(`📝 Sample apps: ${targetApps.slice(0, 10).join(', ')}...`);
  console.log(`📝 Last few apps: ...${targetApps.slice(-10).join(', ')}`);
  
  // Process ALL discovered apps - no filtering!
  const appsToProcess = targetApps;
  
  console.log(`🚀 Processing ALL ${appsToProcess.length} apps - no filtering!`);
  console.log(`📊 This will fetch EVERY available Pipedream tool...`);
  console.log();
  
  // Track statistics
  let totalActions = 0;
  let totalMcpTools = 0;
  let failedApps: string[] = [];
  let processedApps = 0;
  
  for (const appSlug of appsToProcess) {
    processedApps++;
    const progressPercent = Math.round((processedApps / appsToProcess.length) * 100);
    console.log(`📱 [${processedApps}/${appsToProcess.length}] (${progressPercent}%) Processing ${appSlug}...`);
    
    let appHasActions = false;
    let components: any = null;
    
    try {
      // List all actions for this app with retry logic
      components = await retryWithBackoff(async () => {
        return await pipedreamClient?.components.list({
          app: appSlug,
          // q: 'action', maybe try this
          // type: 'action',
          limit: 200  // Get up to 200 actions per app
        });
      }, appSlug);
      
      // Handle response structure variations
      const actions = Array.isArray(components) ? components : (components?.data || []);
      
      if (Array.isArray(actions) && actions.length > 0) {
        appHasActions = true;
        console.log(`  ✅ Found ${actions.length} specific actions`);
        
        for (const action of actions) {
          try {
            // Extract and simplify the inputs from configurable_props
            const inputs: SimplifiedToolMetadata['inputs'] = {};
            
            if (action.configurable_props) {
              for (const prop of action.configurable_props) {
                // Skip auth-related props and app props
                if (prop.type === 'app' || prop.name === 'auth' || prop.name.includes('auth') || prop.name === appSlug) {
                  continue;
                }
                
                inputs[prop.name] = {
                  type: prop.type || 'string',
                  description: prop.description || prop.label || '',
                  required: !prop.optional
                };
              }
            }
            
            // Store the simplified metadata
            const actionId = action.key;
            toolMetadata[actionId] = {
              id: actionId,
              app: appSlug,
              name: action.name || actionId,
              description: action.description || `${appSlug} action: ${actionId}`,
              type: 'action',
              inputs
            };
            
            totalActions++;
          } catch (error) {
            console.warn(`  ⚠️  Failed to process action ${action.key}:`, error);
          }
        }
      } else {
        console.log(`  ⚪ No specific actions found for ${appSlug}`);
      }
    } catch (error) {
      console.warn(`  ⚠️  Failed to fetch actions for ${appSlug}:`, error);
      // Don't mark as failed - we'll still create MCP tool
    }
    
    // ALWAYS create a generic MCP tool for every app
    const mcpToolId = `${appSlug}-mcp`;
    toolMetadata[mcpToolId] = {
      id: mcpToolId,
      app: appSlug,
      name: `${appSlug.charAt(0).toUpperCase() + appSlug.slice(1)} MCP`,
      description: `Generic MCP tool for ${appSlug}. Supports custom API calls with method, endpoint, body, and headers.`,
      type: 'mcp',
      inputs: {
        method: {
          type: 'string',
          description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
          required: true
        },
        endpoint: {
          type: 'string', 
          description: 'API endpoint path (relative to app base URL)',
          required: true
        },
        body: {
          type: 'object',
          description: 'Request body for POST/PUT requests',
          required: false
        },
        headers: {
          type: 'object',
          description: 'Additional headers for the request',
          required: false
        }
      }
    };
    totalMcpTools++;
    
    const actionsCount = appHasActions 
      ? Array.isArray(components) ? components.length : (components?.data || []).length
      : 0;
    const statusMsg = appHasActions 
      ? `  ✅ ${appSlug}: ${actionsCount} actions + 1 MCP tool`
      : `  🔧 ${appSlug}: 0 actions + 1 MCP tool`;
    console.log(statusMsg);

    // Add a small delay between apps to help with rate limiting
    if (processedApps < appsToProcess.length) {
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between apps
    }
  }

  // Generate unified metadata with the fetched tools and app icons
  await generateUnifiedMetadata(toolMetadata, totalActions, totalMcpTools, failedApps, targetApps.length, appIconMapping);
}

async function generateUnifiedMetadata(
  toolMetadata: Record<string, SimplifiedToolMetadata>,
  totalActions: number,
  totalMcpTools: number,
  failedApps: string[],
  processedAppsCount: number,
  appIconMapping: Map<string, string>
) {

  // Create unified metadata structure with app icons from Pipedream CDN
  const unifiedMetadata = {
    app_icons: Object.fromEntries(appIconMapping), // Pipedream CDN icon URLs
    pipedream_tools: toolMetadata,
    emery_tools: EMERY_BACKEND_TOOLS
  };

  // Backend unified JSON output (for Python workers)
  const backendOutputDir = path.join(process.cwd(), 'emery-agents', 'src', 'emery_agents', 'execution', 'tools');
  const backendOutputPath = path.join(backendOutputDir, 'unified_metadata.json');

  // Ensure backend directory exists
  if (!fs.existsSync(backendOutputDir)) {
    fs.mkdirSync(backendOutputDir, { recursive: true });
  }

  // Write unified JSON file for backend (Python workers and frontend seeding)
  fs.writeFileSync(backendOutputPath, JSON.stringify(unifiedMetadata, null, 2));
  
  // Print summary
  const totalPipedreamTools = totalActions + totalMcpTools;
  const totalEmeryTools = Object.keys(EMERY_BACKEND_TOOLS).length;
  const totalAllTools = totalPipedreamTools + totalEmeryTools;
  const totalAppIcons = appIconMapping.size;

  console.log('\n' + '='.repeat(70));
  console.log('📊 UNIFIED TOOL METADATA GENERATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Successfully processed: ${processedAppsCount} Pipedream apps`);
  console.log(`🎨 Captured app icons: ${totalAppIcons} CDN URLs`);
  console.log(`📦 Pipedream action tools: ${totalActions}`);
  console.log(`🔧 Pipedream MCP tools: ${totalMcpTools}`);
  console.log(`🎯 Total Pipedream tools: ${totalPipedreamTools}`);
  console.log(`⚙️  Emery backend tools: ${totalEmeryTools}`);
  console.log(`🎯 TOTAL UNIFIED TOOLS: ${totalAllTools}`);
  console.log(`📁 Unified output: ${backendOutputPath}`);

  if (failedApps.length > 0) {
    console.log(`\n⚠️  Failed apps (${failedApps.length}):`);
    failedApps.forEach(app => console.log(`  - ${app}`));
  }

  console.log('\n✨ Unified tool metadata generation complete!');
  console.log(`🎉 Single source file contains both Pipedream and Emery tools`);
  console.log(`📈 Ready for frontend seeding and backend tool loading`);

  // Show example tools by type
  const pipedreamActionTools = Object.keys(toolMetadata).filter(id => toolMetadata[id].type === 'action').slice(0, 3);
  const pipedreamMcpTools = Object.keys(toolMetadata).filter(id => toolMetadata[id].type === 'mcp').slice(0, 3);
  const emeryTools = Object.keys(EMERY_BACKEND_TOOLS).slice(0, 3);

  if (pipedreamActionTools.length > 0) {
    console.log('\n📝 Example Pipedream action tools:');
    pipedreamActionTools.forEach(toolId => {
      const tool = toolMetadata[toolId];
      console.log(`  - ${toolId}: ${tool.name} (${Object.keys(tool.inputs).length} inputs)`);
    });
  }

  if (pipedreamMcpTools.length > 0) {
    console.log('\n🔧 Example Pipedream MCP tools:');
    pipedreamMcpTools.forEach(toolId => {
      const tool = toolMetadata[toolId];
      console.log(`  - ${toolId}: ${tool.name} (${Object.keys(tool.inputs).length} inputs)`);
    });
  }

  if (emeryTools.length > 0) {
    console.log('\n⚙️  Example Emery backend tools:');
    emeryTools.forEach(toolId => {
      const tool = EMERY_BACKEND_TOOLS[toolId];
      console.log(`  - ${toolId}: ${tool.name} (${Object.keys(tool.inputs).length} inputs)`);
    });
  }
}

// Run the script
fetchAndSavePipedreamTools().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});