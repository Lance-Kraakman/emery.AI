// Debug rawClient format (what our proxy actually uses)
const { rawClient } = require('./lib/db/client');

async function debugRawClientFormat() {
  try {
    console.log('=== Testing rawClient format (our actual client) ===\n');

    // Test transaction with unsafe (exactly what our proxy does)
    const result = await rawClient.transaction(async tx => {
      // Set RLS context like our proxy
      await tx`SELECT set_config('app.current_organization_id', '1', true)`;
      
      // Test unsafe query with array
      const queryResult = await tx.unsafe('SELECT $1::text as message, ARRAY[$2, $3] as test_array', ['hello', 'item1', 'item2']);
      console.log('  tx.unsafe result:', JSON.stringify(queryResult, null, 2));
      console.log('  Type:', typeof queryResult, 'Array:', Array.isArray(queryResult));
      if (queryResult[0]) {
        console.log('  test_array:', queryResult[0].test_array);
        console.log('  test_array type:', typeof queryResult[0].test_array);
        console.log('  test_array Array:', Array.isArray(queryResult[0].test_array));
      }
      
      return queryResult;
    });
    
    console.log('\n  Transaction return:');
    console.log('  Result:', JSON.stringify(result, null, 2));
    console.log('  Type:', typeof result, 'Array:', Array.isArray(result));

    // Test direct unsafe (no transaction)
    console.log('\n=== Direct rawClient.unsafe ===');
    const directResult = await rawClient.unsafe('SELECT $1::text as message, ARRAY[$2, $3] as test_array', ['direct', 'a', 'b']);
    console.log('  Direct result:', JSON.stringify(directResult, null, 2));
    console.log('  Type:', typeof directResult, 'Array:', Array.isArray(directResult));

  } catch (error) {
    console.error('Debug error:', error.message);
  } finally {
    process.exit(0);
  }
}

debugRawClientFormat().catch(console.error);