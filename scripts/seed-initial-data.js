const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { organizations, roles } = require('../lib/db/schema');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);

async function seedInitialData() {
  try {
    console.log('Creating default organization...');
    
    // Create default organization
    const [defaultOrg] = await db.insert(organizations).values({
      name: 'Default Organization',
      mission: 'Default organization for initial setup',
      sharedTools: ['tables', 'fields', 'data']
    }).returning();
    
    console.log('Created organization:', defaultOrg);

    // Create admin role with all permissions
    const [adminRole] = await db.insert(roles).values({
      name: 'Admin',
      permissions: [
        'create_table',
        'manage_tables', 
        'create_fields',
        'manage_fields',
        'manage_data',
        'manage_users',
        'manage_teams',
        'manage_workers'
      ],
      organizationId: defaultOrg.id
    }).returning();

    console.log('Created admin role:', adminRole);

    // Create user role with basic permissions
    const [userRole] = await db.insert(roles).values({
      name: 'User',
      permissions: [
        'create_table',
        'create_fields',
        'manage_data'
      ],
      organizationId: defaultOrg.id
    }).returning();

    console.log('Created user role:', userRole);

    console.log('\n✅ Initial data seeded successfully!');
    console.log(`Organization ID: ${defaultOrg.id}`);
    console.log(`Admin Role ID: ${adminRole.id}`);
    console.log(`User Role ID: ${userRole.id}`);
    
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await sql.end();
  }
}

seedInitialData();