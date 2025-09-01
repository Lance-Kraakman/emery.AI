const { Client } = require('pg');

async function checkConstraints() {
  const client = new Client({
    connectionString: 'postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test'
  });
  
  await client.connect();
  
  // Check foreign key constraints
  const result = await client.query(`
    SELECT 
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND ccu.table_name = 'organizations'
    ORDER BY tc.table_name;
  `);
  
  console.log('Tables with foreign keys to organizations:');
  result.rows.forEach(row => {
    console.log(`  ${row.table_name}.${row.column_name} -> organizations.${row.foreign_column_name}`);
  });
  
  await client.end();
}

checkConstraints().catch(console.error);
