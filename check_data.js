const { Client } = require('pg');

async function checkData() {
  const client = new Client({
    connectionString: 'postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test'
  });
  
  await client.connect();
  
  // Tables that reference organizations (from foreign key check)
  const tables = [
    'agents',
    'chats',
    'dynamic_field_definitions',
    'dynamic_tables',
    'rag_indexes',
    'rag_queries',
    'task_scheduler_environment_variables',
    'tasks',
    'teams',
    'webhooks'
  ];
  
  console.log('Data count in tables that reference organizations:');
  console.log('='.repeat(50));
  
  for (const table of tables) {
    try {
      const result = await client.query(`
        SELECT COUNT(*) as count 
        FROM ${table} 
        WHERE organization_id IN (
          SELECT id FROM organizations 
          WHERE name LIKE 'test-%'
        )
      `);
      
      const count = parseInt(result.rows[0].count);
      if (count > 0) {
        console.log(`  ${table}: ${count} rows`);
      }
    } catch (err) {
      console.log(`  ${table}: Error checking - ${err.message}`);
    }
  }
  
  // Check total organizations
  const orgResult = await client.query(`
    SELECT COUNT(*) as count 
    FROM organizations 
    WHERE name LIKE 'test-%'
  `);
  
  console.log('='.repeat(50));
  console.log(`Total test organizations: ${orgResult.rows[0].count}`);
  
  await client.end();
}

checkData().catch(console.error);