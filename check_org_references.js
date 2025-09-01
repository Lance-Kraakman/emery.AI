const { Client } = require('pg');

async function checkOrgReferences() {
  const client = new Client({
    connectionString: 'postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test'
  });
  
  await client.connect();
  
  // Check for any records referencing organization ID 232
  const orgId = 232;
  console.log(`Checking for data referencing organization ID ${orgId}:`);
  console.log('='.repeat(60));
  
  // All tables with organization_id or current_organization_id
  const queries = [
    { table: 'agents', column: 'organization_id' },
    { table: 'chats', column: 'organization_id' },
    { table: 'databases', column: 'organization_id' },
    { table: 'invitations', column: 'organization_id' },
    { table: 'rag_documents', column: 'organization_id' },
    { table: 'rag_indexes', column: 'organization_id' },
    { table: 'rag_query_logs', column: 'organization_id' },
    { table: 'tables', column: 'organization_id' },
    { table: 'tasks', column: 'organization_id' },
    { table: 'teams', column: 'organization_id' },
    { table: 'user_organizations', column: 'organization_id' },
    { table: 'users', column: 'current_organization_id' }
  ];
  
  for (const {table, column} of queries) {
    try {
      const result = await client.query(
        `SELECT COUNT(*) as count FROM ${table} WHERE ${column} = $1`,
        [orgId]
      );
      
      const count = parseInt(result.rows[0].count);
      if (count > 0) {
        console.log(`❌ ${table}.${column}: ${count} rows still reference org ${orgId}`);
        
        // Show first few records
        const sampleResult = await client.query(
          `SELECT * FROM ${table} WHERE ${column} = $1 LIMIT 3`,
          [orgId]
        );
        console.log('   Sample records:', sampleResult.rows);
      } else {
        console.log(`✅ ${table}.${column}: 0 references`);
      }
    } catch (err) {
      console.log(`⚠️  ${table}.${column}: Error - ${err.message}`);
    }
  }
  
  await client.end();
}

checkOrgReferences().catch(console.error);