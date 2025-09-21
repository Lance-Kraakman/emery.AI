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

interface SimplifiedToolMetadata {
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

async function fetchAndSavePipedreamTools() {
  if (!pipedreamClient) {
    console.error('❌ Pipedream client not configured. Please set PIPEDREAM_PROJECT_ID, PIPEDREAM_CLIENT_ID, and PIPEDREAM_CLIENT_SECRET environment variables.');
    process.exit(1);
  }

  console.log('🚀 Starting comprehensive Pipedream tool metadata fetch...\n');
  
  const toolMetadata: Record<string, SimplifiedToolMetadata> = {};
  
  // First, discover ALL available apps
  console.log('🔍 Discovering all available Pipedream apps...');
  let allApps: string[] = [];
  
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
          // SDK wraps response in special object with data and page info
          appsData = response.data || [];
          pageInfo = (response as any).page_info || null;
          
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
        
        // Extract and track unique apps
        let newAppsThisPage = 0;
        for (const app of appsData) {
          const appSlug = app.key || app.slug || app.name_slug || app.id;
          if (appSlug && typeof appSlug === 'string') {
            if (!uniqueApps.has(appSlug)) {
              uniqueApps.add(appSlug);
              newAppsThisPage++;
            }
          }
        }
        
        console.log(`    📈 Found ${newAppsThisPage} new apps on page ${pageCount} (total: ${uniqueApps.size})`);
        
        // Handle cursor for next page
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
        hasMore = false;
      }
    }
    
    if (pageCount >= maxPages) {
      console.log(`  ⚠️  Reached maximum pages (${maxPages}), stopping pagination`);
    }
    
    // Convert back to array
    allApps = Array.from(uniqueApps);
    console.log(`  ✅ Cursor pagination discovered ${allApps.length} unique apps in ${pageCount} pages`);
  } catch (error) {
    console.error('❌ Failed to discover apps via API:', error);
    console.warn('⚠️  Falling back to known popular apps');
    // Fallback to a larger set of known apps
    allApps = [
      'gmail', 'slack', 'github', 'google-drive', 'google-sheets', 'google-docs', 
      'google-calendar', 'notion', 'trello', 'discord', 'linear', 'dropbox', 
      'airtable', 'hubspot', 'salesforce', 'jira', 'microsoft-teams', 'outlook', 
      'zoom', 'stripe', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube',
      'shopify', 'woocommerce', 'wordpress', 'mailchimp', 'sendgrid', 'twilio',
      'aws', 'google-cloud', 'azure', 'mongodb', 'postgresql', 'mysql', 'redis',
      'asana', 'monday', 'clickup', 'basecamp', 'todoist', 'calendly', 'typeform',
      'google-forms', 'zapier', 'ifttt', 'webhook', 'rss', 'email'
    ];
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
      // List all actions for this app - get more actions per app
      components = await pipedreamClient.components.list({
        app: appSlug,
        type: 'action',
        limit: 200  // Get up to 200 actions per app
      });
      
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
  }
  
  // Save the metadata to JSON file
  const outputDir = path.join(process.cwd(), 'emery-agents', 'src', 'emery_agents', 'execution', 'tools');
  const outputPath = path.join(outputDir, 'pipedream_metadata.json');
  
  // Ensure the directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Write the JSON file with proper formatting
  fs.writeFileSync(outputPath, JSON.stringify(toolMetadata, null, 2));
  
  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 COMPREHENSIVE PIPEDREAM TOOL FETCH SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Successfully processed: ${targetApps.length} apps`);
  console.log(`📦 Specific action tools: ${totalActions}`);
  console.log(`🔧 Generic MCP tools: ${totalMcpTools}`);
  console.log(`🎯 Total tools created: ${totalActions + totalMcpTools}`);
  console.log(`📁 Output file: ${outputPath}`);
  
  if (failedApps.length > 0) {
    console.log(`\n⚠️  Failed apps (${failedApps.length}):`);
    failedApps.forEach(app => console.log(`  - ${app}`));
  }
  
  console.log('\n✨ Comprehensive Pipedream tool metadata fetch complete!');
  console.log(`🎉 Created tools for ALL ${targetApps.length} discovered apps`);
  console.log(`📈 Coverage: ${Math.round(((totalActions + totalMcpTools) / (targetApps.length * 2)) * 100)}% of maximum possible tools`);
  
  // Show example tools by type
  const actionTools = Object.keys(toolMetadata).filter(id => toolMetadata[id].type === 'action').slice(0, 3);
  const mcpTools = Object.keys(toolMetadata).filter(id => toolMetadata[id].type === 'mcp').slice(0, 3);
  
  if (actionTools.length > 0) {
    console.log('\n📝 Example specific action tools:');
    actionTools.forEach(toolId => {
      const tool = toolMetadata[toolId];
      console.log(`  - ${toolId}: ${tool.name} (${Object.keys(tool.inputs).length} inputs)`);
    });
  }
  
  if (mcpTools.length > 0) {
    console.log('\n🔧 Example generic MCP tools:');
    mcpTools.forEach(toolId => {
      const tool = toolMetadata[toolId];
      console.log(`  - ${toolId}: ${tool.name} (${Object.keys(tool.inputs).length} inputs)`);
    });
  }
}

// Run the script
fetchAndSavePipedreamTools().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});