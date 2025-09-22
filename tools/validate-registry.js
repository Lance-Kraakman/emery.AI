#!/usr/bin/env node
/**
 * Registry Validation Script
 *
 * Validates the unified tools registry against pipedream metadata to ensure
 * all pipedream_tool_id references exist and are properly configured.
 *
 * Run with: node tools/validate-registry.js
 */

const fs = require('fs');
const path = require('path');

// Paths
const REGISTRY_PATH = path.join(__dirname, '..', 'shared', 'tools-registry.json');
const PIPEDREAM_METADATA_PATH = path.join(__dirname, '..', 'emery-agents', 'src', 'emery_agents', 'execution', 'tools', 'pipedream_metadata.json');

function validateRegistry() {
  console.log('🔍 Validating unified tools registry...\n');

  // Load registry
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    console.log(`✅ Loaded registry with ${registry.curated_tools.length} curated tools`);
  } catch (error) {
    console.error(`❌ Failed to load registry from ${REGISTRY_PATH}:`, error.message);
    process.exit(1);
  }

  // Load pipedream metadata
  let pipedreamMetadata;
  try {
    pipedreamMetadata = JSON.parse(fs.readFileSync(PIPEDREAM_METADATA_PATH, 'utf8'));
    const pipedreamToolCount = Object.keys(pipedreamMetadata).length;
    console.log(`✅ Loaded Pipedream metadata with ${pipedreamToolCount} tools`);
  } catch (error) {
    console.error(`❌ Failed to load Pipedream metadata from ${PIPEDREAM_METADATA_PATH}:`, error.message);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(70));
  console.log('📋 REGISTRY VALIDATION RESULTS');
  console.log('='.repeat(70));

  let totalTools = 0;
  let pipedreamTools = 0;
  let nativeTools = 0;
  let validTools = 0;
  let invalidTools = 0;
  const validationErrors = [];

  // Validate each curated tool
  for (const tool of registry.curated_tools) {
    totalTools++;
    console.log(`\n🔧 Validating tool: ${tool.id}`);
    console.log(`   Display Name: ${tool.display_name}`);
    console.log(`   Category: ${tool.category}`);
    console.log(`   App: ${tool.app}`);
    console.log(`   Implementation: ${tool.implementation.type}`);

    // Validate basic structure
    const requiredFields = ['id', 'display_name', 'description', 'category', 'app', 'implementation'];
    const missingFields = requiredFields.filter(field => !tool[field]);
    if (missingFields.length > 0) {
      validationErrors.push(`Tool ${tool.id}: Missing required fields: ${missingFields.join(', ')}`);
      invalidTools++;
      console.log(`   ❌ Missing required fields: ${missingFields.join(', ')}`);
      continue;
    }

    // Validate implementation based on type
    if (tool.implementation.type === 'pipedream') {
      pipedreamTools++;
      const pipedreamToolId = tool.implementation.pipedream_tool_id;

      if (!pipedreamToolId) {
        validationErrors.push(`Tool ${tool.id}: Missing pipedream_tool_id in implementation`);
        invalidTools++;
        console.log(`   ❌ Missing pipedream_tool_id`);
        continue;
      }

      // Check if pipedream tool exists
      if (!pipedreamMetadata[pipedreamToolId]) {
        validationErrors.push(`Tool ${tool.id}: Pipedream tool '${pipedreamToolId}' not found in metadata`);
        invalidTools++;
        console.log(`   ❌ Pipedream tool '${pipedreamToolId}' not found`);
        continue;
      }

      const pipedreamTool = pipedreamMetadata[pipedreamToolId];
      console.log(`   ✅ Found Pipedream tool: ${pipedreamTool.name} (${pipedreamTool.app})`);
      console.log(`   📝 Description: ${pipedreamTool.description.substring(0, 100)}...`);

      // Validate app match
      if (pipedreamTool.app !== tool.app) {
        validationErrors.push(`Tool ${tool.id}: App mismatch - registry says '${tool.app}', pipedream says '${pipedreamTool.app}'`);
        console.log(`   ⚠️  App mismatch: registry='${tool.app}', pipedream='${pipedreamTool.app}'`);
      }

      validTools++;

    } else if (tool.implementation.type === 'native') {
      nativeTools++;
      const backendClass = tool.implementation.backend_class;

      if (!backendClass) {
        validationErrors.push(`Tool ${tool.id}: Missing backend_class in implementation`);
        invalidTools++;
        console.log(`   ❌ Missing backend_class`);
        continue;
      }

      console.log(`   ✅ Native tool with backend class: ${backendClass}`);
      validTools++;

    } else {
      validationErrors.push(`Tool ${tool.id}: Unknown implementation type '${tool.implementation.type}'`);
      invalidTools++;
      console.log(`   ❌ Unknown implementation type: ${tool.implementation.type}`);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 VALIDATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total tools validated: ${totalTools}`);
  console.log(`├─ Valid tools: ${validTools} ✅`);
  console.log(`├─ Invalid tools: ${invalidTools} ❌`);
  console.log(`├─ Pipedream tools: ${pipedreamTools}`);
  console.log(`└─ Native tools: ${nativeTools}`);

  if (validationErrors.length > 0) {
    console.log(`\n❌ VALIDATION ERRORS (${validationErrors.length}):`);
    validationErrors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }

  // Print pipeline tool examples
  console.log('\n📝 PIPEDREAM TOOL EXAMPLES:');
  const pipedreamToolExamples = registry.curated_tools
    .filter(tool => tool.implementation.type === 'pipedream')
    .slice(0, 3);

  pipedreamToolExamples.forEach(tool => {
    const pipedreamTool = pipedreamMetadata[tool.implementation.pipedream_tool_id];
    console.log(`├─ ${tool.id} → ${tool.implementation.pipedream_tool_id}`);
    console.log(`   ${pipedreamTool.name} (${pipedreamTool.app})`);
  });

  // Print success/failure
  const successRate = Math.round((validTools / totalTools) * 100);
  console.log(`\n🎯 Validation Success Rate: ${successRate}%`);

  if (invalidTools === 0) {
    console.log('✅ All tools validated successfully!');
    console.log('🚀 Registry is ready for use in frontend and backend');
    process.exit(0);
  } else {
    console.log(`❌ ${invalidTools} tools failed validation`);
    console.log('🔧 Please fix the errors above before using the registry');
    process.exit(1);
  }
}

// Generate TypeScript types from registry
function generateTypes() {
  console.log('\n🔨 Generating TypeScript types from registry...');

  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

  const toolIds = registry.curated_tools.map(tool => `'${tool.id}'`).join(' | ');
  const categories = Object.keys(registry.categories).map(cat => `'${cat}'`).join(' | ');

  const typesContent = `// Auto-generated from tools-registry.json
// Do not edit manually - run 'node tools/validate-registry.js' to regenerate

export type ToolId = ${toolIds};

export type ToolCategory = ${categories};

export interface ToolConfig {
  id: ToolId;
  display_name: string;
  description: string;
  category: ToolCategory;
  app: string;
  tags: string[];
  ui_config: {
    icon: string;
    insert_text: string;
    supports_artifacts: boolean;
    preview_description: string;
  };
  implementation: {
    type: 'pipedream' | 'native';
    pipedream_tool_id?: string;
    backend_class?: string;
    requires_auth: boolean;
    auth_provider?: string;
    api_config?: {
      method: string;
      endpoint: string;
    };
  };
  parameters: Record<string, {
    type: string;
    description: string;
    required: boolean;
    default?: any;
  }>;
}

export interface ToolsRegistry {
  version: string;
  metadata: {
    generated_at: string;
    description: string;
    total_curated_tools: number;
  };
  curated_tools: ToolConfig[];
  pipedream_config: {
    enabled: boolean;
    metadata_path: string;
    load_strategy: string;
    fallback_enabled: boolean;
    mcp_suffix: string;
    description: string;
  };
  categories: Record<ToolCategory, string>;
}
`;

  const typesPath = path.join(__dirname, '..', 'shared', 'tools-registry.types.ts');
  fs.writeFileSync(typesPath, typesContent);
  console.log(`✅ Generated TypeScript types: ${typesPath}`);
}

// Command line arguments
const args = process.argv.slice(2);
if (args.includes('--generate-types')) {
  generateTypes();
} else {
  validateRegistry();
}