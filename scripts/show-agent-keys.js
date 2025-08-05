const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

const { agents } = require('../lib/db/schema.ts');

const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString);
const db = drizzle(sql);

async function showAgentKeys() {
  try {
    console.log('🔑 Current agent API keys:');
    
    const allAgents = await db.select().from(agents);
    
    for (const agent of allAgents) {
      console.log(`Agent ${agent.id} (${agent.name}): ${agent.apiKey || 'NO API KEY'}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

showAgentKeys();