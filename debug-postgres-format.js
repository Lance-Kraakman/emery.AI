// Debug script to understand postgres.js result format
const postgres = require('postgres');

async function debugFormats() {
  const sql = postgres(process.env.TEST_DATABASE_URL || 'postgresql://postgres:dashlet@localhost:5433/emery', {
    max: 1,
    prepare: false
  });

  try {
    console.log('=== Testing postgres.js result formats ===\n');

    // 1. Simple SELECT
    console.log('1. Simple SELECT:');
    const simple = await sql`SELECT 1 as id, 'test' as name`;
    console.log('  Result:', JSON.stringify(simple, null, 2));
    console.log('  Type:', typeof simple, 'Array:', Array.isArray(simple));
    console.log('  Length:', simple.length);
    console.log('  First row:', simple[0]);
    console.log();

    // 2. Array column (like domain_types)
    console.log('2. Array column:');
    const arrayResult = await sql`SELECT ARRAY['file', 'table'] as domain_types, 'test' as name`;
    console.log('  Result:', JSON.stringify(arrayResult, null, 2));
    console.log('  domain_types:', arrayResult[0].domain_types);
    console.log('  domain_types type:', typeof arrayResult[0].domain_types);
    console.log('  domain_types Array:', Array.isArray(arrayResult[0].domain_types));
    console.log();

    // 3. Empty result
    console.log('3. Empty result:');
    const empty = await sql`SELECT * FROM organizations WHERE id = -999`;
    console.log('  Result:', JSON.stringify(empty, null, 2));
    console.log('  Type:', typeof empty, 'Array:', Array.isArray(empty));
    console.log('  Length:', empty.length);
    console.log();

    // 4. Insert operation
    console.log('4. Insert result:');
    const insertResult = await sql`INSERT INTO organizations (name, slug) VALUES ('Debug Test', 'debug-test') RETURNING id, name`;
    console.log('  Result:', JSON.stringify(insertResult, null, 2));
    console.log('  Type:', typeof insertResult, 'Array:', Array.isArray(insertResult));
    console.log();

    // Cleanup
    await sql`DELETE FROM organizations WHERE slug = 'debug-test'`;

    // 5. Test with unsafe (what our proxy uses)
    console.log('5. Using unsafe() (like our proxy):');
    const unsafeResult = await sql.unsafe('SELECT $1::int as test_num, $2::text as test_text', [42, 'hello']);
    console.log('  Result:', JSON.stringify(unsafeResult, null, 2));
    console.log('  Type:', typeof unsafeResult, 'Array:', Array.isArray(unsafeResult));
    console.log();

    // 6. Transaction result
    console.log('6. Transaction result:');
    const txResult = await sql.transaction(async tx => {
      const result = await tx`SELECT 'transaction test' as message`;
      return result;
    });
    console.log('  Result:', JSON.stringify(txResult, null, 2));
    console.log('  Type:', typeof txResult, 'Array:', Array.isArray(txResult));

  } catch (error) {
    console.error('Debug error:', error.message);
  } finally {
    await sql.end();
  }
}

debugFormats().catch(console.error);