const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const { agents, users } = require('./lib/db/schema.ts');

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);

async function checkAgentOwner() {
  try {
    console.log('🔍 Checking agent 2 ownership...');
    
    const result = await sql`
      SELECT 
        a.id as agent_id,
        a.name as agent_name,
        a.api_key,
        a.owner_id,
        u.name as user_name,
        u.email as user_email
      FROM agents a
      LEFT JOIN users u ON a.owner_id = u.id
      WHERE a.id = 2
    `;
    
    if (result.length > 0) {
      const data = result[0];
      console.log('Agent Details:');
      console.log(`  Agent ID: ${data.agent_id}`);
      console.log(`  Agent Name: ${data.agent_name}`);
      console.log(`  API Key: ${data.api_key}`);
      console.log(`  Owner ID: ${data.owner_id}`);
      console.log(`  Owner Name: ${data.user_name}`);
      console.log(`  Owner Email: ${data.user_email}`);
      
      if (data.user_email && data.user_email.includes('lance')) {
        console.log('✅ Agent is owned by Lance - should work with your Gmail OAuth!');
      } else {
        console.log('⚠️  Agent is NOT owned by Lance - need to create agent for your user');
      }
    } else {
      console.log('❌ Agent 2 not found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

checkAgentOwner();