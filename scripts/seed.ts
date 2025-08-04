import { db } from "../lib/db/client";
import { organizations, roles } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function seed() {
  try {
    console.log('🌱 Seeding database...');
    
    // Check if organization already exists
    const existingOrg = await db.select().from(organizations).limit(1);
    let defaultOrg;
    
    if (existingOrg.length === 0) {
      [defaultOrg] = await db.insert(organizations).values({
        name: 'Default Organization',
        mission: 'Default organization for initial setup',
        sharedTools: ['tables', 'fields', 'data']
      }).returning();
      console.log('✅ Created organization:', defaultOrg);
    } else {
      defaultOrg = existingOrg[0];
      console.log('📋 Using existing organization:', defaultOrg);
    }

    // Check if admin role already exists
    const existingAdminRole = await db.select().from(roles).where(
      eq(roles.name, 'Admin')
    ).limit(1);
    
    let adminRole;
    if (existingAdminRole.length === 0) {
      [adminRole] = await db.insert(roles).values({
        name: 'Admin',
        permissions: [
          'create_table',
          'manage_tables', 
          'create_fields',
          'manage_fields',
          'manage_data',
          'manage_users',
          'manage_teams',
          'manage_agents'
        ],
        organizationId: defaultOrg.id
      }).returning();
      console.log('✅ Created admin role:', adminRole);
    } else {
      adminRole = existingAdminRole[0];
      console.log('📋 Using existing admin role:', adminRole);
    }

    // Check if user role already exists
    const existingUserRole = await db.select().from(roles).where(
      eq(roles.name, 'User')
    ).limit(1);
    
    let userRole;
    if (existingUserRole.length === 0) {
      [userRole] = await db.insert(roles).values({
        name: 'User',
        permissions: [
          'create_table',
          'create_fields',
          'manage_data'
        ],
        organizationId: defaultOrg.id
      }).returning();
      console.log('✅ Created user role:', userRole);
    } else {
      userRole = existingUserRole[0];
      console.log('📋 Using existing user role:', userRole);
    }

    console.log('\n🎉 Database seeded successfully!');
    console.log(`Organization ID: ${defaultOrg.id}`);
    console.log(`Admin Role ID: ${adminRole.id}`);
    console.log(`User Role ID: ${userRole.id}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();