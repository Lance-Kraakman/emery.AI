const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const { agents } = require('./lib/db/schema.ts');

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);

function generateAgentApiKey(agentId) {
  const random = crypto.randomBytes(12).toString('base64url');
  return `orch_agent_${agentId}_${random}`;
}

async function createLanceAgent() {
  try {
    console.log('🤖 Creating agent for Lance...');
    
    const lanceUserId = '0f4f8aa5-d5cb-4280-99ba-eb60f2fe06b1';
    
    // Create agent for Lance
    const result = await sql`
      INSERT INTO agents (name, type, capabilities, owner_id, organization_id, api_key)
      VALUES ('Lance Gmail Agent', 'automation', ARRAY['gmail', 'email'], ${lanceUserId}, 1, 'temp_key')
      RETURNING id, name, api_key
    `;
    
    const agent = result[0];
    const apiKey = generateAgentApiKey(agent.id);
    
    // Update with proper API key
    await sql`
      UPDATE agents 
      SET api_key = ${apiKey}
      WHERE id = ${agent.id}
    `;
    
    console.log('✅ Created agent for Lance:');
    console.log(`   Agent ID: ${agent.id}`);
    console.log(`   Agent Name: ${agent.name}`);
    console.log(`   API Key: ${apiKey}`);
    console.log(`   Owner: Lance (${lanceUserId})`);
    
    console.log('\n🚀 Ready to test with your Gmail OAuth connection!');
    
  } catch (error) {
    console.error('❌ Error creating agent:', error);
  } finally {
    await sql.end();
  }
}

createLanceAgent();