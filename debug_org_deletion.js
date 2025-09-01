const { Client } = require('pg');

async function debugOrgDeletion() {
  const client = new Client({
    connectionString: 'postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test'
  });
  
  await client.connect();
  
  const orgId = 232;
  
  // Check if organization exists
  const orgCheck = await client.query('SELECT * FROM organizations WHERE id = $1', [orgId]);
  console.log(`Organization ${orgId} exists:`, orgCheck.rows.length > 0);
  if (orgCheck.rows.length > 0) {
    console.log('Organization data:', orgCheck.rows[0]);
  }
  
  // Try to delete and catch the exact error
  try {
    const deleteResult = await client.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    console.log(`✅ Successfully deleted organization ${orgId}, rows affected: ${deleteResult.rowCount}`);
  } catch (error) {
    console.log(`❌ Failed to delete organization ${orgId}:`);
    console.log('Error code:', error.code);
    console.log('Error message:', error.message);
    console.log('Error detail:', error.detail);
    console.log('Constraint name:', error.constraint);
    console.log('Table name:', error.table);
    console.log('Schema name:', error.schema);
  }
  
  await client.end();
}

debugOrgDeletion().catch(console.error);