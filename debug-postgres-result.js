// Quick debug script to see what postgres.js actually returns
const postgres = require('postgres');

async function debugPostgresResult() {
  const sql = postgres(process.env.TEST_DATABASE_URL || 'postgresql://postgres:dashlet@localhost:5433/emery', {
    max: 1,
    prepare: false
  });

  try {
    // Test simple query
    console.log('=== Simple SELECT query ===');
    const simpleResult = await sql`SELECT 1 as test_number, 'hello' as test_string`;
    console.log('Simple result:', simpleResult);
    console.log('Simple result[0]:', simpleResult[0]);
    console.log('Simple result type:', typeof simpleResult);
    console.log('Simple result is array:', Array.isArray(simpleResult));

    // Test query with array column (like domain_types in rag_indexes)
    console.log('\n=== Array column query ===');
    const arrayResult = await sql`SELECT ARRAY['file', 'table'] as domain_types`;
    console.log('Array result:', arrayResult);
    console.log('Array result[0]:', arrayResult[0]);
    console.log('Array result[0].domain_types:', arrayResult[0]?.domain_types);
    console.log('Array result[0].domain_types type:', typeof arrayResult[0]?.domain_types);

    // Test empty result
    console.log('\n=== Empty result query ===');
    const emptyResult = await sql`SELECT * FROM organizations WHERE id = -999`;
    console.log('Empty result:', emptyResult);
    console.log('Empty result type:', typeof emptyResult);
    console.log('Empty result is array:', Array.isArray(emptyResult));
    console.log('Empty result length:', emptyResult.length);

  } catch (error) {
    console.error('Debug error:', error.message);
  } finally {
    await sql.end();
  }
}

debugPostgresResult().catch(console.error);