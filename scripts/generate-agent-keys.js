const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const crypto = require('crypto');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

const { agents } = require('../lib/db/schema.ts');

const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString);
const db = drizzle(sql);

/**
 * Generate secure API key for agent
 */
function generateAgentApiKey(agentId) {
  const random = crypto.randomBytes(12).toString('base64url');
  return `orch_agent_${agentId}_${random}`;
}

async function generateApiKeysForAgents() {
  try {
    console.log('🔑 Generating API keys for agents...');
    
    // Get all agents without API keys
    const agentsWithoutKeys = await db
      .select()
      .from(agents)
      .where(sql`api_key IS NULL OR api_key = ''`);
    
    console.log(`Found ${agentsWithoutKeys.length} agents without API keys`);
    
    for (const agent of agentsWithoutKeys) {
      const apiKey = generateAgentApiKey(agent.id);
      
      await db
        .update(agents)
        .set({ apiKey })
        .where(sql`id = ${agent.id}`);
      
      console.log(`✅ Generated API key for agent ${agent.id} (${agent.name}): ${apiKey}`);
    }
    
    console.log('\n🎉 API key generation complete!');
    
  } catch (error) {
    console.error('❌ Error generating API keys:', error);
  } finally {
    await sql.end();
  }
}

generateApiKeysForAgents();