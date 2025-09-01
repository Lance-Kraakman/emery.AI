// Debug transaction format specifically
const postgres = require('postgres');

async function debugTransactionFormat() {
  const sql = postgres(process.env.TEST_DATABASE_URL || 'postgresql://postgres:dashlet@localhost:5433/emery', {
    max: 1,
    prepare: false
  });

  try {
    console.log('=== Testing transaction result formats ===\n');

    // Test transaction with unsafe (what our proxy does)
    const result = await sql.transaction(async tx => {
      // Set some config (like our RLS context)
      await tx`SELECT set_config('application_name', 'debug_test', true)`;
      
      // Test unsafe in transaction
      const queryResult = await tx.unsafe('SELECT $1::text as message, ARRAY[$2, $3] as test_array', ['hello', 'item1', 'item2']);
      console.log('  Transaction unsafe result:', JSON.stringify(queryResult, null, 2));
      console.log('  Type:', typeof queryResult, 'Array:', Array.isArray(queryResult));
      console.log('  test_array:', queryResult[0]?.test_array);
      console.log('  test_array type:', typeof queryResult[0]?.test_array);
      console.log('  test_array Array:', Array.isArray(queryResult[0]?.test_array));
      
      return queryResult;
    });
    
    console.log('\n  Final transaction return:');
    console.log('  Result:', JSON.stringify(result, null, 2));
    console.log('  Type:', typeof result, 'Array:', Array.isArray(result));

  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    await sql.end();
  }
}

debugTransactionFormat().catch(console.error);