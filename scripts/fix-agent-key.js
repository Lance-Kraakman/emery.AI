const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { eq } = require('drizzle-orm');

// Load environment variables
dotenv.config({ path: '.env.local' });

const { agents } = require('../lib/db/schema.ts');

const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString);
const db = drizzle(sql);

function generateAgentApiKey(agentId) {
  const random = crypto.randomBytes(12).toString('base64url');
  return `orch_agent_${agentId}_${random}`;
}

async function fixAgentKey() {
  try {
    const apiKey = generateAgentApiKey(2);
    
    await db
      .update(agents)
      .set({ apiKey })
      .where(eq(agents.id, 2));
    
    console.log(`✅ Generated API key for agent 2: ${apiKey}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

fixAgentKey();